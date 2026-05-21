# 📱 React Native App Build Plan — AttendPay

> **Decision**: React Native with Expo  
> **Icon**: Purple Calendar + Fingerprint (Option 5)  
> **Login**: Persistent (like Instagram — login once, stays logged in)  
> **Distribution**: Direct APK via WhatsApp/Drive (no Play Store needed)

---

## 🏗️ Project Structure

```
biometric-attendance-system/
├── mobile/                          ← NEW: React Native app
│   ├── app/                         ← Screens (Expo Router - file-based like Next.js!)
│   │   ├── _layout.js               ← Root layout (auth check + navigation)
│   │   ├── login.js                 ← Login screen
│   │   └── (tabs)/                  ← Bottom tab navigator (after login)
│   │       ├── _layout.js           ← Tab bar config
│   │       ├── index.js             ← Dashboard (home tab)
│   │       ├── attendance.js        ← My Attendance tab
│   │       ├── leaves.js            ← My Leaves tab
│   │       ├── payslips.js          ← My Payslips tab
│   │       └── profile.js           ← Profile + Logout tab
│   ├── components/                  ← Reusable components
│   │   ├── Card.js                  ← Glassmorphism card
│   │   ├── StatusBadge.js           ← APPROVED/PENDING/REJECTED badge
│   │   ├── LoadingSpinner.js        ← Loading indicator
│   │   └── EmptyState.js            ← "No data" placeholder
│   ├── lib/
│   │   ├── api.js                   ← API client (mirrors web api.js)
│   │   └── auth.js                  ← Auth with SecureStore (persistent login)
│   ├── constants/
│   │   ├── colors.js                ← App color theme
│   │   └── config.js                ← API_BASE_URL
│   ├── assets/
│   │   ├── icon.png                 ← App icon (purple calendar+fingerprint)
│   │   ├── splash.png               ← Splash screen
│   │   └── adaptive-icon.png        ← Android adaptive icon
│   ├── app.json                     ← Expo config
│   ├── package.json
│   └── eas.json                     ← EAS Build config (for APK generation)
├── backend/                         ← EXISTING: No changes needed
└── frontend/                        ← EXISTING: No changes needed
```

---

## 📱 Screen-by-Screen Design

### Screen 1: Splash Screen (Auto)
- Purple gradient background
- AttendPay icon (calendar+fingerprint) centered
- App name "AttendPay" below
- Checks if user has stored token → if yes, skip to Dashboard
- Duration: 1-2 seconds

### Screen 2: Login Screen
- Same purple gradient background as splash
- App icon at top
- "AttendPay" title + "Employee Portal" subtitle
- Username input field
- Password input field
- "Sign In" button (gradient blue→purple)
- Loading spinner on submit
- Error message display
- **On success**: Store JWT token in SecureStore → Navigate to Dashboard
- **Persistent login**: Token stored securely, user never sees login again until logout

### Screen 3: Dashboard (Home Tab) 📊
- **Welcome card**: Gradient blue→purple, shows "Welcome back, {name}! 👋"
  - Employee ID, Shift info, Joining date
- **Leave Balance card**: Big number showing remaining paid leaves
  - Quota used / total
  - "Apply for Leave" button
- **Attendance Summary card**: Current month stats
  - Days tracked, Days present, Total hours
- **Quick action**: "View Payslips" button

### Screen 4: My Attendance Tab 🕐
- Month/Year picker at top
- List of attendance records (FlatList, scrollable)
- Each row shows:
  - Date
  - Punch In time
  - Punch Out time
  - Net hours worked
  - Status badge (COMPLETE / MISSING_OUT / AUTO_CHECKOUT)
- Pull-to-refresh
- Color coding: Green for full day, Yellow for short, Red for absent

### Screen 5: My Leaves Tab 📋
- "Apply for Leave" button at top (opens modal/bottom sheet)
- Leave balance card (compact)
- Month/Year filter
- Leave history list:
  - Date, Type (CASUAL/SICK), Reason, Status badge, Paid/Unpaid
- **Apply Leave Form** (bottom sheet modal):
  - Date picker (native date picker)
  - Leave type dropdown
  - Reason text input
  - Submit button

### Screen 6: My Payslips Tab 🧾
- Month/Year filter
- List of finalized payslips
- Each row: Period, Net Pay, Status (FINAL), "View" button
- **Payslip Detail View** (new screen or modal):
  - Company header
  - Employee details grid
  - Earnings vs Deductions table
  - Net Pay (big, highlighted)
  - Amount in words
  - "Share as PDF" button (optional future feature)

### Screen 7: Profile Tab 👤
- User avatar placeholder
- Username
- Employee name
- Employee ID
- Shift info
- Joining date
- **Logout button** (red, clears SecureStore, returns to login)

---

## 🔐 Auth Flow (Instagram-Style Persistent Login)

```
App Opens
    │
    ▼
Check SecureStore for JWT token
    │
    ├── Token EXISTS
    │     │
    │     ▼
    │   Validate token (call /api/portal/my-profile)
    │     │
    │     ├── Valid → Go to Dashboard (skip login)
    │     └── Expired/Invalid → Clear token → Show Login
    │
    └── Token NOT FOUND
          │
          ▼
        Show Login Screen
          │
          ▼
        User enters username + password
          │
          ▼
        POST /api/auth/login
          │
          ▼
        Save JWT token to SecureStore
        Save user info to SecureStore
          │
          ▼
        Go to Dashboard
```

**Key**: `expo-secure-store` uses the device's encrypted keychain (Android Keystore / iOS Keychain). Token persists across app restarts, phone restarts — just like Instagram.

---

## 🔌 API Endpoints Used (No Backend Changes!)

| Screen | API Endpoint | Method |
|--------|-------------|--------|
| Login | `/api/auth/login` | POST |
| Dashboard - Profile | `/api/portal/my-profile` | GET |
| Dashboard - Leave Balance | `/api/leaves/my-balance?year=&month=` | GET |
| Dashboard - Attendance | `/api/portal/my-attendance?year=&month=` | GET |
| Attendance Tab | `/api/portal/my-attendance?year=&month=` | GET |
| Leaves - History | `/api/leaves/my-leaves?year=&month=` | GET |
| Leaves - Balance | `/api/leaves/my-balance?year=&month=` | GET |
| Leaves - Apply | `/api/leaves/apply` | POST |
| Payslips - List | `/api/portal/my-payslips?year=&month=` | GET |
| Payslips - Detail | `/api/portal/my-payslip/{period_start}` | GET |

**The backend API already has everything we need. Zero backend changes required.**

---

## 🎨 Design System (Colors & Theme)

```javascript
// constants/colors.js
export const Colors = {
  // Primary gradient (matches web app)
  primary: '#3b82f6',        // Blue
  primaryDark: '#8b5cf6',    // Purple
  
  // Backgrounds
  background: '#f0f4ff',     // Light lavender (matches web)
  cardBackground: '#ffffff',
  
  // Text
  textPrimary: '#1e293b',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  
  // Status colors
  success: '#10b981',        // Green - present, approved
  warning: '#f59e0b',        // Yellow - pending
  danger: '#ef4444',         // Red - absent, rejected
  
  // Borders
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
};
```

---

## 📦 Dependencies

```json
{
  "dependencies": {
    "expo": "~52.0.0",
    "expo-router": "~4.0.0",
    "expo-secure-store": "~14.0.0",
    "expo-splash-screen": "~0.29.0",
    "expo-status-bar": "~2.0.0",
    "react-native": "0.76.x",
    "@expo/vector-icons": "^14.0.0",
    "react-native-reanimated": "~3.16.0",
    "@react-native-community/datetimepicker": "8.x",
    "expo-linear-gradient": "~14.0.0"
  }
}
```

All free, open-source. No paid packages.

---

## 🛠️ Build & Distribution

### Development (Testing on your phone)
```bash
cd mobile
npx expo start
# Scan QR code with Expo Go app on your phone
# App runs instantly — no build needed for testing!
```

### Build APK (For staff distribution)
```bash
# Option A: Cloud build via EAS (free tier — 30 builds/month)
npx eas-cli build --platform android --profile preview
# Downloads a .apk file you share via WhatsApp

# Option B: Local build (needs Android Studio installed)
npx expo run:android --variant release
```

### Distribution Flow
```
You build APK
    │
    ▼
Upload to Google Drive / Share via WhatsApp
    │
    ▼
Staff downloads APK
    │
    ▼
Staff taps APK → "Install" → Done!
    │
    ▼
App icon appears on home screen 💜
    │
    ▼
Staff opens app → Login once → Uses forever
```

---

## 📅 Timeline (Step-by-Step)

### Week 1: Foundation
| Day | Task |
|-----|------|
| Day 1 | Set up Expo project, install dependencies, configure app.json with icon |
| Day 2 | Build auth system (SecureStore login, persistent session, auto-redirect) |
| Day 3 | Build API client (mirrors web api.js), test all endpoints |
| Day 4 | Build Login screen with purple gradient, error handling |
| Day 5 | Build bottom tab navigation with icons |

### Week 2: Core Screens
| Day | Task |
|-----|------|
| Day 6 | Dashboard screen — welcome card, leave balance, attendance summary |
| Day 7 | Attendance screen — month picker, attendance list with status badges |
| Day 8 | Leaves screen — leave history list, balance card |
| Day 9 | Leaves screen — apply leave form (date picker, type selector, submit) |
| Day 10 | Payslips screen — list view + detail view |

### Week 3: Polish & Ship
| Day | Task |
|-----|------|
| Day 11 | Profile screen, logout flow |
| Day 12 | Splash screen, loading states, error handling, pull-to-refresh |
| Day 13 | UI polish — animations, transitions, shadows, gradient tweaks |
| Day 14 | Test on 3+ different Android phones |
| Day 15 | Build APK, share with staff, collect feedback |

---

## ⚠️ One Backend Change Required

The only backend change needed is adding the mobile app's User-Agent to CORS. But since the React Native app makes direct API calls (not through a browser), **CORS doesn't apply**. Mobile apps bypass CORS entirely.

**So truly: ZERO backend changes. Your existing FastAPI backend works as-is.**

---

## 🚀 Future Enhancements (After v1)

| Feature | Effort | Impact |
|---------|--------|--------|
| Push notifications (leave approved, payslip ready) | 1 week | High |
| Fingerprint/Face unlock on app open | 2 days | Medium |
| Offline mode (cache last viewed data) | 3 days | Medium |
| PDF download of payslips | 2 days | Medium |
| Dark mode toggle | 1 day | Low |
| Admin features (approve leaves) | 2 weeks | High |
| GPS-based attendance marking | 1 week | High |

---

## ✅ Checklist Summary

- [x] Icon chosen: Purple Calendar + Fingerprint
- [x] Tech decided: React Native + Expo
- [x] Persistent login: Yes (like Instagram)
- [x] Backend changes: None needed
- [x] Distribution: Direct APK
- [x] Cost: ₹0
- [ ] **Ready to start building? Waiting for your GO! 🚀**
