import asyncio
from app.database import get_supabase

async def test():
    db = get_supabase()
    res = db.table("calendar_days").select("*").eq("date", "2026-05-28").execute()
    print(res.data)

asyncio.run(test())
