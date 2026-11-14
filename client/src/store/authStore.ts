import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  username: string;
  role: string;
  displayName: string;
  email?: string;
  orgId?: string;
  language?: string;
  darkMode?: boolean;
  storagePreference?: string | null;
  somtodayToken?: string | null;
  somtodayRefreshToken?: string | null;
  somtodayStudentId?: string | null;
  somtodayApiUrl?: string | null;
  academyXp?: number;
  academyLevel?: number;
  academyProgress?: string | null;
  githubToken?: string | null;
  githubUsername?: string | null;
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

export function isTokenExpired(token: string | null | undefined): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonPayload);
    if (!parsed.exp) return false;
    // Buffer of 5 seconds
    return Date.now() >= (parsed.exp * 1000 - 5000);
  } catch {
    return true;
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: 'locra-auth',
      onRehydrateStorage: () => (state) => {
        if (state?.token && isTokenExpired(state.token)) {
          state.token = null;
          state.user = null;
        }
      }
    }
  )
);
