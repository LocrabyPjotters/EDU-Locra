import crypto from 'crypto';
import { config } from '../config';
import { SovereignModel } from '../types';

/**
 * Locra PrivAI™ Sovereign Model Registry
 * All models run exclusively on Dutch infrastructure within TEE enclaves.
 */

export class ModelRegistry {
  private static models: Map<string, SovereignModel> = new Map();

  public static initialize(): void {
    for (const modelDef of config.models) {
      this.models.set(modelDef.id, modelDef as SovereignModel);
    }
  }

  public static getModel(id: string): SovereignModel | undefined {
    return this.models.get(id);
  }

  public static listModels(): SovereignModel[] {
    return Array.from(this.models.values());
  }

  public static getDefaultModel(): SovereignModel {
    return this.models.get('locra-privai-pro')!;
  }

  /**
   * Maps incoming model names from OpenAI/Anthropic convention to our sovereign models.
   * e.g. 'gpt-4o' → 'locra-privai-pro', 'claude-3-haiku' → 'locra-privai-fast'
   */
  public static resolveModelAlias(requestedModel: string): SovereignModel {
    const aliases: Record<string, string> = {
      // Direct PrivAI names
      'locra-privai-pro': 'locra-privai-pro',
      'locra-privai-fast': 'locra-privai-fast',
      'locra-privai-coder': 'locra-privai-coder',
      // OpenAI aliases → route to sovereign equivalents
      'gpt-4o': 'locra-privai-pro',
      'gpt-4o-mini': 'locra-privai-fast',
      'gpt-4-turbo': 'locra-privai-pro',
      'gpt-3.5-turbo': 'locra-privai-fast',
      // Anthropic aliases
      'claude-3-opus': 'locra-privai-pro',
      'claude-3-sonnet': 'locra-privai-pro',
      'claude-3-haiku': 'locra-privai-fast',
      'claude-3.5-sonnet': 'locra-privai-pro',
      // Generic
      'llama-3.3-70b': 'locra-privai-pro',
      'mistral-small': 'locra-privai-fast',
      'qwen-2.5-coder': 'locra-privai-coder',
    };

    const resolvedId = aliases[requestedModel] || 'locra-privai-pro';
    return this.models.get(resolvedId) || this.getDefaultModel();
  }
}

