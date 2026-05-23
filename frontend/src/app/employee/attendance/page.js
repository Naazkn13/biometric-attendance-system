'use client';

import { useState, useEffect } from 'react';
import { getMyAttendance, getMyProfile, getMyPayslips } from '@/lib/api';

export default function EmployeeAttendancePage() {
    const [attendance, setAttendance] = useState([]);
    const [payslip, setPayslip] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [attendanceData, profileData, payslipData] = await Promise.all([
                getMyAttendance(year, month),
                getMyProfile(),
                getMyPayslips(year, month)
            ]);
            setAttendance(attendanceData || []);
            setProfile(profileData || null);
            setPayslip((payslipData && payslipData.length > 0) ? payslipData[0] : null);
        } catch (err) {
            setError(err.message || 'Failed to load attendance');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [year, month]);

    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    const formatTime = (isoString) => {
        if (!isoString) return '--:--';
        return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getStatusBadgeClass = (status) => {
        switch(status) {
            case 'COMPLETE': return { bg: '#dcfce7', text: '#166534' };
            case 'MISSING_OUT': return { bg: '#fee2e2', text: '#991b1b' };
            case 'AUTO_CHECKOUT': return { bg: '#fef3c7', text: '#92400e' };
            default: return { bg: '#f1f5f9', text: '#475569' };
        }
    };

    const daysInMonth = new Date(year, month, 0).getDate();
    const perDaySalary = profile?.basic_salary ? (profile.basic_salary / daysInMonth).toFixed(2) : '0.00';
    
    // Calculate Estimated Pay
    const presentDays = attendance.filter(s => s.status !== 'ABSENT').length;
    const baseEstimatedPay = (presentDays * parseFloat(perDaySalary)).toFixed(2);

    // Calculate Totals for Breakdown
    let totalBreakdownHours = 0;
    let totalBreakdownOT = 0;
    let totalBreakdownDeficit = 0;
    let totalBreakdownPay = 0;

    if (payslip?.calculation_details?.daily_breakdown) {
        payslip.calculation_details.daily_breakdown.forEach(day => {
            totalBreakdownHours += (day.total_hours || 0);
            totalBreakdownOT += (day.overtime_hours || 0);
            if (!day.is_sunday && !day.is_leave) {
                totalBreakdownDeficit += (day.deficit_hours || 0);
            }
            totalBreakdownPay += (day.total_day_pay || 0);
        });
    }

    const cardStyle = {
        background: '#ffffff', borderRadius: '16px', padding: '24px',
        border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: '24px'
    };

    const inputStyle = {
        padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px',
        fontSize: '14px', fontFamily: 'inherit', color: '#0f172a', background: '#fff'
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#1e293b' }}>My Attendance</h2>
                    <p style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>View your daily punch records</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={inputStyle}>
                        {monthNames.map((name, i) => <option key={i} value={i + 1}>{name}</option>)}
                    </select>
                    <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ ...inputStyle, width: '90px' }} />
                </div>
            </div>

            {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #fca5a5' }}>❌ {error}</div>}

            {!loading && profile?.basic_salary && !payslip && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ ...cardStyle, marginBottom: 0 }}>
                        <div style={{ fontSize: '28px', fontWeight: 800, color: '#16a34a' }}>
                            ₹{baseEstimatedPay}
                        </div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px', fontWeight: 600 }}>Base Estimated Pay</div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>* Additions/Deductions not included</div>
                    </div>
                    <div style={{ ...cardStyle, marginBottom: 0 }}>
                        <div style={{ fontSize: '28px', fontWeight: 800, color: '#1e293b' }}>
                            {presentDays} <span style={{ fontSize: '16px', color: '#94a3b8' }}>/ {daysInMonth}</span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px', fontWeight: 600 }}>Days Present</div>
                        {profile?.basic_salary && (
                            <div style={{ marginTop: '8px', fontSize: '12px', background: '#e0f2fe', color: '#0284c7', padding: '4px 8px', borderRadius: '6px', display: 'inline-block', fontWeight: 600 }}>
                                Per Day Rate: ₹{perDaySalary}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Finalized Payroll Breakdown Table */}
            {payslip?.calculation_details?.daily_breakdown ? (
                <div style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '16px' }}>
                        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>Finalized Payroll Breakdown</h2>
                        <span style={{ fontSize: '12px', background: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: '6px', fontWeight: 700 }}>FINALIZED</span>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', color: '#1e293b' }}>
                            <thead style={{ background: '#f8fafc' }}>
                                <tr>
                                    <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Date</th>
                                    <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0', textAlign: 'left', fontWeight: 600, color: '#475569' }}>In</th>
                                    <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Out</th>
                                    <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0', textAlign: 'right', fontWeight: 600, color: '#475569' }}>Hours</th>
                                    <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0', textAlign: 'right', fontWeight: 600, color: '#475569' }}>OT/Deficit</th>
                                    <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0', textAlign: 'right', fontWeight: 600, color: '#475569' }}>Day Pay</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payslip.calculation_details.daily_breakdown.map((day, idx) => {
                                    const isSunday = day.is_sunday;
                                    const isLeave = day.is_leave;
                                    const isPaidLeave = isLeave && day.total_day_pay > 0;
                                    
                                    const sessions = day.sessions || [];
                                    const firstSession = sessions[0] || {};
                                    const lastSession = sessions[sessions.length - 1] || {};

                                    const inTime = firstSession.punch_in ? new Date(firstSession.punch_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
                                    const outTime = lastSession.punch_out ? new Date(lastSession.punch_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';

                                    let rowBg = 'transparent';
                                    if (isSunday) rowBg = '#f8fafc';
                                    if (isLeave) rowBg = isPaidLeave ? '#f0fdf4' : '#fef2f2';

                                    return (
                                        <tr key={idx} style={{ backgroundColor: rowBg, borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '12px 16px', fontWeight: 500, color: isSunday ? '#64748b' : '#1e293b' }}>
                                                {day.date} <span style={{ color: '#94a3b8' }}>{isSunday ? '(Sun)' : new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                                            </td>
                                            <td colSpan={2} style={{ padding: '12px 16px', textAlign: 'center' }}>
                                                {isSunday ? <span style={{ color: '#94a3b8' }}>—</span> : isLeave ? (
                                                    <span style={{ color: isPaidLeave ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                                                        {isPaidLeave ? 'Paid Leave' : 'Unpaid Leave (LOP)'}
                                                    </span>
                                                ) : (
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', color: '#334155' }}>
                                                        <span>{inTime}</span>
                                                        <span>{outTime}</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: day.total_hours > 0 ? '#16a34a' : '#64748b' }}>
                                                {isSunday || isLeave ? '—' : `${(day.total_hours || 0).toFixed(2)}h`}
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px' }}>
                                                {day.overtime_hours > 0 ? (
                                                    <span style={{ color: '#0284c7', fontWeight: 600 }}>+{(day.overtime_hours).toFixed(2)}h OT</span>
                                                ) : day.deficit_hours > 0 && !isSunday && !isLeave ? (
                                                    <span style={{ color: '#dc2626', fontWeight: 600 }}>-{(day.deficit_hours).toFixed(2)}h</span>
                                                ) : <span style={{ color: '#94a3b8' }}>—</span>}
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                                                ₹{Number(day.total_day_pay || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr style={{ background: '#f1f5f9', borderTop: '2px solid #cbd5e1' }}>
                                    <td colSpan={3} style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, color: '#1e293b', fontSize: '14px' }}>Total for Month:</td>
                                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, color: '#16a34a', fontSize: '14px' }}>
                                        {totalBreakdownHours.toFixed(2)}h
                                    </td>
                                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, fontSize: '13px' }}>
                                        {totalBreakdownOT > 0 && <span style={{ color: '#0284c7', display: 'block' }}>+{totalBreakdownOT.toFixed(2)}h OT</span>}
                                        {totalBreakdownDeficit > 0 && <span style={{ color: '#dc2626', display: 'block' }}>-{totalBreakdownDeficit.toFixed(2)}h</span>}
                                        {totalBreakdownOT === 0 && totalBreakdownDeficit === 0 && <span style={{ color: '#94a3b8' }}>—</span>}
                                    </td>
                                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: '15px' }}>
                                        ₹{totalBreakdownPay.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            ) : (
                <div style={cardStyle}>
                    <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '16px' }}>
                        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>Punch Records ({attendance.length})</h2>
                    </div>
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading...</div>
                    ) : attendance.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                            <div style={{ fontSize: '32px', marginBottom: '12px' }}>📅</div>
                            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>No Records Found</h3>
                            <p style={{ fontSize: '13px', marginTop: '4px' }}>No attendance data exists for {monthNames[month - 1]} {year}.</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', color: '#1e293b' }}>
                                <thead style={{ background: '#f8fafc' }}>
                                    <tr>
                                        <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Date</th>
                                        <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0', textAlign: 'left', fontWeight: 600, color: '#475569' }}>In</th>
                                        <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Out</th>
                                        <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0', textAlign: 'right', fontWeight: 600, color: '#475569' }}>Hours</th>
                                        <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0', textAlign: 'right', fontWeight: 600, color: '#475569' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {attendance.map((session) => {
                                        const dateObj = new Date(session.session_date);
                                        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                                        const badge = getStatusBadgeClass(session.status);
                                        
                                        return (
                                            <tr key={session.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                                                    {session.session_date} <span style={{ color: '#94a3b8' }}>({dayName})</span>
                                                </td>
                                                <td style={{ padding: '12px 16px', color: '#334155' }}>
                                                    {formatTime(session.punch_in_time)}
                                                </td>
                                                <td style={{ padding: '12px 16px', color: '#334155' }}>
                                                    {formatTime(session.punch_out_time)}
                                                </td>
                                                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: session.net_hours > 0 ? '#16a34a' : 'inherit' }}>
                                                    {session.net_hours}h
                                                </td>
                                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                                    <span style={{ backgroundColor: badge.bg, color: badge.text, padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>
                                                        {session.status.replace('_', ' ')}
                                                    </span>
                                                    {session.has_override && (
                                                        <span style={{ marginLeft: '8px', fontSize: '11px', background: '#e0f2fe', color: '#0284c7', padding: '4px 8px', borderRadius: '6px', fontWeight: 600 }}>
                                                            Overridden
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
            <style jsx>{`
                tr:hover td {
                    background-color: transparent !important;
                }
            `}</style>
        </div>
    );
}
