import { api } from './api';
import * as SecureStore from 'expo-secure-store';
import type { User } from '../types';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

async function getToken(): Promise<string | null> {
  try { return await SecureStore.getItemAsync(TOKEN_KEY); } catch { return null; }
}

async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

async function clearToken(): Promise<void> {
  try { await SecureStore.deleteItemAsync(TOKEN_KEY); } catch {}
}

async function getStoredUser(): Promise<User | null> {
  try {
    const data = await SecureStore.getItemAsync(USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

async function storeUser(user: User): Promise<void> {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

async function clearUser(): Promise<void> {
  try { await SecureStore.deleteItemAsync(USER_KEY); } catch {}
}

export const authService = {
  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const res = await api.post<{ data: { user: User; token: string } }>('/auth/login', { email, password });
    const authData = res.data.data;
    await setToken(authData.token);
    await storeUser(authData.user);
    return authData;
  },

  async register(name: string, email: string, password: string, role: string): Promise<{ user: User; token: string }> {
    const res = await api.post<{ data: { user: User; token: string } }>('/auth/register', { name, email, password, role });
    const authData = res.data.data;
    await setToken(authData.token);
    await storeUser(authData.user);
    return authData;
  },

  async logout(): Promise<void> {
    try { await api.post('/auth/logout', {}); } catch {}
    await clearToken();
    await clearUser();
  },

  async refreshSession(): Promise<User | null> {
    try {
      const res = await api.post<{ data: { user: User; token: string } }>('/auth/refresh');
      const authData = res.data.data;
      await setToken(authData.token);
      await storeUser(authData.user);
      return authData.user;
    } catch {
      await clearToken();
      await clearUser();
      return null;
    }
  },

  async getStoredUser(): Promise<User | null> {
    return getStoredUser();
  },

  async getToken(): Promise<string | null> {
    return getToken();
  },
};
