import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.104:8000';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Auth ──
export const login = async (username: string, password: string) => {
  const response = await api.post('/api/auth/login', { username, password });
  return response.data;
};

// ── Employee Portal ──
export const getMyProfile = async () => {
  const response = await api.get('/api/portal/my-profile');
  return response.data;
};

export const getMyAttendance = async (year: number, month: number) => {
  const response = await api.get(`/api/portal/my-attendance?year=${year}&month=${month}`);
  return response.data;
};

export const getMyPayslips = async (year?: number, month?: number) => {
  let url = '/api/portal/my-payslips';
  const params: string[] = [];
  if (year) params.push(`year=${year}`);
  if (month) params.push(`month=${month}`);
  if (params.length) url += '?' + params.join('&');
  const response = await api.get(url);
  return response.data;
};

export const getMyPayslipDetail = async (periodStart: string) => {
  const response = await api.get(`/api/portal/my-payslip/${periodStart}`);
  return response.data;
};

// ── Leaves (Employee) ──
export const getMyLeaves = async (year?: number, month?: number) => {
  let url = '/api/leaves/my-leaves';
  const params: string[] = [];
  if (year) params.push(`year=${year}`);
  if (month) params.push(`month=${month}`);
  if (params.length) url += '?' + params.join('&');
  const response = await api.get(url);
  return response.data;
};

export const getMyLeaveBalance = async (year: number, month: number) => {
  const response = await api.get(`/api/leaves/my-balance?year=${year}&month=${month}`);
  return response.data;
};

export const applyLeave = async (data: { leave_date: string, leave_end_date?: string, leave_type: string, reason: string }) => {
  const response = await api.post('/api/leaves/apply', data);
  return response.data;
};

// ── Admin ──
export const getEmployees = async () => {
  const response = await api.get('/api/employees');
  return response.data;
};

export const getTodayAttendance = async () => {
  const response = await api.get('/api/attendance/today');
  return response.data;
};

export const getAttendanceSessions = async (year: number, month: number) => {
  const date_from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const date_to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const response = await api.get('/api/attendance/sessions', { params: { date_from, date_to } });
  return response.data;
};

// ── Leaves (Admin) ──
export const getPendingLeaves = async () => {
  const response = await api.get('/api/leaves/pending');
  return response.data;
};

export const getAllLeaves = async (year?: number, month?: number, status?: string) => {
  let url = '/api/leaves/all';
  const params: string[] = [];
  if (year) params.push(`year=${year}`);
  if (month) params.push(`month=${month}`);
  if (status) params.push(`status=${status}`);
  if (params.length) url += '?' + params.join('&');
  const response = await api.get(url);
  return response.data;
};

export const approveLeave = async (leaveId: string) => {
  const response = await api.post(`/api/leaves/${leaveId}/approve`);
  return response.data;
};

export const rejectLeave = async (leaveId: string, rejection_reason: string) => {
  const response = await api.post(`/api/leaves/${leaveId}/reject`, { rejection_reason });
  return response.data;
};

// ── Payslips (Admin) ──
export const getAllPayslips = async (year: number, month: number) => {
  const date_from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const date_to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const response = await api.get('/api/payroll', { params: { period_start: date_from, period_end: date_to, status: 'FINAL' } });
  return response.data;
};

// ── Corrections (Admin) ──
export const getOverrides = async () => {
  const response = await api.get('/api/overrides');
  return response.data;
};

export const createOverride = async (payload: any) => {
  const response = await api.post('/api/overrides', payload);
  return response.data;
};

export const deactivateOverride = async (overrideId: string) => {
  const response = await api.put(`/api/overrides/${overrideId}/deactivate`);
  return response.data;
};

// ── Holidays ──
export const getHolidays = async () => {
  const response = await api.get('/api/holidays/all');
  return response.data;
};

// ── Voice AI ──
export const logVoiceInteraction = async (data: any) => {
  const response = await api.post('/api/voice/log', data);
  return response.data;
};

// Upload DAT file (Admin Sync)
export const uploadSyncFile = async (uri: string, name?: string) => {
  const formData = new FormData();
  formData.append('file', {
    uri,
    name: name || 'manual_sync.dat',
    type: 'application/octet-stream',
  } as any);
  formData.append('device_sn', 'MANUAL_USB');

  const response = await api.post('/api/sync/upload-dat', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

