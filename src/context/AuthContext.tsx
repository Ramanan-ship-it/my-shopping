import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { api, getAuthToken, setAuthToken } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  quickLoginAs: (role: UserRole, customUser?: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const DEMO_USERS = [
  { label: 'Owner (All Access)', role: 'OWNER' as UserRole, id: 'OWNER01', pass: 'Owner@123', desc: 'Full ERP & profit analytics' },
  { label: 'Arun (Retail Rep)', role: 'EMPLOYEE' as UserRole, id: 'EMP001', pass: 'Arun@123', desc: 'Retail billing & stock' },
  { label: 'Meena (Wholesale Mgr)', role: 'EMPLOYEE' as UserRole, id: 'EMP002', pass: 'Employee@123', desc: 'Wholesale & transfers' },
  { label: 'Kumar (Tailor Master)', role: 'TAILOR' as UserRole, id: 'TAILOR001', pass: 'Kumar@123', desc: 'Personal piece-rate portal' },
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getAuthToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    try {
      if (!getAuthToken()) {
        setUser(null);
        setIsLoading(false);
        return;
      }
      const data = await api.auth.me();
      setUser(data.user);
    } catch (err) {
      console.error('Session validation error:', err);
      setAuthToken(null);
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (identifier: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.auth.login({ identifier, password });
      setAuthToken(res.token);
      setToken(res.token);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await api.auth.logout();
      }
    } catch (err) {
      console.warn('Logout API error:', err);
    } finally {
      setAuthToken(null);
      setToken(null);
      setUser(null);
    }
  };

  const quickLoginAs = async (role: UserRole, customUser?: string) => {
    const target = DEMO_USERS.find(u => customUser ? u.id === customUser : u.role === role) || DEMO_USERS[0];
    await login(target.id, target.pass);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        quickLoginAs,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
