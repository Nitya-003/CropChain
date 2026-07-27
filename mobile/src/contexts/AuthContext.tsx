import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { authService } from "../services/auth.service";
import type { User } from "../types";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    role: string,
  ) => Promise<void>;
  connectWallet: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await authService.getStoredUser();
        if (stored) {
          const refreshed = await authService.refreshSession();
          setUser(refreshed);
        }
      } catch {
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { user } = await authService.login(email, password);
      setUser(user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string, role: string) => {
      setIsLoading(true);
      try {
        const { user } = await authService.register(
          name,
          email,
          password,
          role,
        );
        setUser(user);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const connectWallet = useCallback(async () => {
    setIsLoading(true);
    try {
      const { ethereum } = window as any;
      if (!ethereum) throw new Error("MetaMask not found");
      const accounts = await ethereum.request({
        method: "eth_requestAccounts",
      });
      setUser({
        id: "",
        name: "",
        email: "",
        role: "",
        walletAddress: accounts[0],
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        connectWallet,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
