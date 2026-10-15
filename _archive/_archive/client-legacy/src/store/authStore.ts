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
    }
  )
);
