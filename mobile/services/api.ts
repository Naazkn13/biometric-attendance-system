import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Set up for Railway backend in preview/prod
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

export const login = async (username, password) => {
  const formData = new FormData();
  formData.append('username', username);
  formData.append('password', password);
  const response = await api.post('/auth/token', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
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
  const response = await api.get('/api/employees/');
  return response.data;
};
