import React, { createContext, useContext, useState, useEffect } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import { User, SchoolOrg } from '../types';
import { storage } from '../services/storage';
import { LocraApi } from '../services/api';
import { useTheme } from './ThemeContext';

interface AuthContextType {
  user: User | null;
  schoolOrg: SchoolOrg | null;
  isAuthenticated: boolean;
  isSchoolConnected: boolean;
  isLoading: boolean;
  pairWithQr: (serverUrl: string, pairingCode: string) => Promise<void>;
  connectSchoolOnly: (serverUrl: string) => Promise<SchoolOrg>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  disconnectSchool: () => Promise<void>;
  authenticateWithBiometrics: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  schoolOrg: null,
  isAuthenticated: false,
  isSchoolConnected: false,
  isLoading: true,
  pairWithQr: async () => {},
  connectSchoolOnly: async () => ({} as any),
  login: async () => {},
  logout: async () => {},
  disconnectSchool: async () => {},
  authenticateWithBiometrics: async () => false
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [schoolOrg, setSchoolOrgState] = useState<SchoolOrg | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { setSchoolOrg } = useTheme();

  // Load existing session on app launch
  useEffect(() => {
    const bootstrap = async () => {
      try {
        const storedOrg = await storage.getSchoolOrg();
        const storedUser = await storage.getUser();
        const storedToken = await storage.getAuthToken();
        const biometricsEnabled = await storage.isBiometricsEnabled();

        if (storedOrg) {
          setSchoolOrgState(storedOrg);
          setSchoolOrg(storedOrg);
        }

        if (storedToken && storedUser) {
          if (biometricsEnabled) {
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            if (hasHardware) {
              const bioResult = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Ontgrendel Locra met Face ID of vingerafdruk',
                cancelLabel: 'Annuleer',
                fallbackLabel: 'Gebruik toegangscode'
              });
              if (bioResult.success) {
                setUser(storedUser);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } else {
                // Biometrics cancelled or failed
                setUser(null);
              }
            } else {
              setUser(storedUser);
            }
          } else {
            setUser(storedUser);
          }
        }
      } catch (e) {
        console.error('Error during auth bootstrap:', e);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrap();
  }, []);

  const pairWithQr = async (serverUrl: string, pairingCode: string) => {
    setIsLoading(true);
    try {
      // 1. Claim pairing token from server
      const result = await LocraApi.claimPairingCode(serverUrl, pairingCode);
      
      // 2. Persist server URL & token securely
      await storage.setServerUrl(serverUrl);
      await storage.setAuthToken(result.token);
      await storage.setUser(result.user);
      await storage.setSchoolOrg(result.org);

      setUser(result.user);
      setSchoolOrgState(result.org);
      setSchoolOrg(result.org);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const connectSchoolOnly = async (serverUrl: string): Promise<SchoolOrg> => {
    setIsLoading(true);
    try {
      const orgInfo = await LocraApi.discoverSchoolInfo(serverUrl);
      await storage.setServerUrl(serverUrl);
      await storage.setSchoolOrg(orgInfo);

      setSchoolOrgState(orgInfo);
      setSchoolOrg(orgInfo);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return orgInfo;
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const result = await LocraApi.login(username, password);
      await storage.setAuthToken(result.token);
      await storage.setUser(result.user);
      setUser(result.user);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await storage.clearAllSession();
    setUser(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const disconnectSchool = async () => {
    await storage.clearAllSession();
    await storage.removeAuthToken();
    setSchoolOrgState(null);
    setSchoolOrg(null);
    setUser(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const authenticateWithBiometrics = async (): Promise<boolean> => {
    try {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Ontgrendel Locra',
        cancelLabel: 'Annuleren'
      });
      return res.success;
    } catch {
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      schoolOrg,
      isAuthenticated: !!user,
      isSchoolConnected: !!schoolOrg,
      isLoading,
      pairWithQr,
      connectSchoolOnly,
      login,
      logout,
      disconnectSchool,
      authenticateWithBiometrics
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
