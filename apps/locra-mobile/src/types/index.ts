export interface User {
  id: string;
  username: string;
  role: 'student' | 'teacher' | 'admin' | 'superadmin' | string;
  displayName: string;
  email?: string;
}

export interface SchoolOrg {
  id?: string;
  name: string;
  slug: string;
  connectCode: string;
  serverUrl: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  slogan?: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  aiName?: string;
}

export interface PairingPayload {
  type: 'locra-pair' | 'locra-school';
  version: number;
  serverUrl: string;
  pairingCode?: string;
  connectCode?: string;
  orgName?: string;
  userDisplayName?: string;
  expiresAt?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  isThinkMode?: boolean;
  model?: string;
  quiz?: any;
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  summary?: string;
  tags?: string[];
  unreadCount?: number;
}

export type RootStackParamList = {
  Onboarding: undefined;
  QRScanner: undefined;
  SchoolSearch: undefined;
  Login: undefined;
  ChatList: undefined;
  Chat: { conversationId?: string; title?: string };
  Settings: undefined;
};
