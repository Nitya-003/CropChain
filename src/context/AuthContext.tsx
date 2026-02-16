import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import toast from 'react-hot-toast';
import { authService } from '../services/auth.service';

interface AuthContextType {
  user: any;
  login: () => Promise<void>;
  logout: () => void;
  isLoading?: boolean; // Added ? to prevent strict type errors
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const checkWalletConnected = async () => {
    try {
      const { ethereum } = window as any;
      if (ethereum && ethereum.selectedAddress) {
        setUser({ name: 'Farmer', address: ethereum.selectedAddress });
      }
    } catch (error) {
      console.error("Error checking wallet:", error);
    }
  };

  useEffect(() => {
    checkWalletConnected();
  }, []);

  const login = async () => {
    setIsLoading(true);
    const { ethereum } = window as any;

    const register = async (credentials: RegisterCredentials) => {
      setIsLoading(true);
      try {
        console.log(credentials)
        const response = await authService.register(credentials);
        setUser(response.user);
        localStorage.setItem('user', JSON.stringify(response.user));
        localStorage.setItem('token', response.token);
      } finally {
        setIsLoading(false);
      }
    };
    if (!ethereum) {
      toast.error("Metamask not found!");
      setIsLoading(false);
      return;
    }

    try {
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      setUser({ name: 'Farmer', address: accounts[0] });
      toast.success("Connected!");
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

  const logout = () => {
    setUser(null);
    toast.success("Logged out");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
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