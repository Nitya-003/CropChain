import { API_URL } from '../utils/constants';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api';
const TOKEN_KEY = 'auth_token';

interface RequestOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

async function getHeaders(headers: Record<string, string> = {}): Promise<Record<string, string>> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const config: RequestInit = {
    method,
    headers: await getHeaders(headers),
  };

  if (body) config.body = JSON.stringify(body);

  const response = await fetch(`${API_URL}${endpoint}`, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),
  post: <T>(endpoint: string, body: any) => request<T>(endpoint, { method: 'POST', body }),
  put: <T>(endpoint: string, body: any) => request<T>(endpoint, { method: 'PUT', body }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};