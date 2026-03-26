"""Holiday Master API — CRUD for paid holidays (calendar_days table).

Admins can add paid holidays that are treated like Sundays during payroll:
- Paid day off (employee gets per_day_salary)
- If employee works on a holiday, all hours = overtime (extra pay)
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import date

from app.database import get_supabase

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/holidays", tags=["Holidays"])


class HolidayCreate(BaseModel):
    date: date
    description: str


class HolidayUpdate(BaseModel):
    description: Optional[str] = None
    day_type: Optional[str] = None


class HolidayBulkCreate(BaseModel):
    holidays: List[HolidayCreate]


@router.get("")
async def list_holidays(year: Optional[int] = None):
    """List all holidays, optionally filtered by year."""
    db = get_supabase()
    query = db.table("calendar_days").select("*").eq("day_type", "HOLIDAY").order("date")

    if year:
        query = query.gte("date", f"{year}-01-01").lte("date", f"{year}-12-31")

    result = query.execute()
    return result.data or []


@router.get("/all")
async def list_all_calendar_days(year: Optional[int] = None):
    """List all calendar day entries (holidays + weekends + custom)."""
    db = get_supabase()
    query = db.table("calendar_days").select("*").order("date")

    if year:
        query = query.gte("date", f"{year}-01-01").lte("date", f"{year}-12-31")

    result = query.execute()
    return result.data or []


@router.post("")
async def create_holiday(data: HolidayCreate):
    """Add a new paid holiday."""
    db = get_supabase()

    # Check if date already exists
    existing = db.table("calendar_days").select("date").eq("date", data.date.isoformat()).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail=f"Calendar entry already exists for {data.date}")

    result = db.table("calendar_days").insert({
        "date": data.date.isoformat(),
        "day_type": "HOLIDAY",
        "description": data.description,
    }).execute()

    logger.info(f"Holiday created: {data.date} — {data.description}")
    return result.data[0] if result.data else {"message": "Holiday created"}


@router.put("/{holiday_date}")
async def update_holiday(holiday_date: date, data: HolidayUpdate):
    """Update a holiday entry."""
    db = get_supabase()

    update_data = {}
    if data.description is not None:
        update_data["description"] = data.description
    if data.day_type is not None:
        update_data["day_type"] = data.day_type

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = db.table("calendar_days").update(update_data).eq("date", holiday_date.isoformat()).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Holiday not found")

    logger.info(f"Holiday updated: {holiday_date}")
    return result.data[0]


@router.delete("/{holiday_date}")
async def delete_holiday(holiday_date: date):
    """Remove a holiday entry."""
    db = get_supabase()

    result = db.table("calendar_days").delete().eq("date", holiday_date.isoformat()).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Holiday not found")

    logger.info(f"Holiday deleted: {holiday_date}")
    return {"message": f"Holiday on {holiday_date} deleted"}


@router.post("/bulk")
async def bulk_create_holidays(data: HolidayBulkCreate):
    """Bulk add multiple holidays at once."""
    db = get_supabase()

    payloads = []
    for h in data.holidays:
        payloads.append({
            "date": h.date.isoformat(),
            "day_type": "HOLIDAY",
            "description": h.description,
        })

    if not payloads:
        return {"inserted": 0, "message": "No holidays provided"}

    # Use upsert to avoid conflicts on duplicate dates
    result = db.table("calendar_days").upsert(payloads, on_conflict="date").execute()

    count = len(result.data) if result.data else 0
    logger.info(f"Bulk holidays created/updated: {count}")
    return {"inserted": count, "message": f"{count} holidays added/updated"}
