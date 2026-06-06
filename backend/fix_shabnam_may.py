import asyncio
from datetime import date
from app.workers.special_attendance import run_special_attendance

async def fix():
    for d in range(1, 32):
        target = date(2026, 5, d)
        print(f"Running special attendance for {target}...")
        await run_special_attendance(target)
        
    print("Done recalculating all special attendances for May.")

asyncio.run(fix())
