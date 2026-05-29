import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { tokenService } from './token.service';

const baseApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
export const API_URL = baseApiUrl.endsWith('/api') ? baseApiUrl : `${baseApiUrl.replace(/\/$/, '')}/api`;

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
    _retry?: boolean;
}

export const apiClient = axios.create({
    baseURL: API_URL,
    withCredentials: true
});

apiClient.interceptors.request.use((config) => {
    const token = tokenService.getAccessToken();

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as RetriableRequestConfig | undefined;
        const requestUrl = originalRequest?.url || '';
        const isAuthRefresh = requestUrl.includes('/auth/refresh');
        const isAuthLogout = requestUrl.includes('/auth/logout');

        if (
            error.response?.status !== 401 ||
            !originalRequest ||
            originalRequest._retry ||
            isAuthRefresh ||
            isAuthLogout
        ) {
            return Promise.reject(error);
        }

        originalRequest._retry = true;

        try {
            const response = await apiClient.post('/auth/refresh');
            const nextToken = response.data?.data?.token;

            if (!nextToken) {
                tokenService.clearAccessToken();
                return Promise.reject(error);
            }

            tokenService.setAccessToken(nextToken);
            originalRequest.headers.Authorization = `Bearer ${nextToken}`;
            return apiClient(originalRequest);
        } catch (refreshError) {
            tokenService.clearAccessToken();
            return Promise.reject(refreshError);
        }
    }
);
