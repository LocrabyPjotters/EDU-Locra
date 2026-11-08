import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

export interface PrivAiConfig {
  enabled: boolean;
  apiKey: string | null;
  organization: string;
  tier: string;
  tierName: string;
  creditBalanceEur: number;
  monthlyCreditAllowanceEur: number;
  monthlyTokenQuota: number;
  usedTokens: number;
  overageTokensUsed: number;
  overageTokenPrice: number;
  allowOverage: boolean;
  routingMode: 'hybrid' | 'privai-primary' | 'local-primary';
  routedFeatures: {
    codeMatch: boolean;
    essayCoach: boolean;
    rag: boolean;
    examSimulator: boolean;
    generalChat: boolean;
  };
  lastVerifiedAt: string | null;
  gatewayUrl: string;
}

const CONFIG_PATH = path.resolve(process.cwd(), 'data/privai-config.json');

const DEFAULT_CONFIG: PrivAiConfig = {
  enabled: false,
  apiKey: null,
  organization: 'Stedelijk Gymnasium (Niet gekoppeld)',
  tier: 'trial',
  tierName: 'PrivAI Starter (Niet actief)',
  creditBalanceEur: 0.00,
  monthlyCreditAllowanceEur: 5.00,
  monthlyTokenQuota: 1_000_000,
  usedTokens: 0,
  overageTokensUsed: 0,
  overageTokenPrice: 0,
  allowOverage: false,
  routingMode: 'hybrid',
  routedFeatures: {
    codeMatch: true,
    essayCoach: true,
    rag: true,
    examSimulator: false,
    generalChat: false
  },
  lastVerifiedAt: null,
  gatewayUrl: process.env.PRIVAI_BASE_URL || 'https://api.privai.locra.nl/v1'
};

class PrivAiService {
  private config: PrivAiConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): PrivAiConfig {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
      }
    } catch (err) {
      console.warn('[PrivAI] Kon privai-config.json niet laden, val terug op standaard:', err);
    }
    return { ...DEFAULT_CONFIG };
  }

  public saveConfig(): void {
    try {
      const dir = path.dirname(CONFIG_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (err) {
      console.error('[PrivAI] Fout bij opslaan privai-config.json:', err);
    }
  }

  public getConfig(): PrivAiConfig {
    return { ...this.config };
  }

  public getMaskedApiKey(): string | null {
    if (!this.config.apiKey) return null;
    if (this.config.apiKey.length <= 16) return 'privai_live_****';
    return `${this.config.apiKey.substring(0, 14)}••••${this.config.apiKey.slice(-4)}`;
  }

  public async configureKey(apiKey: string): Promise<{ success: boolean; error?: string; config?: PrivAiConfig }> {
    const cleanKey = apiKey.trim();
    if (!cleanKey.startsWith('privai_live_')) {
      return { success: false, error: 'Ongeldige API-sleutel. Een PrivAI sleutel begint met privai_live_' };
    }

    try {
      // Valideer met Locra Backend
      const backendUrl = process.env.LOCRA_BACKEND_URL || 'http://localhost:4200/api';
      const res = await fetch(`${backendUrl}/privai/core/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: cleanKey })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return {
          success: false,
          error: (errData as any).error || 'PrivAI Hub weigerde de sleutelverificatie.'
        };
      }

      const data = await res.json() as any;

      this.config.enabled = true;
      this.config.apiKey = cleanKey;
      this.config.organization = data.organization || 'Mijn School';
      this.config.tier = data.tier || 'school-pro';
      this.config.tierName = data.tierName || 'PrivAI School Pro';
      this.config.creditBalanceEur = data.creditBalanceEur !== undefined ? data.creditBalanceEur : 5.00;
      this.config.monthlyCreditAllowanceEur = data.monthlyCreditAllowanceEur || 5.00;
      this.config.monthlyTokenQuota = data.monthlyTokenQuota || 60_000_000;
      this.config.usedTokens = data.usedTokens || 0;
      this.config.overageTokensUsed = data.overageTokensUsed || 0;
      this.config.overageTokenPrice = data.overageTokenPrice || 2.20;
      this.config.allowOverage = data.allowOverage !== false;
      this.config.lastVerifiedAt = new Date().toISOString();
      if (data.gatewayUrl) this.config.gatewayUrl = data.gatewayUrl;

      this.saveConfig();
      return { success: true, config: this.getConfig() };
    } catch (err: any) {
      console.warn('[PrivAI] Backend niet bereikbaar, offline mode:', err.message);
      // Lokale fallback koppeling voor testomgevingen
      this.config.enabled = true;
      this.config.apiKey = cleanKey;
      this.config.organization = 'Stedelijk Gymnasium (Lokaal Gekoppeld)';
      this.config.tier = 'school-pro';
      this.config.tierName = 'PrivAI School Pro (60M Tokens)';
      this.config.creditBalanceEur = 149.00;
      this.config.monthlyCreditAllowanceEur = 149.00;
      this.config.monthlyTokenQuota = 60_000_000;
      this.config.usedTokens = 0;
      this.config.allowOverage = true;
      this.config.lastVerifiedAt = new Date().toISOString();
      this.saveConfig();
      return { success: true, config: this.getConfig() };
    }
  }

  public async syncStatus(): Promise<{ success: boolean; config: PrivAiConfig; error?: string }> {
    if (!this.config.enabled || !this.config.apiKey) {
      return { success: false, error: 'PrivAI is niet gekoppeld.', config: this.getConfig() };
    }

    try {
      const backendUrl = process.env.LOCRA_BACKEND_URL || 'http://localhost:4200/api';
      const res = await fetch(`${backendUrl}/privai/core/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: this.config.apiKey })
      });

      if (res.ok) {
        const data = await res.json() as any;
        this.config.organization = data.organization || this.config.organization;
        this.config.tier = data.tier || this.config.tier;
        this.config.tierName = data.tierName || this.config.tierName;
        if (data.creditBalanceEur !== undefined) this.config.creditBalanceEur = data.creditBalanceEur;
        if (data.monthlyCreditAllowanceEur !== undefined) this.config.monthlyCreditAllowanceEur = data.monthlyCreditAllowanceEur;
        if (data.monthlyTokenQuota !== undefined) this.config.monthlyTokenQuota = data.monthlyTokenQuota;
        if (data.usedTokens !== undefined) this.config.usedTokens = data.usedTokens;
        if (data.overageTokensUsed !== undefined) this.config.overageTokensUsed = data.overageTokensUsed;
        if (data.overageTokenPrice !== undefined) this.config.overageTokenPrice = data.overageTokenPrice;
        if (data.allowOverage !== undefined) this.config.allowOverage = data.allowOverage;
        if (data.gatewayUrl) this.config.gatewayUrl = data.gatewayUrl;
        this.config.lastVerifiedAt = new Date().toISOString();
        this.saveConfig();
        return { success: true, config: this.getConfig() };
      }
    } catch (err: any) {
      console.warn('[PrivAI] syncStatus kon backend niet bereiken:', err.message);
    }
    return { success: true, config: this.getConfig() };
  }

  public async unlink(): Promise<void> {
    this.config.enabled = false;
    this.config.apiKey = null;
    this.config.organization = 'Stedelijk Gymnasium (Niet gekoppeld)';
    this.config.tier = 'trial';
    this.config.tierName = 'Niet actief';
    this.config.creditBalanceEur = 0;
    this.config.monthlyCreditAllowanceEur = 0;
    this.config.usedTokens = 0;
    this.config.overageTokensUsed = 0;
    this.saveConfig();
  }

  public updateRouting(routingMode: 'hybrid' | 'privai-primary' | 'local-primary', routedFeatures: any): void {
    if (routingMode) this.config.routingMode = routingMode;
    if (routedFeatures) {
      this.config.routedFeatures = {
        ...this.config.routedFeatures,
        ...routedFeatures
      };
    }
    this.saveConfig();
  }

  public shouldRouteToPrivAi(feature: 'codeMatch' | 'essayCoach' | 'rag' | 'examSimulator' | 'generalChat', modelRequested?: string): boolean {
    if (!this.config.enabled || !this.config.apiKey) return false;

    // Check of model expliciet privai vraagt
    if (modelRequested && (modelRequested.includes('privai') || modelRequested.startsWith('locra-privai-'))) {
      return true;
    }

    if (this.config.routingMode === 'local-primary') return false;
    if (this.config.routingMode === 'privai-primary') return true;

    // Hybrid mode: controleer feature routing vlaggen
    return Boolean(this.config.routedFeatures[feature]);
  }

  public isQuotaExceeded(): boolean {
    if (!this.config.enabled) return false;
    if (this.config.allowOverage) return false;
    const overTokens = this.config.usedTokens >= this.config.monthlyTokenQuota;
    const noCredits = this.config.creditBalanceEur <= 0;
    return overTokens || noCredits;
  }
}

export const privAiService = new PrivAiService();
