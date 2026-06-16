"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { setTokens, clearTokens, getAccessToken } from "./api";

export interface AuthUser {
  id: number;
  full_name: string;
  phone: string;
  role: string;
  barber_profile_id?: number | null;
}

export function isAdminUser(user: AuthUser | null): boolean {
  return user?.role === "admin" || user?.role === "superuser";
}

export function isStaffUser(user: AuthUser | null): boolean {
  return user?.role === "admin" || user?.role === "superuser" || user?.role === "barber";
}

export function isBarberUser(user: AuthUser | null): boolean {
  return user?.role === "barber";
}

interface AuthCtx {
  isAuthenticated: boolean;
  user: AuthUser | null;
  login: (access: string, refresh: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx>({
  isAuthenticated: false,
  user: null,
  login: () => {},
  logout: () => {},
});

function loadUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("user");
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Start false/null on both server and client to avoid hydration mismatch,
  // then sync from localStorage after mount.
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setIsAuthenticated(!!getAccessToken());
    setUser(loadUser());
  }, []);

  const login = useCallback(
    (access: string, refresh: string, userData: AuthUser) => {
      setTokens(access, refresh);
      localStorage.setItem("user", JSON.stringify(userData));
      setIsAuthenticated(true);
      setUser(userData);
    },
    [],
  );

  const logout = useCallback(() => {
    clearTokens();
    localStorage.removeItem("user");
    setIsAuthenticated(false);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
