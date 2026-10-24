import { Platform } from 'react-native';
import { storage } from './storage';
import { SchoolOrg, User, Conversation, ChatMessage } from '../types';

export class LocraApi {
  static cleanServerUrl(url: string): string {
    let clean = url.trim().replace(/\/+$/, '');
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `https://${clean}`;
    }
    // If a physical phone received 127.0.0.1 or localhost, translate to public domain so real phones connect
    if (clean.includes('127.0.0.1') || clean.includes('localhost')) {
      clean = clean.replace(/https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i, 'https://locra.pieteroosterling.online');
    }
    // Upgrade external non-local URLs to https
    if (clean.startsWith('http://') && !clean.includes('192.168.') && !clean.includes('10.0.')) {
      clean = clean.replace(/^http:\/\//i, 'https://');
    }
    return clean;
  }

  private static async getBaseUrl(): Promise<string> {
    const url = await storage.getServerUrl();
    if (!url) {
      throw new Error('Geen schoolserver gekoppeld. Scan eerst de koppel-QR-code.');
    }
    return LocraApi.cleanServerUrl(url);
  }

  private static async getHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Locra-Mobile-App/1.0'
    };
    const token = await storage.getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  // ── Discovery & Pairing ──
  static async searchCentralSchools(query: string): Promise<SchoolOrg[]> {
    try {
      const res = await fetch(`https://api.rowmatch.nl/api/locra/connect/schools?q=${encodeURIComponent(query)}`, {
        headers: { 'User-Agent': 'Locra-Mobile-App/1.0' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.schools)) {
          return data.schools;
        }
      }
    } catch (e) {
      console.warn('Central directory query failed:', e);
    }
    return [];
  }

  static async discoverSchoolInfo(serverUrl: string): Promise<SchoolOrg> {
    const cleanUrl = LocraApi.cleanServerUrl(serverUrl);
    const res = await fetch(`${cleanUrl}/api/connect/info`, {
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Locra-Mobile-App/1.0' }
    });
    if (!res.ok) {
      throw new Error('Kon geen Locra schoolserver vinden op deze URL.');
    }
    const data = await res.json();
    return {
      ...data,
      serverUrl: cleanUrl
    };
  }

  static async claimPairingCode(serverUrl: string, pairingCode: string, customDeviceName?: string): Promise<{ token: string; user: User; org: SchoolOrg }> {
    const cleanUrl = LocraApi.cleanServerUrl(serverUrl);
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const deviceName = customDeviceName || (platform === 'ios' ? 'Apple iPhone' : 'Android Apparaat');

    const res = await fetch(`${cleanUrl}/api/connect/pair/claim`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'Locra-Mobile-App/1.0'
      },
      body: JSON.stringify({ 
        pairingCode,
        deviceName,
        devicePlatform: platform,
        appVersion: '1.0.0'
      })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Koppelcode kon niet worden geverifieerd.');
    }
    return {
      token: data.token,
      user: data.user,
      org: {
        ...data.org,
        serverUrl: cleanUrl
      }
    };
  }

  static async login(username: string, password: string, customDeviceName?: string): Promise<{ token: string; user: User }> {
    const baseUrl = await this.getBaseUrl();
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const deviceName = customDeviceName || (platform === 'ios' ? 'Apple iPhone' : 'Android Apparaat');

    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'Locra-Mobile-App/1.0'
      },
      body: JSON.stringify({ 
        username, 
        password,
        deviceName,
        devicePlatform: platform,
        appVersion: '1.0.0'
      })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Ongeldige inloggegevens.');
    }
    return data;
  }

  // ── Conversations ──
  static async getConversations(): Promise<Conversation[]> {
    try {
      const baseUrl = await this.getBaseUrl();
      const headers = await this.getHeaders();
      const res = await fetch(`${baseUrl}/api/chat/conversations`, { headers });
      if (!res.ok) throw new Error('Kon gesprekken niet laden');
      const data = await res.json();
      const convs = Array.isArray(data) ? data : data.conversations || [];
      await storage.setCachedConversations(convs);
      return convs;
    } catch (e) {
      // Fallback to offline cached conversations
      return await storage.getCachedConversations();
    }
  }

  static async createConversation(title = 'Nieuw gesprek'): Promise<Conversation> {
    const baseUrl = await this.getBaseUrl();
    const headers = await this.getHeaders();
    const res = await fetch(`${baseUrl}/api/chat/conversations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Kon nieuw gesprek niet starten');
    return data;
  }

  static async getMessages(convId: string): Promise<ChatMessage[]> {
    try {
      const baseUrl = await this.getBaseUrl();
      const headers = await this.getHeaders();
      const res = await fetch(`${baseUrl}/api/chat/conversations/${convId}/messages`, { headers });
      if (!res.ok) throw new Error('Kon berichten niet ophalen');
      const data = await res.json();
      const messages = Array.isArray(data) ? data : data.messages || [];
      await storage.setCachedMessages(convId, messages);
      return messages;
    } catch (e) {
      // Return cached messages if offline
      return await storage.getCachedMessages(convId);
    }
  }

  static async sendMessage(params: {
    convId: string;
    prompt: string;
    useThinkMode?: boolean;
    onChunk?: (chunk: string) => void;
  }): Promise<{ reply: string; quiz?: any }> {
    const baseUrl = await this.getBaseUrl();
    const headers = await this.getHeaders();

    const bodyPayload = {
      conversationId: params.convId,
      prompt: params.prompt,
      useThinkMode: !!params.useThinkMode,
      stream: false // Non-streaming fallback for simple HTTP or SSE
    };

    const res = await fetch(`${baseUrl}/api/chat/send`, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyPayload)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Fout bij het genereren van een antwoord');
    }

    return {
      reply: data.response || data.content || data.reply || '',
      quiz: data.quiz || null
    };
  }

  // ── Live Streaming via WebSocket with Automatic HTTP Fallback ──
  static async sendMessageStream(params: {
    convId: string;
    prompt: string;
    useThinkMode?: boolean;
    onChunk: (chunk: string) => void;
    onThinking?: (message: string) => void;
    onDone: (finalText: string) => void;
    onError: (error: string) => void;
  }): Promise<() => void> {
    const baseUrl = await this.getBaseUrl();
    const token = await storage.getAuthToken();

    let stopped = false;
    let ws: WebSocket | null = null;
    let fullText = '';

    const stop = () => {
      stopped = true;
      if (ws) {
        try { ws.close(); } catch {}
      }
    };

    try {
      const wsUrl = baseUrl.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:') + '/api/chat/ws';
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (stopped) return;
        ws?.send(JSON.stringify({ type: 'auth', token }));
        ws?.send(JSON.stringify({
          type: 'chat',
          conversationId: params.convId,
          prompt: params.prompt,
          model: 'auto',
          thinkMode: !!params.useThinkMode,
          saveToServer: true
        }));
      };

      ws.onmessage = (event) => {
        if (stopped) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'chunk' && msg.content) {
            fullText += msg.content;
            params.onChunk(msg.content);
          } else if (msg.type === 'thinking' && msg.message) {
            params.onThinking?.(msg.message);
          } else if (msg.type === 'done') {
            stopped = true;
            try { ws?.close(); } catch {}
            params.onDone(fullText || msg.finalContent || '');
          } else if (msg.type === 'error') {
            stopped = true;
            try { ws?.close(); } catch {}
            params.onError(msg.message || 'Fout bij genereren');
          }
        } catch (e) {
          console.warn('WS parse error:', e);
        }
      };

      ws.onerror = async (err) => {
        if (stopped) return;
        console.warn('WebSocket stream error, falling back to HTTP POST:', err);
        try {
          const res = await LocraApi.sendMessage({
            convId: params.convId,
            prompt: params.prompt,
            useThinkMode: params.useThinkMode
          });
          if (!stopped) {
            params.onChunk(res.reply);
            params.onDone(res.reply);
          }
        } catch (e: any) {
          if (!stopped) params.onError(e.message || 'Verbinding mislukt');
        }
      };
    } catch (e: any) {
      // Direct HTTP fallback
      try {
        const res = await LocraApi.sendMessage({
          convId: params.convId,
          prompt: params.prompt,
          useThinkMode: params.useThinkMode
        });
        if (!stopped) {
          params.onChunk(res.reply);
          params.onDone(res.reply);
        }
      } catch (err: any) {
        if (!stopped) params.onError(err.message || 'Verbinding mislukt');
      }
    }

    return stop;
  }
}
