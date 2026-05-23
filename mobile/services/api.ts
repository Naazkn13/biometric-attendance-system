import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Assuming running locally, you might need to change this to your computer's IP address
// when testing on a real device.
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
  const response = await api.post('/api/auth/login', {
    username,
    password,
  });
  return response.data;
};

export const getMyProfile = async () => {
  const response = await api.get('/api/portal/my-profile');
  return response.data;
};

// Instead of a dedicated voice attendance endpoint, we use the device sync endpoint or log it
export const logVoiceInteraction = async (data) => {
  const response = await api.post('/api/voice/log', data);
  return response.data;
};

// Upload DAT file (Admin Sync)
export const uploadSyncFile = async (uri, name) => {
  const formData = new FormData();
  // Provide a minimal file-like object to React Native FormData
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
