'use client';

import { useState, useEffect } from 'react';
import { getHolidays, createHoliday, updateHoliday, deleteHoliday } from '@/lib/api';

export default function HolidayMasterPage() {
    const currentYear = new Date().getFullYear();
    const [holidays, setHolidays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [showModal, setShowModal] = useState(false);
    const [editingHoliday, setEditingHoliday] = useState(null);
    const [form, setForm] = useState({ date: '', description: '' });
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const loadData = async () => {
        try {
            setError(null);
            const data = await getHolidays(selectedYear);
            setHolidays(data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [selectedYear]);

    const openCreate = () => {
        setEditingHoliday(null);
        setForm({ date: '', description: '' });
        setShowModal(true);
    };

    const openEdit = (holiday) => {
        setEditingHoliday(holiday);
        setForm({
            date: holiday.date,
            description: holiday.description || '',
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingHoliday) {
                await updateHoliday(editingHoliday.date, { description: form.description });
                setSuccess('Holiday updated successfully');
            } else {
                await createHoliday({
                    date: form.date,
                    description: form.description,
                });
                setSuccess('Holiday added successfully');
            }
            setShowModal(false);
            loadData();
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    };

    const handleDelete = async (dateStr) => {
        if (!confirm(`Remove holiday on ${dateStr}?`)) return;
        try {
            await deleteHoliday(dateStr);
            setSuccess('Holiday removed');
            loadData();
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    };

    const formatDate = (dateStr) => {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-IN', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    const isUpcoming = (dateStr) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const holidayDate = new Date(dateStr + 'T00:00:00');
        return holidayDate >= today;
    };

    const isPast = (dateStr) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const holidayDate = new Date(dateStr + 'T00:00:00');
        return holidayDate < today;
    };

    const years = [];
    for (let y = currentYear - 1; y <= currentYear + 2; y++) years.push(y);

    if (loading) return <div className="loading"><div className="spinner" /> Loading...</div>;

    const upcomingHolidays = holidays.filter(h => isUpcoming(h.date));
    const pastHolidays = holidays.filter(h => isPast(h.date));

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Holiday Master</h1>
                    <p>Manage paid holidays — these are treated as paid days off in payroll (same as Sundays)</p>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <select
                        className="form-input"
                        value={selectedYear}
                        onChange={(e) => { setSelectedYear(Number(e.target.value)); setLoading(true); }}
                        style={{ width: 120 }}
                    >
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <button className="btn btn-primary" onClick={openCreate}>+ Add Holiday</button>
                </div>
            </div>

            {error && <div className="alert alert-error">⚠️ {error}</div>}
            {success && <div className="alert alert-success">✅ {success}</div>}



            {/* Stats */}
            <div className="stats-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card">
                    <div className="stat-card-icon">🎉</div>
                    <div className="stat-card-value">{holidays.length}</div>
                    <div className="stat-card-label">Total Holidays ({selectedYear})</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-icon">📅</div>
                    <div className="stat-card-value">{upcomingHolidays.length}</div>
                    <div className="stat-card-label">Upcoming</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-icon">✅</div>
                    <div className="stat-card-value">{pastHolidays.length}</div>
                    <div className="stat-card-label">Past</div>
                </div>
            </div>

            {/* Holiday Table */}
            <div className="table-container">
                <div className="table-header">
                    <h2>Holidays in {selectedYear} ({holidays.length})</h2>
                </div>
                {holidays.length > 0 ? (
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Day</th>
                                <th>Holiday Name</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {holidays.map((h) => {
                                const d = new Date(h.date + 'T00:00:00');
                                const dayName = d.toLocaleDateString('en-IN', { weekday: 'long' });
                                const upcoming = isUpcoming(h.date);
                                return (
                                    <tr key={h.date}>
                                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {formatDate(h.date)}
                                        </td>
                                        <td>{dayName}</td>
                                        <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                                            🎉 {h.description || 'Unnamed Holiday'}
                                        </td>
                                        <td>
                                            <span className={`badge ${upcoming ? 'badge-info' : 'badge-success'}`}>
                                                {upcoming ? '📅 Upcoming' : '✅ Past'}
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => openEdit(h)}
                                                style={{ marginRight: 4 }}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() => handleDelete(h.date)}
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ) : (
                    <div className="empty-state">
                        <div className="empty-state-icon">🎉</div>
                        <h3>No holidays defined for {selectedYear}</h3>
                        <p>Add paid holidays so they are considered in payroll calculations.</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
                    <div className="modal">
                        <h2>{editingHoliday ? 'Edit Holiday' : 'Add Holiday'}</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label htmlFor="holiday-date">Date *</label>
                                <input
                                    id="holiday-date"
                                    type="date"
                                    className="form-input"
                                    required
                                    value={form.date}
                                    disabled={!!editingHoliday}
                                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="holiday-desc">Holiday Name *</label>
                                <input
                                    id="holiday-desc"
                                    className="form-input"
                                    required
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    placeholder="e.g., Republic Day, Diwali, Christmas"
                                />
                            </div>
                            <div className="alert alert-success" style={{ marginTop: 12 }}>
                                ℹ️ This holiday will be a <strong>paid day off</strong>. If someone works on this day, their hours = overtime.
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editingHoliday ? 'Update' : 'Add Holiday'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
