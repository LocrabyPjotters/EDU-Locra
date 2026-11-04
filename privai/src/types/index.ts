/**
 * Locra PrivAI™ — Type Definitions
 * Strict separation between Confidential Enclave Data Plane and Control Plane Metadata.
 */

// ═══ 1. Model & Sovereign Infrastructure Types ═══
export interface SovereignModel {
  id: string;
  name: string;
  family: 'llama' | 'mistral' | 'qwen';
  contextWindow: number;
  maxOutputTokens: number;
  description: string;
  capabilities: {
    socratic: boolean;
    reasoning: boolean;
    coding: boolean;
    multilingual: boolean;
  };
  hardwareAcceleration: 'NVIDIA-H100-TEE' | 'AMD-SEV-SNP' | 'Apple-Silicon-SecureEnclave';
  datacenter: {
    country: 'NL';
    city: 'Amsterdam' | 'Utrecht';
    provider: 'Equinix-AM4' | 'Dataplace-Utrecht';
    jurisdiction: 'Dutch / EU GDPR';
  };
}

// ═══ 2. OpenAI Compatible Types ═══
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

export interface OpenAIChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  user?: string; // Optional pseudonymized school identifier
}

export interface OpenAIChatCompletionChoice {
  index: number;
  message: {
    role: 'assistant';
    content: string;
  };
  finish_reason: 'stop' | 'length' | 'tool_calls' | null;
}

export interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface OpenAIChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: OpenAIChatCompletionChoice[];
  usage: OpenAIUsage;
  system_fingerprint?: string;
  locra_privai: {
    enclave_verified: boolean;
    datacenter_location: string;
    zero_retention_scrubbed: boolean;
    latency_ms: number;
  };
}

export interface OpenAIStreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
    };
    finish_reason: 'stop' | 'length' | null;
  }>;
}

// ═══ 3. Anthropic Claude Compatible Types ═══
export interface AnthropicMessageRequest {
  model: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  system?: string;
  max_tokens: number;
  temperature?: number;
  stream?: boolean;
}

export interface AnthropicMessageResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text';
    text: string;
  }>;
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence';
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  locra_privai: {
    enclave_verified: boolean;
    datacenter_location: string;
    zero_retention_scrubbed: boolean;
    latency_ms: number;
  };
}

// ═══ 4. OpenPCC / Confidential Computing Attestation Types ═══
export interface TEEAttestationReport {
  enclaveId: string;
  enclaveType: 'AMD-SEV-SNP' | 'Intel-TDX' | 'OpenPCC-Software-Enclave';
  hardwareRootOfTrust: string;
  measurementHash: string; // SHA-256 of the exact running enclave bytecode
  enclavePublicKey: string; // Ephemeral X25519 public key (Base64)
  timestamp: string;
  expiresAt: string;
  datacenter: {
    country: 'NL';
    location: string;
    operator: 'Locra Didactics B.V.';
    jurisdiction: 'Netherlands / EU GDPR Art 28/32';
  };
  signature: string; // ED25519 signature from hardware silicon or master root key
}

export interface EncryptedPayloadEnvelope {
  ephemeralClientPublicKey: string; // X25519 public key of the client (Base64)
  nonce: string;                   // 12-byte IV for AES-256-GCM / ChaCha20-Poly1305 (Base64)
  authTag: string;                 // 16-byte authentication tag (Base64)
  ciphertext: string;              // Encrypted JSON payload (Base64)
  targetEnclaveMeasurement: string;// Ensures payload can ONLY be opened by this exact enclave
}

// ═══ 5. Non-Sensitive Control Plane Metadata Telemetry ═══
/**
 * STRICT RULE: This metadata struct NEVER stores prompts, completions,
 * user identifiers, or chat text. Only operational metrics.
 */
export interface OperationalMetadataRecord {
  requestId: string;
  apiKeyPrefix: string;      // e.g. "privai_live_8f3d..."
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs: number;
  timestamp: string;
  datacenterNode: string;
  enclaveScrubbed: true;     // Guarantees zero-retention memory purge
}

