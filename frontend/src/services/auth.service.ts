import { apiClient } from './apiClient';
import { tokenService } from './token.service';

export interface User {
    id: string;
    name: string;
    email: string;
    role: 'farmer' | 'mandi' | 'transporter' | 'retailer' | 'admin' | '';
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
    role: 'farmer' | 'mandi' | 'transporter' | 'retailer';
}

export interface WalletLoginCredentials {
    address: string;
    signature: string;
    nonce?: string;
}

export interface WalletRegisterCredentials {
    name: string;
    email: string;
    walletAddress: string;
    signature: string;
    nonce?: string;
    role: 'farmer' | 'mandi' | 'transporter' | 'retailer';
}

interface AuthResponse {
    success: boolean;
    token: string;
    user: User;
    message: string;
}

interface NonceResponse {
    success: boolean;
    data: {
        nonce: string;
    };
    message: string;
}

export const authService = {
    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        const response = await apiClient.post<{ data: AuthResponse }>('/auth/login', credentials);
        tokenService.setAccessToken(response.data.data.token);
        return response.data.data;
    },

    async register(credentials: RegisterCredentials): Promise<AuthResponse> {
        const response = await apiClient.post<{ data: AuthResponse }>('/auth/register', credentials);
        tokenService.setAccessToken(response.data.data.token);
        return response.data.data;
    },

    /**
     * Get a nonce for wallet authentication
     * This should be called before signing the message
     */
    async getNonce(address: string): Promise<string> {
        const response = await apiClient.get<NonceResponse>('/auth/nonce', {
            params: { address }
        });
        return response.data.data.nonce;
    },

    /**
     * Authenticate with wallet signature
     * Flow:
     * 1. Get nonce from backend
     * 2. User signs nonce with wallet
     * 3. Send address and signature to backend
     * 4. Backend verifies signature and returns JWT with user role
     */
    async walletLogin(credentials: WalletLoginCredentials): Promise<AuthResponse> {
        const response = await apiClient.post<{ data: AuthResponse }>('/auth/wallet-login', credentials);
        tokenService.setAccessToken(response.data.data.token);
        return response.data.data;
    },

    /**
     * Register a new wallet user
     * Similar to wallet login but creates a new user
     */
    async walletRegister(credentials: WalletRegisterCredentials): Promise<AuthResponse> {
        const response = await apiClient.post<{ data: AuthResponse }>('/auth/wallet-register', credentials);
        tokenService.setAccessToken(response.data.data.token);
        return response.data.data;
    },

    async refreshSession(): Promise<AuthResponse> {
        const response = await apiClient.post<{ data: AuthResponse }>('/auth/refresh');
        tokenService.setAccessToken(response.data.data.token);
        return response.data.data;
    },

    async forgotPassword(email: string): Promise<any> {
        const response = await apiClient.post('/auth/forgot-password', { email });
        return response.data;
    },

    async resetPassword(token: string, password: string): Promise<any> {
        const response = await apiClient.post(`/auth/reset-password/${token}`, { password });
        return response.data;
    },

    async logout() {
        try {
            await apiClient.post('/auth/logout');
        } finally {
            tokenService.clearAccessToken();
        }
        localStorage.removeItem('user');
    },

    async updateProfile(data: Record<string, any>): Promise<{ user: User }> {
        const response = await apiClient.put<{ data: { user: User } }>('/auth/profile', data);
        return response.data.data;
    },

    getCurrentUser(): User | null {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                return JSON.parse(userStr);
            } catch {
                return null;
            }
        }
        return null;
    },

    getToken(): string | null {
        return tokenService.getAccessToken();
    }
};
