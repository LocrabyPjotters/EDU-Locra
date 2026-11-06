import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PRIVAI_PORT || '4100', 10),
  host: process.env.PRIVAI_HOST || '0.0.0.0',
  environment: process.env.NODE_ENV || 'production',
  
  // Datacenter Sovereign Metadata
  datacenter: {
    country: 'NL' as const,
    city: (process.env.PRIVAI_DATACENTER_CITY || 'Amsterdam') as 'Amsterdam' | 'Utrecht',
    facility: process.env.PRIVAI_DATACENTER_FACILITY || 'Equinix AM4 (Science Park)',
    operator: 'Locra Didactics B.V. (KVK 93821039)',
    jurisdiction: 'Nederlands Recht & AVG / GDPR Art. 28/32',
    networkIsolation: 'Intranet VLAN + WireGuard TEE Mesh'
  },

  // OpenPCC & Confidential Computing Settings
  enclave: {
    type: (process.env.PRIVAI_ENCLAVE_TYPE || 'AMD-SEV-SNP') as 'AMD-SEV-SNP' | 'Intel-TDX' | 'OpenPCC-Software-Enclave',
    attestationExpiryMinutes: 60,
    ephemeralKeyRotationSeconds: 300, // Rotate ephemeral session key every 5 minutes
    zeroRetentionScrubOnStreamEnd: true
  },

  // Sovereign Models Available on Locra Dutch Infrastructure
  models: [
    {
      id: 'locra-privai-pro',
      name: 'Locra PrivAI™ Pro (Llama 3.3 70B Dutch-Tuned)',
      family: 'llama' as const,
      contextWindow: 131072,
      maxOutputTokens: 8192,
      description: 'Hoogste redeneerniveau, uitmuntend in Nederlands, didactische scaffolding en RTTI-analyse.',
      capabilities: {
        socratic: true,
        reasoning: true,
        coding: true,
        multilingual: true
      },
      hardwareAcceleration: 'AMD-SEV-SNP' as const,
      datacenter: {
        country: 'NL' as const,
        city: 'Amsterdam' as const,
        provider: 'Equinix-AM4' as const,
        jurisdiction: 'Dutch / EU GDPR' as const
      }
    },
    {
      id: 'locra-privai-fast',
      name: 'Locra PrivAI™ Fast (Mistral Small 24B Sovereign)',
      family: 'mistral' as const,
      contextWindow: 32768,
      maxOutputTokens: 4096,
      description: 'Ultra-lage latency, energie-efficiënt (Groene AI) en perfect voor realtime leerling-interacties.',
      capabilities: {
        socratic: true,
        reasoning: false,
        coding: false,
        multilingual: true
      },
      hardwareAcceleration: 'AMD-SEV-SNP' as const,
      datacenter: {
        country: 'NL' as const,
        city: 'Amsterdam' as const,
        provider: 'Equinix-AM4' as const,
        jurisdiction: 'Dutch / EU GDPR' as const
      }
    },
    {
      id: 'locra-privai-coder',
      name: 'Locra PrivAI™ Coder (Qwen 2.5 Coder 32B)',
      family: 'qwen' as const,
      contextWindow: 65536,
      maxOutputTokens: 8192,
      description: 'Gespecialiseerd voor CodeMatch en informatica-onderwijs (Python, Web, C++, Java).',
      capabilities: {
        socratic: true,
        reasoning: true,
        coding: true,
        multilingual: false
      },
      hardwareAcceleration: 'AMD-SEV-SNP' as const,
      datacenter: {
        country: 'NL' as const,
        city: 'Amsterdam' as const,
        provider: 'Equinix-AM4' as const,
        jurisdiction: 'Dutch / EU GDPR' as const
      }
    }
  ],

  // Central Account & Billing Interconnect (Locra Backend / RowMatch API)
  interconnect: {
    url: process.env.LOCRA_BACKEND_URL || 'http://localhost:4200/api',
    secret: process.env.PRIVAI_INTERCONNECT_SECRET || 'privai-enclave-interconnect-shared-token-2026',
    cacheTtlSeconds: 60
  },

  // Upstream Inference Servers (vLLM container instances on the GPU server)
  upstreams: {
    fast: process.env.VLLM_FAST_URL || 'http://localhost:8001/v1',
    coder: process.env.VLLM_CODER_URL || 'http://localhost:8002/v1',
    pro: process.env.VLLM_PRO_URL || 'http://localhost:8003/v1',
    default: process.env.PRIVAI_UPSTREAM_URL || 'http://localhost:8000/v1'
  },

  // Realistische kostprijzen + marge per 1M tokens (€ exclusief btw)
  pricing: {
    'locra-privai-fast': { inputEurPerMillion: 3.15, outputEurPerMillion: 8.75 },
    'locra-privai-coder': { inputEurPerMillion: 3.25, outputEurPerMillion: 10.50 },
    'locra-privai-pro': { inputEurPerMillion: 4.75, outputEurPerMillion: 52.50 }
  },

  // Control Plane Default API Keys (Voor demonstratie, scholen en ontwikkeltests)
  defaultApiKeys: [
    {
      key: process.env.PRIVAI_MASTER_KEY || 'privai_live_8f3d91c7b5204ef8a961023d8c11e40a',
      tenantId: 'locra-core-school',
      name: 'Locra Core Default School Node',
      monthlyCreditTokens: 50_000_000,
      active: true
    },
    {
      key: 'privai_test_educatie_demo_9823412',
      tenantId: 'demo-school-lyceum',
      name: 'Christelijk Lyceum Demo',
      monthlyCreditTokens: 1_000_000,
      active: true
    }
  ]
};

