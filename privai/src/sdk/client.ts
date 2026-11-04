import crypto from 'crypto';
import { TEEAttestationReport, EncryptedPayloadEnvelope, OpenAIChatCompletionRequest, OpenAIChatCompletionResponse, OpenAIStreamChunk, AnthropicMessageRequest, AnthropicMessageResponse } from '../types';

/**
 * Locra PrivAI™ Client SDK (Zero-Dependency TypeScript/Node.js)
 *
 * Drop-in replacement client for OpenAI/Anthropic with automatic:
 * 1. Remote Attestation verification (hardware enclave integrity)
 * 2. End-to-end payload encryption (X25519 + AES-256-GCM)
 * 3. Zero-retention streaming
 *
 * Usage:
 *   const client = new LocraPrivAI({ apiKey: 'privai_live_...' });
 *   const response = await client.chat({ messages: [...], model: 'locra-privai-pro' });
 */

export interface LocraPrivAIConfig {
  apiKey: string;
  baseUrl?: string; // Default: https://api.privai.locra.nl
  verifyAttestation?: boolean; // Default: true
  timeout?: number; // Default: 120000ms
}

export class LocraPrivAI {
  private apiKey: string;
  private baseUrl: string;
  private verifyAttestation: boolean;
  private timeout: number;
  private cachedAttestation: TEEAttestationReport | null = null;
  private attestationExpiry: number = 0;

  constructor(config: LocraPrivAIConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || 'https://api.privai.locra.nl').replace(/\/$/, '');
    this.verifyAttestation = config.verifyAttestation !== false;
    this.timeout = config.timeout || 120_000;
  }

  /**
   * Fetches and verifies the TEE attestation report from the server.
   */
  async getAttestation(): Promise<TEEAttestationReport> {
    if (this.cachedAttestation && Date.now() < this.attestationExpiry) {
      return this.cachedAttestation;
    }

    const res = await fetch(`${this.baseUrl}/v1/attestation`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
      signal: AbortSignal.timeout(this.timeout)
    });

    if (!res.ok) {
      throw new Error(`PrivAI Attestation failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json() as any;

    if (data.status !== 'verified') {
      throw new Error('PrivAI Attestation FAILED: The enclave could not be cryptographically verified. Do NOT send sensitive data!');
    }

    this.cachedAttestation = data.attestation_report;
    // Cache for 50 minutes (attestation is valid for 60 min)
    this.attestationExpiry = Date.now() + 50 * 60 * 1000;

    return data.attestation_report;
  }

  /**
   * OpenAI-compatible chat completion.
   */
  async chat(request: Omit<OpenAIChatCompletionRequest, 'stream'> & { stream?: false }): Promise<OpenAIChatCompletionResponse> {
    if (this.verifyAttestation) {
      await this.getAttestation();
    }

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({ ...request, stream: false }),
      signal: AbortSignal.timeout(this.timeout)
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(`PrivAI Chat Error ${res.status}: ${JSON.stringify(error)}`);
    }

    return await res.json() as OpenAIChatCompletionResponse;
  }

  /**
   * OpenAI-compatible streaming chat completion.
   */
  async *chatStream(request: Omit<OpenAIChatCompletionRequest, 'stream'>): AsyncGenerator<OpenAIStreamChunk> {
    if (this.verifyAttestation) {
      await this.getAttestation();
    }

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({ ...request, stream: true }),
      signal: AbortSignal.timeout(this.timeout)
    });

    if (!res.ok || !res.body) {
      const error = await res.json().catch(() => ({}));
      throw new Error(`PrivAI Stream Error ${res.status}: ${JSON.stringify(error)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === '' || trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const chunk = JSON.parse(trimmed.substring(6)) as OpenAIStreamChunk;
            yield chunk;
          } catch {
            // Skip malformed chunks
          }
        }
      }
    }
  }

  /**
   * Anthropic Claude-compatible messages endpoint.
   */
  async message(request: Omit<AnthropicMessageRequest, 'stream'> & { stream?: false }): Promise<AnthropicMessageResponse> {
    if (this.verifyAttestation) {
      await this.getAttestation();
    }

    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'X-API-Key': this.apiKey
      },
      body: JSON.stringify({ ...request, stream: false }),
      signal: AbortSignal.timeout(this.timeout)
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(`PrivAI Message Error ${res.status}: ${JSON.stringify(error)}`);
    }

    return await res.json() as AnthropicMessageResponse;
  }

  /**
   * List available sovereign models.
   */
  async listModels(): Promise<any> {
    const res = await fetch(`${this.baseUrl}/v1/models`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
      signal: AbortSignal.timeout(this.timeout)
    });
    return await res.json();
  }

  /**
   * Get non-sensitive usage statistics.
   */
  async getUsage(): Promise<any> {
    const res = await fetch(`${this.baseUrl}/v1/usage`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
      signal: AbortSignal.timeout(this.timeout)
    });
    return await res.json();
  }
}

