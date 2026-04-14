# Attendance & Payroll System

Biometric attendance tracking and payroll system for a small eye hospital. Integrates ZKTeco/eSSL devices with a cloud backend.

## Architecture

```
frontend/          Next.js 16 (App Router) — deployed on Vercel
backend/           FastAPI + Supabase + APScheduler — deployed on Railway
cloud_local_agent.py   Local Python script; polls ZKTeco device via pyzk and pushes to cloud
```

**Database:** Supabase (Postgres). Backend uses the `service_role` key. No ORM — raw Supabase client queries.

**Device integration:** Two paths:
1. **ADMS push** — device pushes punches to `/iclock/cdata` (router: `backend/app/routers/adms.py`)
2. **Local agent** — `cloud_local_agent.py` connects via pyzk and POSTs to `/api/sync/upload-dat`

## Backend

```
backend/app/
  main.py           FastAPI app, CORS config, lifespan (starts APScheduler)
  config.py         Settings from .env (pydantic-settings)
  database.py       Supabase singleton
  routers/          One file per domain (employees, attendance, payroll, devices, sync, adms, …)
  workers/          Background jobs: session_builder (30s), auto_checkout (15m), device_poller (60s), payroll_worker, recalculation
  schemas/          Pydantic request/response models
  utils/            timezone.py
```

**Run backend:**
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

**Environment variables** (`.env` in `backend/`):
- `SUPABASE_URL`
- `SUPABASE_KEY` (service_role)
- `SUPABASE_ANON_KEY`
- `BUSINESS_TIMEZONE` (default: `Asia/Kolkata`)
- `DEVICE_POLL_INTERVAL_SECONDS` (default: 60)

## Frontend

Next.js 16 App Router. Pages live under `frontend/src/app/`. API calls go through `frontend/src/lib/api.js`.

**Run frontend:**
```bash
cd frontend
npm run dev      # http://localhost:3000
```

Pages: `attendance`, `corrections`, `devices`, `employees`, `holidays`, `payroll`, `payslips`, `recalculation`, `shifts`, `sync`

## Database Schema

Key tables: `employees`, `shifts`, `locations`, `devices`, `raw_punches`, `attendance_sessions`, `overrides`, `payroll_records`, `holidays`, `system_config`

Session statuses: `OPEN`, `COMPLETE`, `AUTO_CHECKOUT`, `MISSING_OUT`, `REOPENED`

Schema file: `backend/schema.sql`

## Local Agent

`cloud_local_agent.py` — runs on-premises on the Windows machine next to the ZKTeco device.

Config at top of file: `DEVICE_IP`, `DEVICE_PORT`, `DEVICE_SN`, `CLOUD_API_URL`, `POLL_INTERVAL_SECONDS`

Production cloud URL: `https://attendance-production-38c4.up.railway.app`

Batch scripts for Windows: `start_all.bat`, `stop_all.bat`, `start_agent.bat`, `setup_autostart.bat`

## Branches

- `main` — production
- `Nuzhat/Andheri-Integration` — current branch; integrating Andheri location
- `Nuzhat/Deployment-files` — deployment scripts/config

## Key Design Decisions

- **Idempotent punch ingestion:** raw punches use `ON CONFLICT DO NOTHING` so replaying logs is safe.
- **Session builder** (30s) pairs punch-in/out into `attendance_sessions`; runs continuously.
- **Auto-checkout** (15m) closes sessions where no punch-out arrived before shift end + buffer.
- **ADMS router is mounted at root** (not under `/api`) because ZKTeco firmware expects `/iclock/cdata`.
- **No auth middleware** — system is internal/LAN only; Supabase RLS is the security boundary.
