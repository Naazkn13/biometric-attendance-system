# V-Care Hospital — Punch Viewer App (Android)

> **Branch:** `Nuzhat/V-care`  
> **Base:** `main`  
> **Date:** 2026-07-04  

Dead simple. The doctor opens the app on his Android phone and sees **who punched in when, who punched out when**. That's it.

No payroll. No shifts. No OT. No leaves. No salary. Just punches.

---

## 1. DATA FLOW — How Punches Get From the Device to the Doctor's Phone

This is the full pipeline, step by step.

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                     V-CARE HOSPITAL (ON-SITE)                    │
│                                                                  │
│  ┌─────────────┐         LAN (Same WiFi)        ┌────────────┐  │
│  │  ZKTeco /   │ ◄──── Port 4370 (ZK Protocol)──│  Hospital  │  │
│  │  eSSL       │                                 │  PC        │  │
│  │  Biometric  │                                 │            │  │
│  │  Device     │                                 │  Running:  │  │
│  │             │                                 │  vcare_    │  │
│  │  (employees │                                 │  relay.py  │  │
│  │   punch     │                                 │            │  │
│  │   here)     │                                 └──────┬─────┘  │
│  └─────────────┘                                        │        │
│                                                         │        │
└─────────────────────────────────────────────────────────┼────────┘
                                                          │
                                                          │ HTTPS POST
                                                          │ (Internet)
                                                          │
                                                          ▼
                                              ┌───────────────────┐
                                              │  Railway Backend   │
                                              │  (FastAPI)         │
                                              │                    │
                                              │  /iclock/cdata     │
                                              │  receives punch    │
                                              │  data, stores in   │
                                              │  Supabase          │
                                              │                    │
                                              │  Session Builder   │
                                              │  (runs every 30s)  │
                                              │  pairs IN/OUT      │
                                              └────────┬──────────┘
                                                       │
                                                       │ Supabase
                                                       │ (Postgres)
                                                       ▼
                                              ┌───────────────────┐
                                              │  Supabase DB       │
                                              │                    │
                                              │  raw_punches       │
                                              │  attendance_       │
                                              │    sessions        │
                                              │  employees         │
                                              │  devices           │
                                              │  users             │
                                              └────────┬──────────┘
                                                       │
                                                       │ REST API
                                                       │ (HTTPS)
                                                       ▼
                                              ┌───────────────────┐
                                              │  Doctor's Android  │
                                              │  Phone             │
                                              │                    │
                                              │  V-Care APK        │
                                              │  (Expo React       │
                                              │   Native)          │
                                              │                    │
                                              │  Shows punch logs  │
                                              └───────────────────┘
```

### Step-by-Step Data Flow

#### Step 1: Employee Punches the Biometric Machine
- Employee places finger on the ZKTeco/eSSL device at V-Care hospital
- Device records: `user_id=5, timestamp=2026-07-04 13:02:15`
- This data sits in the device's internal memory

#### Step 2: Relay Script Pulls Data from Device
- A Python script (`vcare_relay.py`) runs on a **PC at the hospital**
- This PC must be on the **same WiFi/LAN** as the biometric device
- Every 60 seconds, the relay:
  1. Connects to the device on port 4370 (ZK protocol) via `pyzk` library
  2. Pulls all attendance records
  3. Filters out records already sent (tracks `last_punch_time` in a local JSON file)
  4. Formats new punches as ATTLOG format:
     ```
     5\t2026-07-04 13:02:15\t0\t0
     ```
  5. POSTs this to the Railway backend:
     ```
     POST https://vcare-backend.up.railway.app/iclock/cdata?SN=VCARE_DEVICE_SN&table=ATTLOG
     ```

#### Step 3: Backend Receives & Stores Raw Punches
- The ADMS endpoint (`/iclock/cdata`) receives the POST
- Parses each line → converts device local time (IST) to UTC
- Upserts into `raw_punches` table (deduplication via unique constraint on `device_sn + device_user_id + punch_time`)
- Marks `is_processed = false`

#### Step 4: Session Builder Pairs IN/OUT (Every 30 Seconds)
- Background worker picks up unprocessed punches
- For each punch:
  - Resolves `device_user_id` → `employee_id` (via `employees` table)
  - Determines `session_date` from punch time
  - If no OPEN session exists for this employee+date → **creates new session** (this is a PUNCH IN)
  - If an OPEN session exists → **closes the session** (this is a PUNCH OUT)
  - If a COMPLETE session exists and gap > 2 min → **creates a new session** (second IN after a previous OUT — this is the split shift)
- Result: Employee with 4 punches gets **2 sessions**:
  - Session 1: IN 1:02 PM → OUT 3:05 PM
  - Session 2: IN 7:10 PM → OUT 10:30 PM

#### Step 5: Doctor Opens the App
- Doctor opens V-Care APK on his Android phone
- App calls: `GET https://vcare-backend.up.railway.app/api/attendance/punch-log/by-date?date=2026-07-04`
- Backend queries `attendance_sessions` table, joins with `employees`
- Returns all employees' IN/OUT times for that date
- App displays it in a nice card-based UI

---

## 2. THE RELAY — What You Install at the Hospital

### What is it?
A single Python script (`vcare_relay.py`) that runs 24/7 on a PC at V-Care hospital.

### What does it need?
| Requirement | Details |
|-------------|---------|
| **PC** | Any Windows PC at the hospital (can be the reception PC) |
| **Same WiFi** | The PC MUST be on the same LAN/WiFi as the biometric device |
| **Python** | Python 3.8+ installed |
| **Libraries** | `pip install pyzk requests` |
| **Internet** | The PC needs internet access to reach Railway |
| **Always Running** | Set up as Windows auto-start (we have .bat scripts for this) |

### How it works
```python
# vcare_relay.py — simplified view
DEVICE_SN   = "VCARE_DEVICE_SN"       # V-Care device serial
DEVICE_IP   = "192.168.x.x"           # Device IP on hospital LAN
RAILWAY_URL = "https://vcare-backend.up.railway.app"

while True:
    connect_to_device(DEVICE_IP)
    new_punches = pull_new_attendance()
    post_to_railway(new_punches)       # POST /iclock/cdata
    send_heartbeat()                   # GET /iclock/getrequest
    sleep(60)                          # poll every 60 seconds
```

### Setup Steps at V-Care Hospital
1. **Find device IP**: On the ZKTeco device → Menu → COMM → Ethernet → note the IP (e.g., `192.168.1.201`)
2. **Install Python** on hospital PC
3. **Copy `vcare_relay.py`** to the PC
4. **Edit the config** at the top of the file:
   - Set `DEVICE_IP` to the biometric device's IP
   - Set `DEVICE_SN` to the device serial number
   - Set `RAILWAY_URL` to the new V-Care Railway backend URL
5. **Run once to test**: `python vcare_relay.py`
6. **Set up auto-start**: Use `setup_relay_autostart.bat` so it starts on PC boot

### What if the PC goes offline?
- Punches still get recorded on the biometric device's internal memory
- When the PC comes back online, the relay pulls ALL new punches since the last sync
- No data is lost — the device stores up to 100,000 records

---

## 3. THIS APK IS SEPARATE — Different App, Different Backend

| | Existing App (Eye Hospital) | V-Care App (New) |
|---|---|---|
| **Backend URL** | `attendance-production-38c4.up.railway.app` | `vcare-backend.up.railway.app` (NEW) |
| **Supabase** | Existing project | NEW Supabase project |
| **APK** | Existing APK with payroll, leaves, etc. | NEW stripped-down APK (punches only) |
| **Device SN** | `4266542501559` / `170371318` | NEW serial for V-Care device |
| **Relay** | `andheri_relay.py` / `cloud_local_agent.py` | NEW `vcare_relay.py` |
| **Users** | Admins + Employees | Doctor (Admin) + SuperAdmin only |

**They are completely isolated.** Different database, different backend, different APK. Changing something in V-Care has zero effect on the existing hospital system.

---

## 4. MOBILE APP SCREENS (Android — Expo React Native)

### Tab Bar: 3 Tabs

| Tab | Icon | Screen |
|-----|------|--------|
| 📅 **Punches** | `calendar-check` | Today's punch log (default) |
| 👤 **Employees** | `users` | Employee list + employee punch history |
| ⚙️ **Settings** | `cog` | Logout, Employee CRUD (SuperAdmin) |

---

### Screen 1: 📅 PUNCHES (Date-Wise View)

The main screen. Doctor sees all employees' punches for a selected date.

```
┌──────────────────────────────┐
│  V-Care Attendance           │
│                              │
│  ◄  4 July 2026 (Today)  ►  │  ← tap arrows or date to pick
│                              │
│  Present: 12  |  Absent: 3   │
│  ────────────────────────── │
│                              │
│  ┌─ Aarti ──────────────┐   │
│  │ 🟢 1:02 PM → 3:05 PM │   │  ← session 1 (afternoon)
│  │ 🟢 7:10 PM → 10:30PM │   │  ← session 2 (night)
│  └──────────────────────┘   │
│                              │
│  ┌─ Ramesh ─────────────┐   │
│  │ 🟡 1:15 PM → ⏳ OPEN  │   │  ← still on premises
│  └──────────────────────┘   │
│                              │
│  ┌─ Sunil ──────────────┐   │
│  │ 🔴 ABSENT             │   │
│  └──────────────────────┘   │
│                              │
│  ┌─ Priya ──────────────┐   │
│  │ ⚠️ 1:00 PM → 4:00 PM │   │  ← AUTO_CHECKOUT (forgot to punch out)
│  │ 🟢 7:05 PM → 10:55PM │   │
│  └──────────────────────┘   │
│                              │
└──────────────────────────────┘
│  📅 Punches │ 👤 Employees │ ⚙️ │
└──────────────────────────────┘
```

**Tap an employee card** → navigates to their Employee Punch History (Screen 2B)

---

### Screen 2: 👤 EMPLOYEES

#### 2A — Employee List
```
┌──────────────────────────────┐
│  Employees                   │
│  🔍 Search...                │
│  ────────────────────────── │
│  ┌──────────────────────┐   │
│  │ Aarti         ID: 5  │   │  ← tap to see punch history
│  └──────────────────────┘   │
│  ┌──────────────────────┐   │
│  │ Ramesh        ID: 12 │   │
│  └──────────────────────┘   │
│  ┌──────────────────────┐   │
│  │ Sunil         ID: 8  │   │
│  └──────────────────────┘   │
│  ...                         │
└──────────────────────────────┘
```

#### 2B — Employee Punch History (after tapping an employee)

**Two modes:**
1. **Monthly View** (default) — see all days at a glance
2. **Date Picker** — select a specific date to see detailed punches for that employee on that day

```
┌──────────────────────────────┐
│  ← Aarti's Punches          │
│                              │
│  ◄  July 2026  ►            │
│  Present: 22 | Absent: 4    │
│  ────────────────────────── │
│                              │
│  📅 Pick a date: [4 Jul ▼]  │  ← date picker dropdown
│  ────────────────────────── │
│                              │
│  ┌─ 4 Jul (Fri) ────────┐   │
│  │ 🟢 1:02 PM → 3:05 PM │   │  ← session 1
│  │ 🟢 7:10 PM → 10:30PM │   │  ← session 2
│  │ Total: 5h 23m         │   │
│  └──────────────────────┘   │
│                              │
│  ┌─ 3 Jul (Thu) ────────┐   │
│  │ 🟢 1:00 PM → 3:15 PM │   │
│  │ 🟢 7:00 PM → 11:00PM │   │
│  │ Total: 6h 15m         │   │
│  └──────────────────────┘   │
│                              │
│  ┌─ 2 Jul (Wed) ────────┐   │
│  │ 🔴 ABSENT             │   │
│  └──────────────────────┘   │
│                              │
│  ┌─ 1 Jul (Tue) ────────┐   │
│  │ 🟢 12:58 PM → 3:10PM │   │
│  │ ⚠️ 7:15 PM → 11:59PM │   │  ← auto-checkout
│  │ Total: 6h 56m         │   │
│  └──────────────────────┘   │
│  ...                         │
└──────────────────────────────┘
```

**When doctor selects employee + specific date** → shows every single punch for that employee on that date:

```
┌──────────────────────────────┐
│  ← Aarti — 4 July 2026      │
│  ────────────────────────── │
│                              │
│   Session 1                  │
│   ├─ 🟢 IN   1:02:15 PM    │
│   └─ 🟢 OUT  3:05:42 PM    │
│   Duration: 2h 03m          │
│                              │
│   Session 2                  │
│   ├─ 🟢 IN   7:10:22 PM    │
│   └─ 🟢 OUT  10:30:05 PM   │
│   Duration: 3h 20m          │
│                              │
│   ───────────────────────   │
│   Day Total: 5h 23m         │
│                              │
└──────────────────────────────┘
```

---

### Screen 3: ⚙️ SETTINGS

```
┌──────────────────────────────┐
│  Settings                    │
│  ────────────────────────── │
│                              │
│  👤 Logged in as: Doctor     │
│  Role: ADMIN                 │
│                              │
│  [Manage Employees]          │  ← SuperAdmin only
│  [Manage Devices]            │  ← SuperAdmin only
│  [Sync Status]               │  ← Device health
│                              │
│  [Logout]                    │
│                              │
└──────────────────────────────┘
```

---

## 5. BACKEND — API Endpoints

### New Endpoints to Add

#### `GET /api/attendance/punch-log/by-date`
**Params:** `date` (YYYY-MM-DD, defaults to today)

Returns all employees' punches for a date. Used by the **Punches** tab.

```json
{
  "date": "2026-07-04",
  "summary": { "total": 15, "present": 12, "absent": 3 },
  "employees": [
    {
      "employee_id": "uuid",
      "employee_name": "Aarti",
      "sessions": [
        {
          "punch_in": "2026-07-04T07:32:15Z",
          "punch_out": "2026-07-04T09:35:42Z",
          "punch_in_local": "1:02 PM",
          "punch_out_local": "3:05 PM",
          "hours": 2.05,
          "status": "COMPLETE"
        },
        {
          "punch_in": "2026-07-04T13:40:22Z",
          "punch_out": "2026-07-04T17:00:05Z",
          "punch_in_local": "7:10 PM",
          "punch_out_local": "10:30 PM",
          "hours": 3.33,
          "status": "COMPLETE"
        }
      ],
      "total_hours": 5.38,
      "status": "COMPLETE"
    }
  ]
}
```

#### `GET /api/attendance/punch-log/by-employee`
**Params:** `employee_id`, `month` (1-12), `year` (YYYY)

Returns one employee's punches for the entire month. Used by the **Employee Punch History** screen.

#### `GET /api/attendance/punch-log/by-employee-date`
**Params:** `employee_id`, `date` (YYYY-MM-DD)

Returns one employee's detailed punches for a specific date. Used when the doctor picks **employee + date**.

```json
{
  "employee_name": "Aarti",
  "date": "2026-07-04",
  "sessions": [
    {
      "session_number": 1,
      "punch_in_local": "1:02:15 PM",
      "punch_out_local": "3:05:42 PM",
      "duration": "2h 03m",
      "status": "COMPLETE"
    },
    {
      "session_number": 2,
      "punch_in_local": "7:10:22 PM",
      "punch_out_local": "10:30:05 PM",
      "duration": "3h 20m",
      "status": "COMPLETE"
    }
  ],
  "day_total": "5h 23m"
}
```

### Existing Endpoints — Keep As-Is
| Endpoint | Used For |
|----------|----------|
| `POST /iclock/cdata` | Receives punches from relay (ADMS push) |
| `GET /iclock/getrequest` | Device heartbeat |
| `POST /api/sync/upload-dat` | Manual file sync (backup option) |
| `GET /api/employees` | Employee list |
| `POST /api/employees` | Create employee |
| `PUT /api/employees/:id` | Update employee |
| `DELETE /api/employees/:id` | Deactivate employee |
| `POST /api/auth/login` | Admin login |
| `GET /api/auth/me` | Get logged-in user |

### Endpoints to REMOVE from This Deployment
- ~~`/api/payroll/*`~~
- ~~`/api/payslips/*`~~
- ~~`/api/overrides/*`~~
- ~~`/api/holidays/*`~~
- ~~`/api/leaves/*`~~
- ~~`/api/notifications/*`~~
- ~~`/api/voice/*`~~

---

## 6. AUTO-CLOSE LOGIC (No Shift Master)

Since all employees work the same split pattern (~1-3 PM + ~7-11 PM), we don't need a shift master. We use a simple time-based rule:

| Session Punched In At | Auto-Closes At | Reason |
|----------------------|---------------|--------|
| Before 4:00 PM | **4:00 PM** same day | Morning/afternoon session |
| At or after 4:00 PM | **11:59 PM** same day | Night session |

### Changes to `auto_checkout.py`

```python
# No shift lookup needed — purely time-based
AFTERNOON_CUTOFF = time(16, 0)   # 4:00 PM IST
NIGHT_CUTOFF = time(23, 59)      # 11:59 PM IST

for session in open_sessions:
    punch_in_local = convert_utc_to_ist(session.punch_in_time)
    
    if punch_in_local.time() < AFTERNOON_CUTOFF:
        # Morning/afternoon session → close at 4 PM
        deadline = datetime.combine(session.session_date, AFTERNOON_CUTOFF)
    else:
        # Night session → close at 11:59 PM
        deadline = datetime.combine(session.session_date, NIGHT_CUTOFF)
    
    if now_ist >= deadline:
        auto_close(session, punch_out_time=deadline_utc)
```

---

## 7. EMPLOYEE MASTER (What the Doctor Manages)

Simple table. Each employee just has:

| Field | Example | Purpose |
|-------|---------|---------|
| `name` | "Aarti" | Display name |
| `device_user_id` | "5" | Maps to biometric machine user ID |
| `is_active` | true | Active/inactive toggle |
| `joining_date` | 2026-01-15 | Ignore punches before this date |

**No salary, no shift_id, no OT rate.** Those columns exist in the DB schema from `main` branch but we simply don't use them in the V-Care mobile app.

---

## 8. DEPLOYMENT CHECKLIST

### A. Create New Supabase Project
1. Go to supabase.com → New Project → Name: "V-Care Hospital"
2. Run `schema.sql` to create tables
3. Note the `SUPABASE_URL` and `SUPABASE_KEY` (service role key)
4. Insert initial data:
   - Create `users` row for doctor (role: ADMIN)
   - Create `users` row for you (role: SUPERADMIN)
   - Register the biometric device in `devices` table

### B. Deploy Backend to Railway
1. Create new Railway project from `Nuzhat/V-care` branch
2. Set environment variables:
   ```
   SUPABASE_URL=https://vcare-xxxx.supabase.co
   SUPABASE_KEY=eyJ...service-role-key
   BUSINESS_TIMEZONE=Asia/Kolkata
   AUTO_CHECKOUT_BUFFER_MINUTES=15
   JWT_SECRET_KEY=<new-random-256bit-key>
   ```
3. Deploy → note the Railway URL (e.g., `vcare-backend.up.railway.app`)

### C. Set Up Relay at V-Care Hospital
1. Copy `vcare_relay.py` to hospital PC
2. Install Python + pyzk: `pip install pyzk requests`
3. Edit config in the relay:
   ```python
   DEVICE_SN   = "VCARE_ACTUAL_SN"
   DEVICE_IP   = "192.168.x.x"      # Find on device: Menu > COMM > Ethernet
   RAILWAY_URL = "https://vcare-backend.up.railway.app"
   ```
4. Test: `python vcare_relay.py 192.168.x.x`
5. Set up auto-start: `setup_relay_autostart.bat`

### D. Build Android APK
1. Update `mobile/.env`:
   ```
   EXPO_PUBLIC_API_URL=https://vcare-backend.up.railway.app
   ```
2. Build APK:
   ```bash
   cd mobile
   eas build --platform android --profile preview
   ```
3. Download APK → install on doctor's phone

### E. Register Employees
1. At the biometric device: register each employee with a user ID (1, 2, 3...)
2. In the app (SuperAdmin) or via API: create employee records matching those user IDs
3. The relay will start pushing punches → sessions get created → doctor sees them

---

## 9. FILES TO MODIFY (Summary)

| File | Change |
|------|--------|
| `backend/app/routers/attendance.py` | Add 3 new punch-log endpoints |
| `backend/app/workers/auto_checkout.py` | Time-based auto-close (4 PM / 11:59 PM) |
| `backend/app/main.py` | Remove unused routers (payroll, leaves, etc.) |
| `vcare_relay.py` | **NEW** — Copy of `andheri_relay.py` with V-Care config |
| `mobile/app/(tabs)/punches.tsx` | **NEW** — Date-wise punch log screen |
| `mobile/app/(tabs)/employees.tsx` | Simplify — list + employee punch history with date picker |
| `mobile/app/(tabs)/settings.tsx` | **NEW** — Logout + employee management |
| `mobile/app/(tabs)/_layout.tsx` | Strip to 3 tabs only |
| `mobile/.env` | Point to new Railway backend URL |

**Files with ZERO changes:** `session_builder.py`, `auth.py`, `adms.py`, `sync.py`, `login.tsx`

---

## 10. WHAT WE'RE NOT BUILDING

- ❌ Shift master (not needed — everyone has same pattern)
- ❌ Payroll / salary / OT calculations
- ❌ Leave management
- ❌ Holiday calendar
- ❌ Override corrections
- ❌ Payslips
- ❌ Notifications / push alerts
- ❌ Employee self-service (employees don't use the app)
- ❌ Web dashboard (mobile only)
- ❌ Voice features

---

## 11. VERIFICATION PLAN

### Backend Tests
1. Simulate 4 punches (IN 1PM, OUT 3PM, IN 7PM, OUT 11PM) → verify 2 sessions created
2. Test auto-close: session opened at 1 PM closes at 4 PM, session opened at 7 PM closes at 11:59 PM
3. Test `by-date` endpoint returns all employees' punches correctly
4. Test `by-employee-date` endpoint returns detailed sessions for one employee on one date
5. Test `by-employee` endpoint returns full month for an employee

### Mobile Tests
1. Build APK → install on phone
2. Login as Admin → verify date-wise punch log shows today's data
3. Swipe dates → verify previous days load correctly
4. Tap employee → verify monthly punch history displays
5. Select employee + date → verify detailed session view
6. Pull-to-refresh → verify new punches appear
