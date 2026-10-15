import React, { createContext, useContext, useState, useEffect } from 'react';
import { SchoolOrg } from '../types';
import { storage } from '../services/storage';

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  surfaceHover: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  danger: string;
  success: string;
}

interface ThemeContextType {
  colors: ThemeColors;
  isDark: boolean;
  schoolOrg: SchoolOrg | null;
  setSchoolOrg: (org: SchoolOrg | null) => void;
  toggleDark: () => void;
}

const defaultColors: ThemeColors = {
  primary: '#6366f1',
  secondary: '#8b5cf6',
  accent: '#06b6d4',
  background: '#090d16',
  surface: '#111827',
  surfaceHover: '#1f2937',
  border: 'rgba(255, 255, 255, 0.08)',
  textPrimary: '#f8fafc',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  danger: '#ef4444',
  success: '#10b981'
};

const ThemeContext = createContext<ThemeContextType>({
  colors: defaultColors,
  isDark: true,
  schoolOrg: null,
  setSchoolOrg: () => {},
  toggleDark: () => {}
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState(true);
  const [schoolOrg, setSchoolOrgState] = useState<SchoolOrg | null>(null);

  useEffect(() => {
    storage.getSchoolOrg().then(org => {
      if (org) setSchoolOrgState(org);
    });
  }, []);

  const setSchoolOrg = (org: SchoolOrg | null) => {
    setSchoolOrgState(org);
    if (org) {
      storage.setSchoolOrg(org);
    }
  };

  const toggleDark = () => {
    setIsDark(prev => !prev);
  };

  const colors: ThemeColors = {
    primary: schoolOrg?.primaryColor || '#6366f1',
    secondary: schoolOrg?.secondaryColor || '#8b5cf6',
    accent: schoolOrg?.accentColor || '#06b6d4',
    background: isDark ? '#090d16' : '#f8fafc',
    surface: isDark ? '#111827' : '#ffffff',
    surfaceHover: isDark ? '#1f2937' : '#f1f5f9',
    border: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
    textPrimary: isDark ? '#f8fafc' : '#0f172a',
    textSecondary: isDark ? '#94a3b8' : '#64748b',
    textMuted: isDark ? '#64748b' : '#94a3b8',
    danger: '#ef4444',
    success: '#10b981'
  };

  return (
    <ThemeContext.Provider value={{ colors, isDark, schoolOrg, setSchoolOrg, toggleDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
