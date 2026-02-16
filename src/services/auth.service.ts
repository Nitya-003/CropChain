import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export interface User {
    id: string;
    name: string;
    email: string;
    role: 'farmer' | 'transporter' | 'admin';
    walletAddress?: string;
    verification?: {
        isVerified: boolean;
        verifiedAt?: string;
        credentialHash?: string;
    };
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface RegisterCredentials {
    name: string;
    email: string;
    password: string;
    role: 'farmer' | 'transporter' | 'admin';
}

interface AuthResponse {
    success: boolean;
    token: string;
    user: User;
    message: string;
}

export const authService = {
    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        const response = await axios.post<{ data: AuthResponse }>(`${API_URL}/auth/login`, credentials);
        return response.data.data;
    },

    async register(credentials: RegisterCredentials): Promise<AuthResponse> {
        const response = await axios.post<{ data: AuthResponse }>(`${API_URL}/auth/register`, credentials);
        return response.data.data;
    },

    logout() {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
    },

    getCurrentUser(): User | null {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                return JSON.parse(userStr);
            } catch (e) {
                return null;
            }
        }
        return null;
    }
};
