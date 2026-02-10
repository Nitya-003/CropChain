import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export interface VerificationStatus {
    isVerified: boolean;
    role: string;
    verifiedAt?: string;
    credentialHash?: string;
}

export interface UnverifiedUser {
    _id: string;
    name: string;
    email: string;
    role: string;
    walletAddress?: string;
    createdAt: string;
}

export interface VerifiedUser extends UnverifiedUser {
    verification: {
        verifiedAt: string;
        verifiedBy: {
            name: string;
            email: string;
        };
    };
}

declare global {
    interface Window {
        ethereum?: {
            request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
            selectedAddress?: string;
        };
    }
}

export const verificationService = {
    /**
     * Link wallet address to user account
     */
    async linkWallet(): Promise<{ success: boolean; walletAddress: string }> {
        if (!window.ethereum) {
            throw new Error('MetaMask is not installed');
        }

        // Request account access
        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts',
        }) as string[];

        const walletAddress = accounts[0];

        // Sign message to prove ownership
        const message = `Link wallet ${walletAddress} to CropChain account`;
        const signature = await window.ethereum.request({
            method: 'personal_sign',
            params: [message, walletAddress],
        }) as string;

        const token = localStorage.getItem('token');
        const response = await axios.post(
            `${API_URL}/verification/link-wallet`,
            { walletAddress, signature },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );

        return response.data;
    },

    /**
     * Issue verifiable credential (Admin only)
     */
    async issueCredential(
        userId: string,
        walletAddress: string
    ): Promise<{ success: boolean; credentialHash: string }> {
        if (!window.ethereum) {
            throw new Error('MetaMask is not installed');
        }

        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts',
        }) as string[];

        const adminAddress = accounts[0];

        const token = localStorage.getItem('token');

        // Sign verification message with deterministic, non-PII content
        const message = `Issue credential for user ${userId} with wallet ${walletAddress}`;
        const signature = await window.ethereum.request({
            method: 'personal_sign',
            params: [message, adminAddress],
        }) as string;

        const response = await axios.post(
            `${API_URL}/verification/issue`,
            { userId, signature, walletAddress },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );

        return response.data;
    },

    /**
     * Revoke credential (Admin only)
     */
    async revokeCredential(
        userId: string,
        reason: string
    ): Promise<{ success: boolean }> {
        const token = localStorage.getItem('token');
        const response = await axios.post(
            `${API_URL}/verification/revoke`,
            { userId, reason },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );

        return response.data;
    },

    /**
     * Check verification status
     */
    async checkVerification(userId: string): Promise<VerificationStatus> {
        const response = await axios.get(`${API_URL}/verification/check/${userId}`);
        return response.data;
    },

    /**
     * Get unverified users (Admin only)
     */
    async getUnverifiedUsers(): Promise<UnverifiedUser[]> {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/verification/unverified`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        return response.data.users;
    },

    /**
     * Get verified users (Admin only)
     */
    async getVerifiedUsers(): Promise<VerifiedUser[]> {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/verification/verified`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        return response.data.users;
    },
};
