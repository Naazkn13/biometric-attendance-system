"""FastAPI main application — V-Care Hospital Punch Viewer.

Stripped-down version for the V-Care hospital client.
Only attendance punch viewing, employee management, and device sync.
No payroll, leaves, holidays, overrides, or notifications.
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import get_settings
from app.routers import employees, attendance, devices, sync, adms, auth, users

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# APScheduler instance
scheduler = AsyncIOScheduler()


async def _run_session_builder_job():
    """Scheduled job: Session Builder Worker (every 30s)."""
    try:
        from app.workers.session_builder import run_session_builder
        await run_session_builder()
    except Exception as e:
        logger.error(f"Session Builder job error: {e}")


async def _run_auto_checkout_job():
    """Scheduled job: Auto Checkout Worker (every 15 min)."""
    try:
        from app.workers.auto_checkout import run_auto_checkout
        await run_auto_checkout()
    except Exception as e:
        logger.error(f"Auto Checkout job error: {e}")

async def _run_device_poller_job():
    """Scheduled job: Device Poller Worker (every 60s)."""
    try:
        from app.workers.device_poller import run_device_poller
        await run_device_poller()
    except Exception as e:
        logger.error(f"Device Poller job error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: start/stop background workers."""
    logger.info("🚀 Starting V-Care Punch Viewer System")

    # Start scheduled workers
    scheduler.add_job(_run_session_builder_job, "interval", seconds=30, id="session_builder")
    scheduler.add_job(_run_auto_checkout_job, "interval", minutes=15, id="auto_checkout")
    
    settings = get_settings()
    scheduler.add_job(_run_device_poller_job, "interval", seconds=settings.device_poll_interval_seconds, id="device_poller")
    
    scheduler.start()
    logger.info(f"⏰ Background workers started (Session Builder: 30s, Auto Checkout: 15m, Device Poller: {settings.device_poll_interval_seconds}s)")

    yield

    # Shutdown
    scheduler.shutdown(wait=False)
    logger.info("👋 Shutting down")


# Create FastAPI app
app = FastAPI(
    title="V-Care Punch Viewer",
    description=(
        "Biometric attendance punch viewer for V-Care Hospital. "
        "Tracks employee IN/OUT punches from ZKTeco biometric device. "
        "No payroll, no salary — just punch data for the doctor to review."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow mobile app and local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers — only what V-Care needs
app.include_router(adms.router)  # ADMS protocol — mounted at root (device expects /iclock/cdata)
app.include_router(employees.router, prefix="/api")
app.include_router(attendance.router, prefix="/api")
app.include_router(devices.router, prefix="/api")
app.include_router(sync.router, prefix="/api")
app.include_router(auth.router)
app.include_router(users.router)


# Global exception handler — ensures 500 errors return JSON (and CORS headers)
from fastapi.responses import JSONResponse
from starlette.requests import Request

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {type(exc).__name__}: {str(exc)}"},
    )


@app.get("/")
async def root():
    return {
        "system": "V-Care Punch Viewer",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/api/health")
async def health_check():
    """System health check."""
    from app.database import get_supabase
    try:
        db = get_supabase()
        db.table("employees").select("id").limit(1).execute()
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {e}"

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "database": db_status,
        "scheduler": "running" if scheduler.running else "stopped",
        "workers": {
            "session_builder": "active (30s interval)",
            "auto_checkout": "active (15m interval)",
            "device_poller": f"active ({get_settings().device_poll_interval_seconds}s interval)",
        },
    }
