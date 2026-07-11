import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Set up for Railway backend in preview/prod
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://biometric-attendance-system-production.up.railway.app';

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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUTH
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const login = async (username: string, password: string) => {
  const response = await api.post('/api/auth/login', { username, password });
  return response.data;
};

export const getMyProfile = async () => {
  const response = await api.get('/api/auth/me');
  return response.data;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PUNCH LOG VIEWER API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const getPunchesByDate = async (date?: string) => {
  const url = date ? `/api/attendance/punch-log/by-date?date=${date}` : '/api/attendance/punch-log/by-date';
  const response = await api.get(url);
  return response.data;
};

export const getPunchesByEmployee = async (employeeId: string, month: number, year: number) => {
  const response = await api.get(`/api/attendance/punch-log/by-employee?employee_id=${employeeId}&month=${month}&year=${year}`);
  return response.data;
};

export const getPunchesByEmployeeDate = async (employeeId: string, date: string) => {
  const response = await api.get(`/api/attendance/punch-log/by-employee-date?employee_id=${employeeId}&date=${date}`);
  return response.data;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EMPLOYEES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const getEmployees = async () => {
  const response = await api.get('/api/employees');
  return response.data;
};
