import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SchoolOrg, User, Conversation, ChatMessage } from '../types';

const TOKEN_KEY = 'locra_auth_token';
const SERVER_URL_KEY = 'locra_server_url';
const BIOMETRICS_KEY = 'locra_biometrics_enabled';
const SCHOOL_ORG_KEY = 'locra_school_org';
const USER_KEY = 'locra_user_profile';
const CHATS_CACHE_KEY = 'locra_chats_cache';

export const storage = {
  // ── Secure Hardware Storage (Tokens) ──
  async getAuthToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  async setAuthToken(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch (e) {
      console.error('Failed to save auth token:', e);
    }
  },

  async removeAuthToken(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {}
  },

  async getServerUrl(): Promise<string | null> {
    try {
      const url = await SecureStore.getItemAsync(SERVER_URL_KEY);
      if (!url) return null;
      let clean = url.trim().replace(/\/+$/, '');
      if (clean.startsWith('http://') && !clean.includes('localhost') && !clean.includes('127.0.0.1') && !clean.includes('192.168.') && !clean.includes('10.0.')) {
        clean = clean.replace(/^http:\/\//i, 'https://');
      }
      return clean;
    } catch {
      return null;
    }
  },

  async setServerUrl(url: string): Promise<void> {
    try {
      let cleanUrl = url.trim().replace(/\/+$/, '');
      if (cleanUrl.startsWith('http://') && !cleanUrl.includes('localhost') && !cleanUrl.includes('127.0.0.1') && !cleanUrl.includes('192.168.') && !cleanUrl.includes('10.0.')) {
        cleanUrl = cleanUrl.replace(/^http:\/\//i, 'https://');
      }
      await SecureStore.setItemAsync(SERVER_URL_KEY, cleanUrl);
    } catch (e) {
      console.error('Failed to save server URL:', e);
    }
  },

  async isBiometricsEnabled(): Promise<boolean> {
    try {
      const val = await SecureStore.getItemAsync(BIOMETRICS_KEY);
      return val === 'true';
    } catch {
      return false;
    }
  },

  async setBiometricsEnabled(enabled: boolean): Promise<void> {
    try {
      await SecureStore.setItemAsync(BIOMETRICS_KEY, enabled ? 'true' : 'false');
    } catch {}
  },

  // ── Regular Offline Storage (Branding, User, Chats) ──
  async getSchoolOrg(): Promise<SchoolOrg | null> {
    try {
      const json = await AsyncStorage.getItem(SCHOOL_ORG_KEY);
      return json ? JSON.parse(json) : null;
    } catch {
      return null;
    }
  },

  async setSchoolOrg(org: SchoolOrg): Promise<void> {
    try {
      await AsyncStorage.setItem(SCHOOL_ORG_KEY, JSON.stringify(org));
    } catch {}
  },

  async getUser(): Promise<User | null> {
    try {
      const json = await AsyncStorage.getItem(USER_KEY);
      return json ? JSON.parse(json) : null;
    } catch {
      return null;
    }
  },

  async setUser(user: User): Promise<void> {
    try {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {}
  },

  async getCachedConversations(): Promise<Conversation[]> {
    try {
      const json = await AsyncStorage.getItem(CHATS_CACHE_KEY);
      return json ? JSON.parse(json) : [];
    } catch {
      return [];
    }
  },

  async setCachedConversations(convs: Conversation[]): Promise<void> {
    try {
      await AsyncStorage.setItem(CHATS_CACHE_KEY, JSON.stringify(convs));
    } catch {}
  },

  async getCachedMessages(convId: string): Promise<ChatMessage[]> {
    try {
      const json = await AsyncStorage.getItem(`locra_messages_${convId}`);
      return json ? JSON.parse(json) : [];
    } catch {
      return [];
    }
  },

  async setCachedMessages(convId: string, messages: ChatMessage[]): Promise<void> {
    try {
      await AsyncStorage.setItem(`locra_messages_${convId}`, JSON.stringify(messages));
    } catch {}
  },

  async clearAllSession(): Promise<void> {
    await this.removeAuthToken();
    try {
      await AsyncStorage.removeItem(USER_KEY);
      await AsyncStorage.removeItem(CHATS_CACHE_KEY);
    } catch {}
  }
};
