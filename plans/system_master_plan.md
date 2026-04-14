# AttendPay — System Master Plan
> Deep scan reference: full flow, connections, pending work, and payroll delete plan.

---

## Table of Contents
1. [Andheri Relay Setup (TODO Tomorrow)](#1-andheri-relay-setup-todo-tomorrow)
2. [Full System Data Flow](#2-full-system-data-flow)
3. [How Shift Master Connects](#3-how-shift-master-connects)
4. [How Holiday Master Connects](#4-how-holiday-master-connects)
5. [How Corrections Work](#5-how-corrections-work)
6. [Payroll ↔ Payslip Connection](#6-payroll--payslip-connection)
7. [How a Payslip Looks](#7-how-a-payslip-looks)
8. [Payroll Delete — Plan](#8-payroll-delete--plan)

---

## 1. Andheri Relay Setup (TODO Tomorrow)

**Problem:** Andheri ZKTeco device supports ADMS push but can't reach Railway directly
(Railway IP can change; device can't use domain names).

**Solution:** Run `andheri_relay.py` on the Andheri office PC.
Device → PC (LAN, rock solid) → Railway (internet).

### Files to copy to Andheri PC
```
andheri_relay.py
run_relay_silent.vbs
setup_relay_autostart.bat
```

### Steps
1. Copy 3 files to `C:\AttendanceAgent\` on Andheri PC
2. Install Python 3.11 + pip install requests
3. Find Andheri PC's local IP: open CMD → `ipconfig` → note IPv4 (e.g. 192.168.1.105)
4. On ZKTeco device: System → Ethernet → ADMS
   - Domain Name: OFF
   - Server Address: `192.168.1.105` (the PC's LAN IP)
   - Port: `80`
5. Right-click `andheri_relay.py` → Run as Administrator (test, console visible)
   - You should see: `Heartbeat from device SN=170371318`
   - Then: `Forwarded to Railway — X new, 0 errors`
6. Once working, right-click `setup_relay_autostart.bat` → Run as Administrator
7. Reboot Andheri PC → confirm `pythonw.exe` in Task Manager → Devices page shows Online

### How it works
```
ZKTeco (ADMS push) → andheri_relay.py (port 80 on LAN)
    ↓ receives /iclock/cdata punches
    ↓ forwards to https://attendance-production-38c4.up.railway.app/api/sync/upload-dat
    → Railway inserts into raw_punches → session_builder picks up
```

### Logs
Check `andheri_relay.log` in the same folder.

---

## 2. Full System Data Flow

```
ZKTeco Device (Andheri)          ZKTeco Device (Yari Road)
     ↓ ADMS push via relay             ↓ pyzk pull via cloud_local_agent.py
     ↓                                 ↓
Railway Backend (FastAPI)
     ↓
raw_punches table (Supabase)
     ↓  [Session Builder — runs every 30s]
attendance_sessions table
     ↓  [Override Applicator — runs after session builder]
attendance_sessions (with corrections applied)
     ↓  [Payroll Worker — triggered manually or via API]
payroll_records table
     ↓  [Payslip endpoint — reads payroll_records]
Payslip data (displayed on frontend)
```

### Step-by-step breakdown

| Step | What happens | Where |
|------|-------------|--------|
| **1. Punch arrives** | Raw punch inserted into `raw_punches` with `is_processed=false` | ADMS router / sync endpoint |
| **2. Session Builder (30s)** | Reads unprocessed punches, pairs IN/OUT into `attendance_sessions` | `workers/session_builder.py` |
| **3. Override Applicator** | After session pairing, applies any admin corrections to the session | `workers/override_applicator.py` |
| **4. Auto Checkout (15m)** | Closes OPEN sessions past shift end + 30min buffer | `workers/auto_checkout.py` |
| **5. Calculate Payroll** | Admin clicks "Calculate" on frontend → payroll worker reads sessions | `workers/payroll_worker.py` |
| **6. Finalize Payroll** | Admin marks DRAFT → FINAL. Locked from further changes | `routers/payroll.py` |
| **7. Generate Payslip** | Reads FINAL (or DRAFT) payroll record, formats for display/print | `routers/payslip.py` |

---

## 3. How Shift Master Connects

**Shift master** = the `shifts` table. Each shift has:
- `name` (e.g. "Morning Shift")
- `shift_hours` (e.g. 9.0 hours)

### Where it flows

```
shifts table
  └── employees.shift_id (FK)
        └── payroll_worker reads shift_hours for each employee
              ├── per_day_salary = basic_salary / 30
              ├── per_hour_rate = per_day_salary / shift_hours
              ├── expected_hours = working_days × shift_hours
              ├── overtime = worked_hours > shift_hours per day
              └── short hours = worked_hours < shift_hours (proportional deduction)
```

### What happens if shift_hours changes
If you change an employee's shift from 9h to 8h, the **next payroll calculation** picks up the new value. Old finalized payrolls are unaffected (they store their own calculation snapshot).

---

## 4. How Holiday Master Connects

**Holiday Master** = the `calendar_days` table (`day_type = HOLIDAY`).

### Where it flows

```
calendar_days (HOLIDAY entries)
  └── payroll_worker queries holidays in the payroll period
        └── for each day in period:
              ├── is_holiday = date in holiday_dates
              ├── is_paid_off = is_sunday OR is_holiday
              │
              ├── If holiday + employee ABSENT → still gets per_day_salary (paid off)
              └── If holiday + employee PRESENT → per_day_salary + all hours = overtime
```

### Business rule (confirmed)
Holidays behave exactly like Sundays:
- Present but not required → employee still gets paid
- If they show up and work → ALL hours that day count as overtime (extra pay on top)

### Add holidays BEFORE calculating payroll
If you add a holiday after payroll is already calculated for that month, you must **Recalculate** to apply it.

---

## 5. How Corrections Work

**Corrections** = the `session_overrides` table. Admin-entered manual fixes.

### Override types
| Type | What it does |
|------|-------------|
| `SET_PUNCH_IN` | Replace the punch-in time with a manual time |
| `SET_PUNCH_OUT` | Replace the punch-out time with a manual time |
| `SET_BOTH` | Replace both punch-in and punch-out |
| `MARK_ABSENT` | Force the day as absent (no pay) |
| `MARK_PRESENT` | Force the day as present (full day pay) |
| `OVERRIDE_HOURS` | Directly set net_hours worked |

### Flow
```
Admin creates override (frontend Corrections page)
  ↓ POST /api/overrides
  ↓ Deactivates any previous override for same employee+date
  ↓ Inserts new override into session_overrides (is_active = true)
  ↓ Immediately runs Override Applicator
      ↓ Reads active overrides for session
      ↓ Applies corrections to attendance_sessions
      ↓ Sets session.has_override = true
  ↓ Creates audit log in manual_corrections_log (before + after snapshot)
```

### Full audit trail
Every correction is logged in `manual_corrections_log` with:
- What the session looked like **before**
- What it looked like **after**
- Who did it + when
- Action: `CREATED`, `SUPERSEDED`, `DEACTIVATED`

### Corrections → Payroll connection
Payroll worker reads from `attendance_sessions` which already have overrides applied.
So corrections automatically flow into payroll — **no extra step needed**.

If you correct a session AFTER payroll is calculated → you must **Recalculate** payroll for that employee+period.

---

## 6. Payroll ↔ Payslip Connection

**Yes, payrolls and payslips are connected — payslips are built on top of payroll records.**

```
payroll_records table
  ├── stores the calculated numbers (DRAFT or FINAL)
  ├── stores calculation_details JSON (daily breakdown, warnings)
  └── stores per-employee, per-period snapshot
        ↓
payslip endpoint reads payroll_records
  ↓ if payroll exists for that period → use it
  ↓ if no payroll → calculate on the fly (DRAFT)
  └── formats into printable payslip structure
```

### Key point
- **Payslip is NOT a separate stored record.** It is generated from `payroll_records` on demand.
- If you delete a payroll record → the payslip for that employee+period disappears too.
- Finalized payrolls (`status = FINAL`) are what you should print payslips from.

---

## 7. How a Payslip Looks

Each payslip has these sections:

### Header
```
Employee Name       | Period
Device ID           | Shift Name / Shift Hours
Joining Date        |
```

### Attendance Summary
```
Total Working Days   | Days Present  | Days Absent
Expected Hours       | Hours Worked  | Missing Hours
Overtime Hours       |               |
```

### Earnings
```
Basic Salary (monthly)          ₹ XX,XXX.00
Per Day Rate (basic/30)         ₹   XXX.XX
Days Worked Salary              ₹ XX,XXX.XX   (proportional)
Overtime Pay                    ₹   XXX.XX    (extra hours × per_hour_rate)
                                ─────────────
Total Before Deductions         ₹ XX,XXX.XX
```

### Deductions
```
Professional Tax (PT)           ₹   200.00    (hardcoded)
Salary Cut (absent deduction)   ₹   XXX.XX
                                ─────────────
NET SALARY (Final)              ₹ XX,XXX.XX
```

### Daily Breakdown (per day in the period)
```
Date       | Day Type  | Hours | OT | Status    | Pay
2026-04-01 | Working   | 9.5h  | -  | COMPLETE  | ₹XXX
2026-04-06 | Sunday    | 0     | -  | -         | ₹XXX (paid off)
2026-04-10 | Holiday   | 8h    | 8h | COMPLETE  | ₹XXX+OT
2026-04-14 | Working   | 0     | -  | ABSENT    | ₹0
```

### Warnings (if any)
```
⚠ Uncorrected AUTO_CHECKOUT on 2026-04-05
⚠ Uncorrected AUTO_CHECKOUT on 2026-04-12
```

---

## 8. Payroll Delete — Plan

### Current state
There is **no delete endpoint** for payroll. The frontend has no delete button either.

### Why you need it
- Recalculated payrolls create a new DRAFT, leaving old ones behind
- Test/dummy payrolls pollute the list
- Admin mistake (wrong period) needs to be removed

### Rules for deletion
| Status | Can delete? | Rule |
|--------|------------|------|
| `DRAFT` | ✅ Yes | Can always delete a draft |
| `FINAL` | ⚠ With confirmation | Require explicit confirm — payslip depends on it |
| `RECALCULATED` | ✅ Yes | Old version, safe to delete |

### Backend — Add to `routers/payroll.py`

```python
@router.delete("/payroll/{payroll_id}")
async def delete_payroll(payroll_id: UUID, force: bool = False):
    """Delete a payroll record.
    
    - DRAFT and RECALCULATED can be deleted freely.
    - FINAL requires force=true (extra confirmation step).
    """
    db = get_supabase()
    result = db.table("payroll_records").select("id, status, employee_id, period_start, period_end") \
        .eq("id", str(payroll_id)).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Payroll not found")

    payroll = result.data[0]

    if payroll["status"] == "FINAL" and not force:
        raise HTTPException(
            status_code=400,
            detail="This payroll is FINAL. Pass force=true to delete. Payslip will no longer be available."
        )

    db.table("payroll_records").delete().eq("id", str(payroll_id)).execute()
    return {"message": f"Payroll deleted", "payroll_id": str(payroll_id)}
```

### Frontend — Add to `frontend/src/app/payroll/page.js`

1. Add a **Delete** button in the payroll table row (trash icon)
2. For DRAFT: show simple `confirm("Delete this draft payroll?")`
3. For FINAL: show a warning modal — `"This payroll is FINAL. Deleting it will remove the payslip for this employee for this period. Type DELETE to confirm."`
4. Call `DELETE /api/payroll/{id}` (with `?force=true` for FINAL)
5. Reload the list

### API function to add to `frontend/src/lib/api.js`

```javascript
export async function deletePayroll(payrollId, force = false) {
    const res = await fetch(
        `${API_BASE}/payroll/${payrollId}${force ? '?force=true' : ''}`,
        { method: 'DELETE' }
    );
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to delete payroll');
    }
    return res.json();
}
```

### Implementation order
1. Add `DELETE /api/payroll/{payroll_id}` to backend → deploy to Railway
2. Add `deletePayroll()` to `api.js`
3. Add delete button + confirmation to `payroll/page.js`
4. Test: delete a DRAFT → confirm gone from list + payslip returns 404
5. Test: delete a FINAL without force → confirm error message shown
6. Test: delete a FINAL with force → confirm payslip gone

---

## Quick Reference — Key Tables

| Table | Purpose |
|-------|---------|
| `employees` | Employee master with shift_id FK |
| `shifts` | Shift definitions (name, hours) |
| `calendar_days` | Holidays (day_type=HOLIDAY) |
| `devices` | Device registry (SN, location, last_seen) |
| `locations` | Clinic locations (Andheri, Yari Road) |
| `raw_punches` | Every fingerprint event from every device |
| `attendance_sessions` | Paired IN/OUT sessions per employee per day |
| `session_overrides` | Admin manual corrections |
| `manual_corrections_log` | Audit trail for all corrections |
| `payroll_records` | Calculated payroll (DRAFT → FINAL) |
| `system_config` | Key-value config (e.g. auto_checkout settings) |
