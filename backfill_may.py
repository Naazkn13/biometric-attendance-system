import asyncio
from datetime import date, timedelta
import sys
import os

# Ensure the backend directory is in the path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

from app.workers.special_attendance import run_special_attendance

async def main():
    print("Starting backfill for May 2026...")
    start_date = date(2026, 5, 1)
    end_date = date.today()
    
    current_date = start_date
    while current_date <= end_date:
        weekday = current_date.weekday()
        if weekday in [0, 3]: # Monday=0, Thursday=3
            print(f"Running special attendance for {current_date}")
            await run_special_attendance(current_date)
        current_date += timedelta(days=1)
        
    print("Backfill for May 2026 complete!")

if __name__ == "__main__":
    asyncio.run(main())
