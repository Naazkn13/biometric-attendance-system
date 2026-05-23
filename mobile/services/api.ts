import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.194:8000';

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
  const response = await api.get(`/api/attendance/sessions?year=${year}&month=${month}`);
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

