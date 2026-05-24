import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import toast from 'react-hot-toast';
import { authService, LoginCredentials, RegisterCredentials, User } from '../services/auth.service';

interface AuthContextType {
  user: User | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  connectWallet: () => Promise<void>;
  walletLogin: () => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  isWalletConnected: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start true to check persistence
  const [isWalletConnected, setIsWalletConnected] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const response = await authService.refreshSession();
        setUser(response.user);
        localStorage.setItem('user', JSON.stringify(response.user));
      } catch (error) {
        localStorage.removeItem('user');
        await checkWalletConnected();
      } finally {
        setIsLoading(false);
      }
    };
    initAuth();
  }, []);

  const checkWalletConnected = async () => {
    try {
      const { ethereum } = window as any;
      if (ethereum && ethereum.selectedAddress) {
        // Wallet is connected but user is NOT authenticated
        // Role must come from backend after signature verification
        setIsWalletConnected(true);
        setUser({
          id: '',
          name: '',
          email: '',
          role: '', // No role assigned - requires backend authentication
          walletAddress: ethereum.selectedAddress
        });
      }
    } catch (error) {
      console.error("Error checking wallet:", error);
    }
  };

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      const response = await authService.login(credentials);
      setUser(response.user);
      localStorage.setItem('user', JSON.stringify(response.user));
      toast.success('Login successful!');
    } catch (error: any) {
      const message = error.response?.data?.message || 'Login failed';
      toast.error(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (credentials: RegisterCredentials) => {
    setIsLoading(true);
    try {
      const response = await authService.register(credentials);
      setUser(response.user);
      localStorage.setItem('user', JSON.stringify(response.user));
      toast.success('Registration successful!');
    } catch (error: any) {
      const message = error.response?.data?.message || 'Registration failed';
      toast.error(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const connectWallet = async () => {
    setIsLoading(true);
    const { ethereum } = window as any;

    if (!ethereum) {
      toast.error("Metamask not found!");
      setIsLoading(false);
      return;
    }

    try {
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      // Wallet connected but NOT authenticated
      // User must sign a message to authenticate and get role from backend
      setIsWalletConnected(true);
      setUser({
        id: '',
        name: '',
        email: '',
        role: '', // No role assigned - requires backend authentication
        walletAddress: accounts[0]
      });
      toast.success("Wallet Connected! Please sign in to authenticate.");
    } catch (error: any) {
      if (error.code === 4001) {
        toast.error("Connection rejected");
      } else {
        toast.error("Connection failed");
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Wallet Login with Signature Verification
   * 
   * Flow:
   * 1. Get nonce from backend
   * 2. User signs nonce with wallet
   * 3. Send signature to backend
   * 4. Backend verifies signature and returns JWT with user role
   * 
   * This ensures role is ALWAYS assigned by backend, never by frontend.
   */
  const walletLogin = async () => {
    const { ethereum } = window as any;

    if (!ethereum) {
      toast.error("Metamask not found!");
      return;
    }

    if (!ethereum.selectedAddress) {
      toast.error("Please connect your wallet first");
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Get nonce from backend
      const nonce = await authService.getNonce(ethereum.selectedAddress);

      // Step 2: Ask user to sign the nonce
      const signature = await ethereum.request({
        method: 'personal_sign',
        params: [nonce, ethereum.selectedAddress],
      });

      // Step 3: Send signature to backend for verification
      const response = await authService.walletLogin({
        address: ethereum.selectedAddress,
        signature,
        nonce
      });

      // Step 4: Store JWT and user data
      setUser(response.user);
      localStorage.setItem('user', JSON.stringify(response.user));
      
      toast.success('Wallet authentication successful!');
    } catch (error: any) {
      console.error('Wallet login error:', error);
      if (error.code === 4001) {
        toast.error("Signature rejected");
      } else {
        const message = error.response?.data?.message || 'Wallet authentication failed';
        toast.error(message);
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    setIsWalletConnected(false);
    toast.success("Logged out");
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      register, 
      connectWallet, 
      walletLogin, 
      logout, 
      isLoading,
      isWalletConnected 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
