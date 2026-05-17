import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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
        const response = await axios.post<{ data: AuthResponse }>(`${API_URL}/auth/login`, credentials);
        return response.data.data;
    },

    async register(credentials: RegisterCredentials): Promise<AuthResponse> {
        const response = await axios.post<{ data: AuthResponse }>(`${API_URL}/auth/register`, credentials);
        return response.data.data;
    },

    /**
     * Get a nonce for wallet authentication
     * This should be called before signing the message
     */
    async getNonce(address: string): Promise<string> {
        const response = await axios.get<NonceResponse>(`${API_URL}/auth/nonce`, {
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
        const response = await axios.post<{ data: AuthResponse }>(`${API_URL}/auth/wallet-login`, credentials);
        return response.data.data;
    },

    /**
     * Register a new wallet user
     * Similar to wallet login but creates a new user
     */
    async walletRegister(credentials: WalletRegisterCredentials): Promise<AuthResponse> {
        const response = await axios.post<{ data: AuthResponse }>(`${API_URL}/auth/wallet-register`, credentials);
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
    },

    getToken(): string | null {
        return localStorage.getItem('token');
    }
};
