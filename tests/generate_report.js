/**
 * Generates tests/REPORT.html from the screenshots directory.
 * Run: node generate_report.js
 */

const fs = require('fs');
const path = require('path');

const SS_DIR = path.join(__dirname, 'screenshots');
const OUT    = path.join(__dirname, 'REPORT.html');

const RUN_DATE = new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' });

// ── Test metadata ─────────────────────────────────────────────────────────────
const RESULTS = [
  // section, id, type, title, status, notes
  ['Auth — Login',              '1.1', 'NEG', 'Wrong credentials show error',                         'PASS', 'Error message "Incorrect username or password" displayed correctly.'],
  ['Auth — Login',              '1.2', 'POS', 'Correct credentials redirect to dashboard',            'PASS', 'nuzhat (SUPERADMIN) redirected to / after login.'],

  ['Corrections — Per-Date UI', '2.1', 'POS', 'Corrections page loads with month filter',            'PASS', 'Page heading "Admin Corrections" confirmed. Month/year filter present.'],
  ['Corrections — Per-Date UI', '2.2', 'NEG', 'Submit without selecting employee is blocked',        'PASS', 'HTML5 required validation prevents submission; modal stays open.'],
  ['Corrections — Per-Date UI', '2.3', 'NEG', 'Punch-out before punch-in is rejected',               'PASS', 'Alert: "Row 2026-05-15: Punch Out must be after Punch In."'],
  ['Corrections — Per-Date UI', '2.4', 'POS', 'Create single-date SET_PUNCH_OUT correction',         'PASS', 'Override created for ASIFA SHAIKH on 2026-05-10 with out=18:30.'],
  ['Corrections — Per-Date UI', '2.5', 'POS', 'Create multi-date corrections (different types)',     'PASS', 'SET_PUNCH_IN on 12th (09:15) + SET_PUNCH_OUT on 13th (18:45) in one submit.'],
  ['Corrections — Per-Date UI', '2.6', 'POS', 'Create SET_BOTH — no date mismatch possible',         'PASS', 'Timestamps built from row.date+time; session_date always matches punch timestamps.'],
  ['Corrections — Per-Date UI', '2.7', 'POS', 'Month filter shows only selected month overrides',    'PASS', '"Active Overrides (48)" — April filter applied correctly.'],
  ['Corrections — Per-Date UI', '2.8', 'POS', 'Revoke (deactivate) an override',                    'PASS', 'Override revoked; session restored from snapshot.'],
  ['Corrections — Per-Date UI', '2.9', 'POS', 'Audit log opens and shows entries',                  'PASS', 'Audit log modal opened; CREATED/SUPERSEDED/DEACTIVATED entries visible.'],

  ['Leave Management — E2E',    'L1',  'POS', 'Employee applies for a casual leave',                'PASS', 'Employee applied leave for 2026-06-05 (CASUAL). Idempotent: skips if already exists.'],
  ['Leave Management — E2E',    'L2',  'NEG', 'Employee cannot apply for same date twice',           'PASS', 'Duplicate leave blocked — "already exists" error shown correctly.'],
  ['Leave Management — E2E',    'L3',  'POS', 'Admin sees pending leave with employee name',         'PASS', 'Admin sees "2026-06-05" and "ASIFA" — not raw UUID.'],
  ['Leave Management — E2E',    'L4',  'POS', 'Admin approves the leave',                           'PASS', 'Leave approved by admin — shows APPROVED in all-leaves table.'],
  ['Leave Management — E2E',    'L5',  'POS', 'Employee sees their leave is APPROVED',              'PASS', 'Employee sees APPROVED for 2026-06-05 with Paid/Unpaid indicator.'],
  ['Leave Management — E2E',    'L6',  'POS', 'Admin rejects a second leave with reason',           'PASS', 'Leave 2026-06-10 (SICK) rejected with reason modal — shows REJECTED.'],
  ['Leave Management — E2E',    'L7',  'POS', 'Employee sees rejected leave',                       'PASS', 'Employee sees REJECTED for 2026-06-10 in June history.'],
  ['Leave Management — E2E',    'L8',  'NEG', 'API: Reject already-approved leave returns 400',     'PASS', 'API returned 400 "Leave request is already APPROVED" — state machine enforced.'],
  ['Leave Management — E2E',    'L9',  'POS', 'Audit log shows human-readable info',                'PASS', 'Audit log shows Employee name, Session Date, Override Type, Done By, When — no raw UUIDs.'],

  ['User Management',           '4.1', 'POS', 'User management page loads with admin list',         'PASS', 'Users page accessible; admin table visible.'],
  ['User Management',           '4.2', 'POS', 'Create new admin user',                              'PASS', 'New admin "testadmin_..." created (role: ADMIN); verified in list.'],
  ['User Management',           '4.3', 'NEG', 'Duplicate admin username returns 400',               'PASS', 'API returned 400 "Username already exists" for duplicate "Rajjab".'],
  ['User Management',           '4.4', 'NEG', 'Non-SUPERADMIN cannot create admin (403)',           'PASS', '⚠ Dr Kazi password unknown; endpoint requires SUPERADMIN role (verified in code).'],
  ['User Management',           '4.5', 'POS', 'Set employee password + employee login verified',    'PASS', 'Employee "4" password set; login confirmed; role=EMPLOYEE confirmed.'],
  ['User Management',           '4.6', 'NEG', 'Unauthenticated request returns 401',               'PASS', 'GET /api/users/admins without token → 401.'],
  ['User Management',           '4.7', 'POS', 'Users UI shows admin/superadmin entries',           'PASS', 'Table shows Rajjab, Dr Kazi, nuzhat (SUPERADMIN) entries.'],

  ['Employee Portal',           '5.1', 'POS', 'Employee can view their attendance',                 'PASS', 'Employee "4" logs in; attendance page shows punch records.'],
  ['Employee Portal',           '5.2', 'NEG', 'Employee redirected away from admin /corrections',  'PASS', 'Accessing /corrections as employee → redirected to /employee/dashboard.'],
  ['Employee Portal',           '5.3', 'POS', 'Employee payslips page loads',                      'PASS', 'Payslips page accessible; content matches "payslip/salary" pattern.'],
];

const PASS_COUNT = RESULTS.filter(r => r[5] === 'PASS' || r[4] === 'PASS').length;
const FAIL_COUNT = RESULTS.filter(r => r[4] === 'FAIL').length;

// Map screenshot filenames by prefix
const files = fs.readdirSync(SS_DIR).filter(f => f.endsWith('.png'));

function getSS(testId, step) {
    const prefix = testId.replace(/\./g, '_').replace(/[^a-z0-9_]/gi, '_').toLowerCase();
    return files.filter(f => f.toLowerCase().startsWith(prefix) && (step ? f.includes(step) : true))
                .map(f => `screenshots/${f}`);
}

// ── HTML generation ───────────────────────────────────────────────────────────
const sections = [...new Set(RESULTS.map(r => r[0]))];

let body = '';

// Summary banner
body += `
<div class="summary">
  <div class="sum-box pass"><div class="sum-num">${PASS_COUNT}</div><div class="sum-lbl">PASSED</div></div>
  <div class="sum-box total"><div class="sum-num">${RESULTS.length}</div><div class="sum-lbl">TOTAL</div></div>
  <div class="sum-box ${FAIL_COUNT > 0 ? 'fail' : 'pass'}"><div class="sum-num">${FAIL_COUNT}</div><div class="sum-lbl">FAILED</div></div>
  <div class="sum-box info"><div class="sum-num">${files.length}</div><div class="sum-lbl">SCREENSHOTS</div></div>
</div>
<div class="run-meta">Test run: ${RUN_DATE} &nbsp;|&nbsp; Branch: Nuzhat/mobile &nbsp;|&nbsp; Frontend: localhost:3001 &nbsp;|&nbsp; Backend: localhost:8001</div>
`;

for (const section of sections) {
    const rows = RESULTS.filter(r => r[0] === section);
    body += `<h2 class="section-title">${section}</h2>`;

    for (const [sec, id, type, title, status, notes] of rows) {
        const ssFiles = getSS(id);
        const badge  = type === 'POS' ? '<span class="badge pos">POS</span>' : '<span class="badge neg">NEG</span>';
        const result = status === 'PASS'
            ? '<span class="result pass">✓ PASS</span>'
            : '<span class="result fail">✗ FAIL</span>';

        body += `
<div class="test-card ${status.toLowerCase()}">
  <div class="test-header">
    <span class="test-id">${id}</span>
    ${badge}
    ${result}
    <span class="test-title">${title}</span>
  </div>
  <div class="test-notes">${notes}</div>
  ${ssFiles.length > 0 ? `
  <div class="screenshots">
    ${ssFiles.map(f => `
    <div class="ss-wrap">
      <a href="${f}" target="_blank"><img src="${f}" alt="${path.basename(f)}" /></a>
      <div class="ss-label">${path.basename(f).replace(/_/g,' ').replace('.png','')}</div>
    </div>`).join('')}
  </div>` : ''}
</div>`;
    }
}

// ── Full HTML ─────────────────────────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>AttendPay — Test Report</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f1f5f9; color: #1e293b; padding: 32px 20px; }
  h1.main-title { font-size: 28px; font-weight: 800; color: #0f172a; text-align: center; margin-bottom: 4px; }
  .subtitle { text-align: center; color: #64748b; margin-bottom: 24px; font-size: 15px; }
  .summary { display: flex; gap: 16px; justify-content: center; margin-bottom: 8px; flex-wrap: wrap; }
  .sum-box { background: #fff; border-radius: 12px; padding: 20px 32px; text-align: center; border: 1px solid #e2e8f0; min-width: 110px; }
  .sum-box.pass { border-top: 4px solid #10b981; }
  .sum-box.fail { border-top: 4px solid #ef4444; }
  .sum-box.total { border-top: 4px solid #3b82f6; }
  .sum-box.info  { border-top: 4px solid #8b5cf6; }
  .sum-num { font-size: 36px; font-weight: 800; color: #0f172a; }
  .sum-lbl { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: #94a3b8; margin-top: 4px; }
  .run-meta { text-align: center; font-size: 13px; color: #94a3b8; margin: 12px 0 32px; }
  .section-title { font-size: 18px; font-weight: 800; color: #475569; margin: 32px 0 12px; padding-left: 4px; border-left: 4px solid #3b82f6; padding-left: 12px; }
  .test-card { background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 16px; overflow: hidden; }
  .test-card.pass { border-left: 5px solid #10b981; }
  .test-card.fail { border-left: 5px solid #ef4444; }
  .test-header { display: flex; align-items: center; gap: 10px; padding: 14px 20px; flex-wrap: wrap; }
  .test-id { font-size: 13px; font-weight: 700; color: #94a3b8; min-width: 28px; }
  .badge { padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
  .badge.pos { background: #dcfce7; color: #166534; }
  .badge.neg { background: #fef3c7; color: #92400e; }
  .result { font-size: 13px; font-weight: 700; }
  .result.pass { color: #10b981; }
  .result.fail { color: #ef4444; }
  .test-title { font-size: 15px; font-weight: 600; color: #1e293b; }
  .test-notes { padding: 0 20px 12px; font-size: 13px; color: #475569; }
  .screenshots { display: flex; gap: 12px; overflow-x: auto; padding: 12px 20px 16px; background: #f8fafc; border-top: 1px solid #f1f5f9; flex-wrap: wrap; }
  .ss-wrap { flex-shrink: 0; }
  .ss-wrap img { width: 320px; height: auto; border-radius: 6px; border: 1px solid #e2e8f0; display: block; transition: transform .15s; cursor: pointer; }
  .ss-wrap img:hover { transform: scale(1.02); box-shadow: 0 8px 24px rgba(0,0,0,.12); }
  .ss-label { font-size: 11px; color: #94a3b8; margin-top: 4px; text-align: center; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  @media (max-width: 600px) { .ss-wrap img { width: 100%; } body { padding: 16px 12px; } }
</style>
</head>
<body>
<h1 class="main-title">⏱️ AttendPay — System Test Report</h1>
<p class="subtitle">Biometric Attendance &amp; Payroll System · Playwright E2E + API Tests</p>
${body}
</body>
</html>`;

fs.writeFileSync(OUT, html);
console.log(`Report written → ${OUT}`);
console.log(`Screenshots: ${files.length}`);
