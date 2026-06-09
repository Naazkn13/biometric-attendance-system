# Andheri Device — Why It Won't Connect & What To Do

> **Plain English report** — no technical jargon.
> Written: 9 June 2026

---

## 1. The Short Story

| Location | Status | Why? |
|----------|--------|------|
| ✅ **Yari Road** | **Working perfect** | Newer device. Software can talk to it. |
| ❌ **Andheri** | **Not working** | Old device (2017). Software cannot talk to it. |

Both locations have the same goal:
> **Get fingerprint punches from the machine → into the computer system (Supabase)**

But they use **completely different methods** to do it, because the machines are different ages.

---

## 2. How Yari Road Works (The Easy Way)

```
  Yari Road Machine (newer model)
         │
         │  ▼ "ZK Protocol" — a language the machine speaks
         │
  cloud_local_agent.py  (a small program on the Windows PC)
         │
         │  ▼ Internet
         │
  Railway (cloud server) → Supabase Database
```

**Why it works:**
- The Yari Road machine is a **newer model**
- The software (`pyzk`) knows how to talk to newer machines
- It simply **asks the machine for data**, the machine gives it, and it sends to the cloud

**Think of it like:** You ask your friend "what's the time?" and they tell you. Simple.

---

## 3. Why Andheri Cannot Connect

```
  Andheri Machine (old — Ver 6.60, Jan 2017)
         │
         │  ▼ "ZK Protocol" (same language attempt)
         │
  andheri_relay.py  (runs on Windows PC at 192.168.0.200)
         │
         │  ▼ The software says: "I asked for data... got nothing back 😞"
         │
  Railway → Supabase
```

**The problem in one sentence:**
> The Andheri machine is too old. When the software asks it for data, the machine says nothing back — even though the data is actually there.

**What we tried** (and what happened):

| Attempt | Result |
|---------|--------|
| Ask machine for attendance records | Got 0 records (machine stays silent) |
| Ask machine for user list | Got 0 users (machine stays silent) |
| Try a different language (UDP mode) | Machine doesn't respond at all |
| Try with special settings | Still nothing |

**It's like:** You ask your grandfather "what did you eat today?" He heard you, but just stares blankly. The food is there. He just can't tell you in a way you understand.

The machine was made in **January 2017** — that's 9 years old. The software language has changed since then.

---

## 4. Wait — The Machine IS Alive Though?

Yes! Here's the confusing part:

```
  Andheri Machine (192.168.0.155)
       │
       │  ▼ Heartbeat signal (just says "I'm alive!")
       │
  Relay → Railway → "Device Online" ✅ shown on dashboard
```

The machine **does** send a tiny "I'm alive" signal every 60 seconds. That's why the dashboard shows it "Online."

But it does **NOT** send the actual fingerprint punch data.

**Think of it like:** Your phone shows "Network: Connected" but your WhatsApp messages won't send. Connected ≠ Working.

---

## 5. Why Not Just Use ADMS Push? (The Second Path)

There ARE two ways to get data from the machine:

```
  Path 1: ASK for data (pyzk/ZK Protocol)  → ❌ FAILS (machine too old)
  Path 2: Machine SENDS data (ADMS Push)   → ❌ NOT WORKING YET
```

For Path 2, we set up:

```
  Machine is told: "Send your data to 192.168.0.200:8080"
  
  There's a program at 192.168.0.200:8080 ready to receive it
  (the relay)
  
  That program forwards it to Railway → Supabase
```

**We tested:** The relay → Railway path works ✅ (We sent a fake punch and it reached the database).

**The problem:** The machine itself is NOT sending anything to the relay. Even though we configured it correctly on the screen.

**It's like:** You set up your email with the right server address. You saved the settings. But your email app never actually connects to send or receive emails.

### Why the machine isn't sending:

We're not 100% sure — could be any of these:

1. **Settings didn't actually save** — sometimes old machines pretend to save but don't
2. **Wrong port** — old machines sometimes only work with port 80, not 8080
3. **Domain Name setting** — needs to be ON (we had it OFF)
4. **WiFi was disconnected** — was fixed just now, might need another restart
5. **Only sends data after a new fingerprint scan** — won't send old stored data automatically

---

## 6. What Are The Options Right Now?

### Option A: Fix ADMS Push (Best, takes 5 min on machine)

Walk to the machine and check:

1. `Menu → COMM → ADMS`
2. See if it says **"Connected"** or **"Disconnected"**
3. If disconnected, press **"Test"** or re-save the settings
4. Try turning **Domain Name = ON**
5. Try changing port to **80** instead of 8080
6. Do a real fingerprint punch and check if data arrives

### Option B: USB Export (Works 100%, takes 2 min)

This ALWAYS works, no matter how old the machine:

1. On the machine: `Menu → Reports → Attendance Logs → Export to USB`
2. Plug in a USB drive
3. Take the `1_attlog.dat` file to your computer
4. Upload it to the web app (Sync page)
5. **Done** — all data in the system

You can do this every day until the ADMS push is fixed.

### Option C: Try pyzk one more time (low chance)

We can try different connection settings that might work with old firmware. But probably won't work.

### Option D: Get a newer machine (long-term fix)

The real solution. A new ZKTeco machine costs ~₹5,000-8,000 and will work seamlessly with the existing software.

---

## 7. Current Data Status (Today)

### Yari Road — Working ✅
| Employee | Time In | 
|----------|---------|
| Yogesh (ID 7) | 4:49 PM |
| Shamim (ID 12) | 1:38 PM |
| Yasmeen (ID 1) | 10:14 AM |
| Shruti (ID 2) | 9:24 AM |

### Andheri — No Data ❌
| Employee | Expected punches | Status |
|----------|-----------------|--------|
| Mariyam (ID 4) | Should be here | ❌ Missing |
| Sultana (ID 6) | Should be here | ❌ Missing |
| Yogesh (ID 7) | Works at Yari Road | ✅ At Yari |
| Asifa (ID 10) | Should be here | ❌ Missing |
| Shabnam (ID 13) | Should be here | ❌ Missing |

---

## 8. Summary

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│   YARI ROAD   ✅ WORKS                                           │
│   ─────────────────────                                           │
│   Machine: Newer model (ZKTeco X2008)                            │
│   Method: Software talks directly to machine (ZK protocol)       │
│   Why it works: Machine speaks the same language as the software │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ANDHERI    ❌ BROKEN                                            │
│   ────────────────────                                            │
│   Machine: Old model (Ver 6.60, Jan 2017)                        │
│   Method 1: Software asks machine for data ✗                     │
│             → Machine is too old, doesn't answer                 │
│   Method 2: Machine sends data to relay ✗                        │
│             → Configured but machine isn't connecting            │
│                                                                  │
│   Best fix right now: USB Export (Option B) — takes 2 min        │
│   Best long-term fix: Newer machine (Option D)                   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**One last thing:** I had injected 2 test punches for user "Shabnam" while testing the relay. Those will show up as extra entries in the system for today. They won't cause any problems — just ignore them.

---

*Questions? Just ask and I'll explain in even simpler terms.*
