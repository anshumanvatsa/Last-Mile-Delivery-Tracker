'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from './api';

export type UserRole = 'CUSTOMER' | 'AGENT' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    name: string;
    phone?: string;
    role: string;
  }) => Promise<User>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('accessToken');
    if (storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const response = await authApi.login(email, password);
    const { user: loggedInUser, accessToken } = response.data.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('user', JSON.stringify(loggedInUser));
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const register = useCallback(async (data: {
    email: string;
    password: string;
    name: string;
    phone?: string;
    role: string;
  }): Promise<User> => {
    const response = await authApi.register(data);
    const { user: newUser, accessToken } = response.data.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setUser(newUser);
    return newUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout errors
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    setUser(null);
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        register,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// ─────────────────────────────────────────────────────────────
// Role-based redirect helper
// ─────────────────────────────────────────────────────────────

export function getRoleRedirect(role: UserRole): string {
  switch (role) {
    case 'ADMIN': return '/admin';
    case 'AGENT': return '/agent';
    case 'CUSTOMER': return '/dashboard';
    default: return '/login';
  }
}
