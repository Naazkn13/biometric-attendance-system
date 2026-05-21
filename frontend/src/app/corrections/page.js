'use client';

import { useState, useEffect } from 'react';
import { getOverrides, createOverride, deactivateOverride, getEmployees, getCorrectionLog } from '@/lib/api';

const TYPE_LABELS = {
    SET_PUNCH_OUT: 'Set Punch Out',
    SET_PUNCH_IN: 'Set Punch In',
    SET_BOTH: 'Set Both',
    MARK_ABSENT: 'Mark Absent',
    MARK_PRESENT: 'Mark Present',
    OVERRIDE_HOURS: 'Override Hours',
};

const EMPTY_ROW = () => ({
    key: Math.random(),
    date: '',
    type: 'SET_PUNCH_OUT',
    punch_in_time: '',
    punch_out_time: '',
    net_hours: '',
});

function needsIn(type) { return ['SET_PUNCH_IN', 'SET_BOTH'].includes(type); }
function needsOut(type) { return ['SET_PUNCH_OUT', 'SET_BOTH'].includes(type); }
function needsHours(type) { return ['MARK_PRESENT', 'OVERRIDE_HOURS'].includes(type); }

export default function CorrectionsPage() {
    const [overrides, setOverrides] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [log, setLog] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showLog, setShowLog] = useState(false);

    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);

    const [employeeId, setEmployeeId] = useState('');
    const [reason, setReason] = useState('');
    const [rows, setRows] = useState([EMPTY_ROW()]);
    const [submitting, setSubmitting] = useState(false);

    const loadData = async () => {
        try {
            const [ovr, emp] = await Promise.all([
                getOverrides({ is_active: true }),
                getEmployees(true),
            ]);
            setOverrides(ovr || []);
            setEmployees(emp || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const loadLog = async () => {
        try {
            const data = await getCorrectionLog();
            setLog(data || []);
        } catch (e) {
            setLog([]);
        }
        setShowLog(true);
    };

    const updateRow = (key, field, value) => {
        setRows(prev => prev.map(r => r.key === key ? { ...r, [field]: value } : r));
    };

    const removeRow = (key) => {
        setRows(prev => prev.length > 1 ? prev.filter(r => r.key !== key) : prev);
    };

    const openModal = () => {
        setEmployeeId('');
        setReason('');
        setRows([EMPTY_ROW()]);
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate all rows
        for (const row of rows) {
            if (!row.date) { alert('Each row must have a date.'); return; }
            if (needsIn(row.type) && !row.punch_in_time) { alert(`Row ${row.date}: Punch In time is required.`); return; }
            if (needsOut(row.type) && !row.punch_out_time) { alert(`Row ${row.date}: Punch Out time is required.`); return; }
            if (needsHours(row.type) && !row.net_hours) { alert(`Row ${row.date}: Net Hours is required.`); return; }

            if (needsIn(row.type) && needsOut(row.type) && row.punch_in_time && row.punch_out_time) {
                const inT = new Date(`${row.date}T${row.punch_in_time}`);
                const outT = new Date(`${row.date}T${row.punch_out_time}`);
                if (outT <= inT) { alert(`Row ${row.date}: Punch Out must be after Punch In.`); return; }
            }
        }

        setSubmitting(true);
        try {
            const promises = rows.map(row => {
                const payload = {
                    employee_id: employeeId,
                    session_date: row.date,
                    override_type: row.type,
                    reason,
                };
                // Build timestamps from date + time — guarantees date always matches session_date
                if (needsIn(row.type) && row.punch_in_time) {
                    payload.override_punch_in = new Date(`${row.date}T${row.punch_in_time}`).toISOString();
                }
                if (needsOut(row.type) && row.punch_out_time) {
                    payload.override_punch_out = new Date(`${row.date}T${row.punch_out_time}`).toISOString();
                }
                if (needsHours(row.type) && row.net_hours) {
                    payload.override_net_hours = parseFloat(row.net_hours);
                }
                return createOverride(payload);
            });

            await Promise.all(promises);
            setShowModal(false);
            loadData();
        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeactivate = async (id) => {
        if (!confirm('Deactivate this override?')) return;
        try {
            await deactivateOverride(id);
            loadData();
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    };

    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    const filteredOverrides = overrides.filter(o => {
        if (!o.session_date) return false;
        const d = new Date(o.session_date);
        return d.getFullYear() === year && (d.getMonth() + 1) === month;
    });

    if (loading) return <div className="loading"><div className="spinner" /> Loading...</div>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Admin Corrections</h1>
                    <p>Override attendance sessions that survive recalculation</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary" onClick={loadLog}>📋 Audit Log</button>
                    <button className="btn btn-primary" onClick={openModal}>+ New Correction</button>
                </div>
            </div>

            <div className="alert alert-success" style={{ marginBottom: 24 }}>
                💡 Overrides are keyed on <strong>employee + date</strong>, not session ID. They survive recalculation.
            </div>

            {/* Active Overrides */}
            <div className="table-container">
                <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2>Active Overrides ({filteredOverrides.length})</h2>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <select className="form-select" value={month} onChange={(e) => setMonth(Number(e.target.value))} style={{ padding: '6px 12px', height: 'auto' }}>
                            {monthNames.map((name, i) => <option key={i} value={i + 1}>{name}</option>)}
                        </select>
                        <input type="number" className="form-input" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: '80px', padding: '6px 12px', height: 'auto' }} />
                    </div>
                </div>
                {filteredOverrides.length > 0 ? (
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Employee</th>
                                <th>Type</th>
                                <th>Override Values</th>
                                <th>Reason</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredOverrides.map((o) => {
                                const emp = employees.find(e => e.id === o.employee_id);
                                return (
                                    <tr key={o.id}>
                                        <td style={{ fontWeight: 600 }}>{o.session_date}</td>
                                        <td style={{ color: 'var(--text-primary)' }}>{emp?.name || o.employee_id?.slice(0, 8)}</td>
                                        <td><span className="badge badge-info">{TYPE_LABELS[o.override_type] || o.override_type}</span></td>
                                        <td style={{ fontSize: 12, fontFamily: 'monospace' }}>
                                            {o.override_punch_in && `IN: ${new Date(o.override_punch_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
                                            {o.override_punch_in && o.override_punch_out && ' | '}
                                            {o.override_punch_out && `OUT: ${new Date(o.override_punch_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
                                            {o.override_net_hours && `Hours: ${o.override_net_hours}h`}
                                        </td>
                                        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.reason}</td>
                                        <td>{new Date(o.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</td>
                                        <td>
                                            <button className="btn btn-danger btn-sm" onClick={() => handleDeactivate(o.id)}>Revoke</button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ) : (
                    <div className="empty-state">
                        <div className="empty-state-icon">✏️</div>
                        <h3>No active overrides</h3>
                        <p>Create corrections for attendance sessions that need admin adjustment.</p>
                    </div>
                )}
            </div>

            {/* Create Override Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
                    <div className="modal" style={{ maxWidth: 820 }}>
                        <h2>New Correction</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Employee *</label>
                                    <select className="form-select" required value={employeeId}
                                        onChange={(e) => setEmployeeId(e.target.value)}>
                                        <option value="">— Select —</option>
                                        {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Reason *</label>
                                    <input type="text" className="form-input" required value={reason}
                                        placeholder="e.g. Device missed punch-out"
                                        onChange={(e) => setReason(e.target.value)} />
                                </div>
                            </div>

                            {/* Per-date correction rows */}
                            <div style={{ marginTop: 8 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <label style={{ fontWeight: 600, fontSize: 14 }}>Dates to Correct *</label>
                                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: 13 }}
                                        onClick={() => setRows(prev => [...prev, EMPTY_ROW()])}>
                                        + Add Date
                                    </button>
                                </div>

                                {/* Header */}
                                <div style={{ display: 'grid', gridTemplateColumns: '130px 150px 100px 100px 80px 32px', gap: 6, marginBottom: 4, padding: '0 4px' }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Date</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Type</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>In Time</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Out Time</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Hours</span>
                                    <span />
                                </div>

                                {rows.map((row) => (
                                    <div key={row.key} style={{ display: 'grid', gridTemplateColumns: '130px 150px 100px 100px 80px 32px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                                        <input
                                            type="date"
                                            className="form-input"
                                            value={row.date}
                                            onChange={(e) => updateRow(row.key, 'date', e.target.value)}
                                            style={{ padding: '6px 8px', fontSize: 13 }}
                                        />
                                        <select
                                            className="form-select"
                                            value={row.type}
                                            onChange={(e) => updateRow(row.key, 'type', e.target.value)}
                                            style={{ padding: '6px 8px', fontSize: 13, height: 'auto' }}
                                        >
                                            {Object.entries(TYPE_LABELS).map(([val, label]) => (
                                                <option key={val} value={val}>{label}</option>
                                            ))}
                                        </select>
                                        <input
                                            type="time"
                                            className="form-input"
                                            value={row.punch_in_time}
                                            disabled={!needsIn(row.type)}
                                            onChange={(e) => updateRow(row.key, 'punch_in_time', e.target.value)}
                                            style={{ padding: '6px 8px', fontSize: 13, opacity: needsIn(row.type) ? 1 : 0.25 }}
                                        />
                                        <input
                                            type="time"
                                            className="form-input"
                                            value={row.punch_out_time}
                                            disabled={!needsOut(row.type)}
                                            onChange={(e) => updateRow(row.key, 'punch_out_time', e.target.value)}
                                            style={{ padding: '6px 8px', fontSize: 13, opacity: needsOut(row.type) ? 1 : 0.25 }}
                                        />
                                        <input
                                            type="number"
                                            step="0.5"
                                            min="0"
                                            className="form-input"
                                            value={row.net_hours}
                                            disabled={!needsHours(row.type)}
                                            placeholder="h"
                                            onChange={(e) => updateRow(row.key, 'net_hours', e.target.value)}
                                            style={{ padding: '6px 8px', fontSize: 13, opacity: needsHours(row.type) ? 1 : 0.25 }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeRow(row.key)}
                                            disabled={rows.length === 1}
                                            style={{ background: 'none', border: 'none', color: rows.length === 1 ? '#cbd5e1' : '#ef4444', cursor: rows.length === 1 ? 'default' : 'pointer', fontSize: 18, lineHeight: 1, padding: 0 }}
                                        >×</button>
                                    </div>
                                ))}
                            </div>

                            <div className="modal-actions" style={{ marginTop: 16 }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>
                                    {submitting ? 'Saving...' : `Create ${rows.length > 1 ? `${rows.length} Overrides` : 'Override'}`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Audit Log Modal */}
            {showLog && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowLog(false)}>
                    <div className="modal" style={{ maxWidth: 820 }}>
                        <h2>Correction Audit Log</h2>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                            Full history of every correction created, revoked, or superseded.
                        </p>
                        {log.length > 0 ? (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ fontSize: 13, width: '100%' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ whiteSpace: 'nowrap' }}>Action</th>
                                            <th>Employee</th>
                                            <th style={{ whiteSpace: 'nowrap' }}>Session Date</th>
                                            <th>Type</th>
                                            <th style={{ whiteSpace: 'nowrap' }}>Done By</th>
                                            <th style={{ whiteSpace: 'nowrap' }}>When</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {log.map((entry) => {
                                            const ov = entry.session_overrides;
                                            const empName = ov?.employees?.name || '—';
                                            const sessionDate = ov?.session_date || '—';
                                            const ovType = ov?.override_type
                                                ? (TYPE_LABELS[ov.override_type] || ov.override_type)
                                                : '—';
                                            const doneBy = entry.performed_by_name || '—';
                                            const actionClass = entry.action === 'CREATED' ? 'badge-success'
                                                : entry.action === 'DEACTIVATED' ? 'badge-error'
                                                : 'badge-warning';
                                            return (
                                                <tr key={entry.id}>
                                                    <td><span className={`badge ${actionClass}`}>{entry.action}</span></td>
                                                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{empName}</td>
                                                    <td style={{ fontFamily: 'monospace' }}>{sessionDate}</td>
                                                    <td><span className="badge badge-info" style={{ fontSize: 11 }}>{ovType}</span></td>
                                                    <td style={{ color: 'var(--text-secondary)' }}>{doneBy}</td>
                                                    <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                        {new Date(entry.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : <p style={{ color: 'var(--text-muted)' }}>No audit entries yet.</p>}
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowLog(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
