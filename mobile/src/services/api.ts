import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_URL } from "../utils/constants";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "auth_token";
export const DEFAULT_TIMEOUT = 15000;

export class TimeoutError extends Error {
  constructor(timeout: number) {
    super(`Request timed out after ${timeout}ms`);
    this.name = "TimeoutError";
  }
}

interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  signal?: AbortSignal;
}

const axiosInstance = axios.create({
  baseURL: API_URL,
  timeout: DEFAULT_TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  }
});

// Request Interceptor: Attach JWT Token
axiosInstance.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // Ignore SecureStore errors gracefully
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response Interceptor: Format Errors & Timeouts
axiosInstance.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      const timeout = error.config?.timeout || DEFAULT_TIMEOUT;
      throw new TimeoutError(timeout as number);
    }
    
    if (axios.isCancel(error)) {
      throw new Error("Request was cancelled");
    }
    
    const serverMessage = (error.response?.data as any)?.message;
    if (serverMessage) {
      throw new Error(serverMessage);
    }
    
    throw new Error(error.message || `HTTP ${error.response?.status}`);
  }
);

export const api = {
  get: async <T = any>(endpoint: string, options?: RequestOptions): Promise<T> => {
    const res = await axiosInstance.get<T>(endpoint, options);
    return res.data;
  },
  post: async <T = any>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> => {
    const res = await axiosInstance.post<T>(endpoint, body, options);
    return res.data;
  },
  put: async <T = any>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> => {
    const res = await axiosInstance.put<T>(endpoint, body, options);
    return res.data;
  },
  delete: async <T = any>(endpoint: string, options?: RequestOptions): Promise<T> => {
    const res = await axiosInstance.delete<T>(endpoint, options);
    return res.data;
  },
};
