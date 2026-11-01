import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export type ClusterTaskRole = 'chat_fast' | 'thinking_heavy' | 'image_gen' | 'embeddings' | 'general';
export type ClusterEngineType = 'ollama' | 'openai_compatible' | 'comfyui';

export interface NodeLiveMetrics {
  nodeId: string;
  activeStreams: number;
  lastPingMs: number;
  isHealthy: boolean;
  lastChecked: number;
  availableModels: string[];
  vramUsedMb: number;
  vramTotalMb: number;
  vramPercentage: number;
  oomRiskLevel: 'safe' | 'warning' | 'critical';
  oomOffloadCount: number;
  cachedPrefixCount: number;
}

export class ClusterRouterService {
  private activeStreams: Map<string, number> = new Map();
  private metrics: Map<string, NodeLiveMetrics> = new Map();
  private prefixCache: Map<string, { nodeId: string; lastHit: number; hitCount: number }> = new Map();
  private totalCacheHits = 0;
  private totalOomOffloads = 0;

  /**
   * Registreer de start van een stream op een worker node
   */
  startStream(nodeId: string) {
    const current = this.activeStreams.get(nodeId) || 0;
    this.activeStreams.set(nodeId, current + 1);
    this.updateVramEstimate(nodeId);
  }

  /**
   * Registreer het einde van een stream op een worker node
   */
  endStream(nodeId: string) {
    const current = this.activeStreams.get(nodeId) || 0;
    this.activeStreams.set(nodeId, Math.max(0, current - 1));
    this.updateVramEstimate(nodeId);
  }

  /**
   * Vraag aantal actieve streams op
   */
  getActiveStreams(nodeId: string): number {
    return this.activeStreams.get(nodeId) || 0;
  }

  /**
   * Dynamische VRAM & OOM inschatting en bewaking per GPU
   */
  private updateVramEstimate(nodeId: string, vramGb?: number) {
    const active = this.getActiveStreams(nodeId);
    const m = this.getNodeMetrics(nodeId, vramGb);
    
    // Configureerbare VRAM (standaard 48 GB, of wat op de node is ingesteld)
    const totalMb = (vramGb ? vramGb * 1024 : m.vramTotalMb) || 49152;
    
    // In ruststand (0 streams) is dynamische VRAM 0 MB (of reeds ingeladen model uit ping)
    let usedMb = 0;
    if (active > 0) {
      const baseMb = Math.min(totalMb * 0.35, 4096);
      const streamMb = active * 1536;
      usedMb = Math.min(totalMb, baseMb + streamMb);
    } else if (m.vramUsedMb > 0) {
      usedMb = Math.min(totalMb, m.vramUsedMb);
    }
    
    const percent = totalMb > 0 ? Math.round((usedMb / totalMb) * 100) : 0;

    let risk: 'safe' | 'warning' | 'critical' = 'safe';
    if (percent >= 92) {
      risk = 'critical';
    } else if (percent >= 85) {
      risk = 'warning';
    }

    this.metrics.set(nodeId, {
      ...m,
      activeStreams: active,
      vramUsedMb: usedMb,
      vramTotalMb: totalMb,
      vramPercentage: percent,
      oomRiskLevel: risk
    });
  }

  /**
   * KVS Prefix Cache Hashing: Vind of registreer GPU affinity voor gedeelde prompts
   */
  getPrefixAffinity(prefixText: string, candidateNodeIds: string[]): { nodeId: string | null; isCacheHit: boolean } {
    if (!prefixText || prefixText.length < 300 || candidateNodeIds.length === 0) {
      return { nodeId: null, isCacheHit: false };
    }

    // SHA-256 hash van het gedeelde tekstfragment (bijv. schoolopdracht of documentcontext)
    const hash = crypto.createHash('sha256').update(prefixText.slice(0, 4000)).digest('hex').slice(0, 16);
    const existing = this.prefixCache.get(hash);

    if (existing && candidateNodeIds.includes(existing.nodeId)) {
      existing.lastHit = Date.now();
      existing.hitCount += 1;
      this.totalCacheHits += 1;
      return { nodeId: existing.nodeId, isCacheHit: true };
    }

    return { nodeId: null, isCacheHit: false };
  }

  /**
   * Bewaar prefix affinity zodra een node is gekozen
   */
  setPrefixAffinity(prefixText: string, nodeId: string) {
    if (!prefixText || prefixText.length < 300) return;
    const hash = crypto.createHash('sha256').update(prefixText.slice(0, 4000)).digest('hex').slice(0, 16);
    this.prefixCache.set(hash, {
      nodeId,
      lastHit: Date.now(),
      hitCount: 1
    });

    // Cleanup oude cache items na 1000 items
    if (this.prefixCache.size > 1000) {
      const oldestKey = this.prefixCache.keys().next().value;
      if (oldestKey) this.prefixCache.delete(oldestKey);
    }
  }

  /**
   * Haal globale cluster statistieken op
   */
  getClusterStats() {
    return {
      totalCacheHits: this.totalCacheHits,
      totalOomOffloads: this.totalOomOffloads,
      activePrefixesCount: this.prefixCache.size
    };
  }

  /**
   * Haal live metrics op voor een specifieke node
   */
  getNodeMetrics(nodeId: string, defaultVramGb: number = 48): NodeLiveMetrics {
    const totalMb = defaultVramGb * 1024;
    return this.metrics.get(nodeId) || {
      nodeId,
      activeStreams: this.getActiveStreams(nodeId),
      lastPingMs: 0,
      isHealthy: true,
      lastChecked: 0,
      availableModels: [],
      vramUsedMb: 0,
      vramTotalMb: totalMb,
      vramPercentage: 0,
      oomRiskLevel: 'safe',
      oomOffloadCount: 0,
      cachedPrefixCount: 0
    };
  }

  /**
   * Ping een node en meet latency, model-tags en actieve model VRAM
   */
  async pingNode(url: string, engine: string = 'ollama', vramGb: number = 48): Promise<{ healthy: boolean; latencyMs: number; models: string[]; vramUsedMb?: number; vramTotalMb?: number; error?: string }> {
    const cleanUrl = url.replace(/\/api\/?$/, '').replace(/\/+$/, '');
    const start = Date.now();
    const totalMb = vramGb * 1024;

    try {
      if (engine === 'ollama') {
        const res = await fetch(`${cleanUrl}/api/tags`, { signal: AbortSignal.timeout(4000) });
        const latencyMs = Date.now() - start;
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json() as any;
        const models = (data.models || []).map((m: any) => m.name || m.model || String(m));

        // Probeer actueel geladen modellen in VRAM uit te lezen via /api/ps
        let vramUsedMb = 0;
        try {
          const psRes = await fetch(`${cleanUrl}/api/ps`, { signal: AbortSignal.timeout(2000) });
          if (psRes.ok) {
            const psData = await psRes.json() as any;
            if (psData.models && Array.isArray(psData.models)) {
              const totalBytes = psData.models.reduce((acc: number, item: any) => acc + (item.size_vram || item.size || 0), 0);
              vramUsedMb = Math.round(totalBytes / (1024 * 1024));
            }
          }
        } catch {
          // Silent fallback
        }

        return { healthy: true, latencyMs, models, vramUsedMb, vramTotalMb: totalMb };
      } else if (engine === 'openai_compatible') {
        const res = await fetch(`${cleanUrl}/v1/models`, { signal: AbortSignal.timeout(4000) });
        const latencyMs = Date.now() - start;
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json() as any;
        const models = (data.data || []).map((m: any) => m.id || String(m));
        return { healthy: true, latencyMs, models, vramTotalMb: totalMb };
      } else if (engine === 'comfyui') {
        const res = await fetch(`${cleanUrl}/system_stats`, { signal: AbortSignal.timeout(4000) });
        const latencyMs = Date.now() - start;
        if (!res.ok) throw new Error(`Status ${res.status}`);
        return { healthy: true, latencyMs, models: ['ComfyUI Workflows'], vramTotalMb: totalMb };
      } else {
        const res = await fetch(cleanUrl, { signal: AbortSignal.timeout(4000) });
        const latencyMs = Date.now() - start;
        return { healthy: res.ok, latencyMs, models: [], vramTotalMb: totalMb };
      }
    } catch (err: any) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        models: [],
        error: err.message || 'Onbereikbaar'
      };
    }
  }

  /**
   * Controleer of er momenteel een dynamisch spitsuur / piekurenschema actief is
   */
  async getActiveSchedule(prisma: PrismaClient, orgId: string) {
    try {
      const rules = await prisma.clusterScheduleRule.findMany({
        where: { orgId, isActive: true }
      });

      if (rules.length === 0) return null;

      const now = new Date();
      // Bepaal dag van week in korte notatie ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
      const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const currentDay = days[now.getDay()];

      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${hours}:${minutes}`;

      for (const rule of rules) {
        let allowedDays: string[] = [];
        try {
          allowedDays = JSON.parse(rule.daysOfWeek);
        } catch {
          allowedDays = ['mon', 'tue', 'wed', 'thu', 'fri'];
        }

        if (allowedDays.includes(currentDay)) {
          if (currentTime >= rule.startTime && currentTime <= rule.endTime) {
            return rule; // Deze regel is nu actief!
          }
        }
      }

      return null;
    } catch (e) {
      console.warn('Fout bij controleren piekuren schema:', e);
      return null;
    }
  }

  /**
   * Intelligente taak-selectie: kiest de optimale worker node op basis van:
   * 1. Rol (chat_fast, thinking_heavy, image_gen, embeddings)
   * 2. Actieve spitsuurregels (spillover)
   * 3. Capaciteit & least-connections (minst actieve streams)
   */
  async selectNodeForTask(
    prisma: PrismaClient,
    orgId: string,
    taskRole: ClusterTaskRole,
    options?: { fallbackUrl?: string; promptPrefix?: string }
  ): Promise<{ node: any | null; url: string; isSpilloverActive: boolean; isCacheHit?: boolean; isOomOffloaded?: boolean }> {
    const fallbackUrl = options?.fallbackUrl || process.env.OLLAMA_URL || 'http://127.0.0.1:11434';

    try {
      const allNodes = await prisma.clusterNode.findMany({
        where: { orgId, isActive: true },
        orderBy: { priority: 'desc' }
      });

      if (allNodes.length === 0) {
        return { node: null, url: fallbackUrl, isSpilloverActive: false };
      }

      const activeSchedule = await this.getActiveSchedule(prisma, orgId);
      const isPeakHour = Boolean(activeSchedule);

      // Filter nodes die de gewenste taak kunnen uitvoeren
      let candidates = allNodes.filter(node => {
        let roles: string[] = [];
        try {
          roles = JSON.parse(node.roles);
        } catch {
          roles = ['general'];
        }

        // Directe match of generalist
        if (roles.includes(taskRole) || roles.includes('general')) {
          return true;
        }

        // Spillover tijdens piekuur: als dit een chat_fast taak is en de node mag bijspringen
        if (taskRole === 'chat_fast' && isPeakHour && node.isSpilloverNode) {
          return true;
        }

        return false;
      });

      if (candidates.length === 0) {
        return { node: allNodes[0] || null, url: allNodes[0]?.url || fallbackUrl, isSpilloverActive: false };
      }

      // Feature 1: VRAM OOM Autoguard — filter nodes met kritiek VRAM (>92%) weg indien er gezonde alternatieven zijn
      let isOomOffloaded = false;
      const safeCandidates = candidates.filter(c => {
        const m = this.getNodeMetrics(c.id);
        return m.oomRiskLevel !== 'critical';
      });

      if (safeCandidates.length > 0 && safeCandidates.length < candidates.length) {
        // We hebben minimaal 1 overbelaste GPU ontweken!
        candidates = safeCandidates;
        this.totalOomOffloads += 1;
        isOomOffloaded = true;
      }

      // Feature 2: KVS Prompt Caching Affinity Check
      if (options?.promptPrefix) {
        const affinity = this.getPrefixAffinity(options.promptPrefix, candidates.map(c => c.id));
        if (affinity.isCacheHit && affinity.nodeId) {
          const cachedNode = candidates.find(c => c.id === affinity.nodeId);
          if (cachedNode) {
            const isSpillover = isPeakHour && cachedNode.isSpilloverNode && !cachedNode.roles.includes('chat_fast');
            return {
              node: cachedNode,
              url: cachedNode.url,
              isSpilloverActive: isSpillover,
              isCacheHit: true,
              isOomOffloaded
            };
          }
        }
      }

      // Sorteer kandidaten op least-connections (laagste actieve stream-verhouding)
      candidates.sort((a, b) => {
        const aStreams = this.getActiveStreams(a.id);
        const bStreams = this.getActiveStreams(b.id);

        const aLoad = aStreams / Math.max(1, a.maxStreams);
        const bLoad = bStreams / Math.max(1, b.maxStreams);

        if (aLoad !== bLoad) {
          return aLoad - bLoad;
        }

        return b.priority - a.priority;
      });

      const selected = candidates[0];
      const isSpillover = isPeakHour && selected.isSpilloverNode && !selected.roles.includes('chat_fast');

      // Bewaar prefix affinity voor volgende verzoeken van klasgenoten
      if (options?.promptPrefix && selected) {
        this.setPrefixAffinity(options.promptPrefix, selected.id);
      }

      return {
        node: selected,
        url: selected.url,
        isSpilloverActive: isSpillover,
        isCacheHit: false,
        isOomOffloaded
      };
    } catch (err: any) {
      console.error('Fout bij cluster router selectNodeForTask:', err.message);
      return { node: null, url: fallbackUrl, isSpilloverActive: false };
    }
  }

  /**
   * Feature 4: Automatische GPU & Worker Benchmark Simulator
   */
  async runNodeBenchmark(
    nodeUrl: string,
    requestedModel?: string,
    engine: string = 'ollama',
    speculativeDraftModel?: string
  ): Promise<{
    tokensPerSecond: number;
    ttftMs: number;
    totalTokens: number;
    totalDurationMs: number;
    maxConcurrentCapacityEst: number;
    verdict: string;
    modelTested: string;
    speculativeTandemActive?: boolean;
    speculativeDraftModel?: string;
  }> {
    const cleanUrl = nodeUrl.replace(/\/api\/?$/, '').replace(/\/+$/, '');
    const testPrompt = 'Schrijf een bondige samenvatting in 4 zinnen over de invloed van de stoommachine op de industriële revolutie in Europa.';

    // 1. Detecteer beschikbare modellen op de node om 404 (model ontbreekt) te voorkomen
    let targetModel = requestedModel?.trim();
    let availableModels: string[] = [];

    try {
      if (engine === 'openai_compatible') {
        const modelsRes = await fetch(`${cleanUrl}/v1/models`, { signal: AbortSignal.timeout(3000) });
        if (modelsRes.ok) {
          const mData = await modelsRes.json() as any;
          availableModels = (mData.data || []).map((m: any) => m.id || String(m));
        }
      } else {
        const tagsRes = await fetch(`${cleanUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
        if (tagsRes.ok) {
          const tData = await tagsRes.json() as any;
          availableModels = (tData.models || []).map((m: any) => m.name || m.model || String(m));
        }
      }
    } catch {
      // Netwerkcheck gaat door naar de daadwerkelijke call
    }

    if (availableModels.length > 0) {
      if (!targetModel || !availableModels.some(m => m === targetModel || m.startsWith(targetModel!))) {
        // Gebruik het eerste beschikbare model op de server
        targetModel = availableModels[0];
      }
    } else if (!targetModel) {
      targetModel = 'llama3.2';
    }

    const start = Date.now();
    let ttft = 0;
    let evalCount = 0;
    let evalDurationNs = 0;

    try {
      if (engine === 'openai_compatible') {
        const payload: any = {
          model: targetModel,
          messages: [{ role: 'user', content: testPrompt }],
          max_tokens: 150
        };
        if (speculativeDraftModel) {
          payload.speculative_model = speculativeDraftModel;
        }

        const res = await fetch(`${cleanUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(45000)
        });

        if (!res.ok) {
          let errText = `HTTP ${res.status}`;
          try {
            const errJson = await res.json() as any;
            if (errJson.error?.message || errJson.error) errText = errJson.error?.message || errJson.error;
          } catch {}
          throw new Error(errText);
        }

        const data = await res.json() as any;
        const totalDurationMs = Date.now() - start;
        evalCount = data.usage?.completion_tokens || 80;
        evalDurationNs = totalDurationMs * 1_000_000 * 0.85;
        ttft = Math.round(totalDurationMs * 0.2);

        const tokensPerSecond = Math.round((evalCount / (evalDurationNs / 1_000_000_000)) * 10) / 10;
        const maxConcurrentCapacityEst = Math.max(4, Math.floor(tokensPerSecond / 12) * 4);
        let verdict = 'Uitstekend voor middelgrote klassen';
        if (tokensPerSecond > 100) verdict = 'Extreem snel (geschikt voor 40+ gelijktijdige studenten)';
        else if (tokensPerSecond > 50) verdict = 'Ruimschoots snel voor actieve klassikale toetsen';
        else if (tokensPerSecond < 20) verdict = 'Beperkt (geschikt voor 1-4 gelijktijdige gebruikers)';

        if (speculativeDraftModel) {
          verdict += ` ⚡ [Speculative Tandem: draft ${speculativeDraftModel}]`;
        }

        return {
          tokensPerSecond,
          ttftMs: ttft,
          totalTokens: evalCount,
          totalDurationMs,
          maxConcurrentCapacityEst,
          verdict,
          modelTested: targetModel,
          speculativeTandemActive: Boolean(speculativeDraftModel),
          speculativeDraftModel
        };
      }

      // Ollama engine
      const ollamaPayload: any = {
        model: targetModel,
        prompt: testPrompt,
        stream: false
      };
      if (speculativeDraftModel) {
        ollamaPayload.options = { draft_model: speculativeDraftModel };
      }

      const res = await fetch(`${cleanUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ollamaPayload),
        signal: AbortSignal.timeout(45000)
      });

      if (!res.ok) {
        let errDetails = `HTTP ${res.status}`;
        try {
          const errJson = await res.json() as any;
          if (errJson.error) errDetails = errJson.error;
        } catch {}
        if (res.status === 404) {
          throw new Error(`Model '${targetModel}' niet gevonden op Ollama. Beschikbare modellen: ${availableModels.length > 0 ? availableModels.join(', ') : 'geen modellen gedownload'}`);
        }
        throw new Error(errDetails);
      }

      const data = await res.json() as any;

      const totalDurationMs = Date.now() - start;
      evalCount = data.eval_count || 120;
      evalDurationNs = data.eval_duration || (totalDurationMs * 1_000_000 * 0.8);
      ttft = data.prompt_eval_duration ? Math.round(data.prompt_eval_duration / 1_000_000) : Math.round(totalDurationMs * 0.15);

      const tokensPerSecond = Math.round((evalCount / (evalDurationNs / 1_000_000_000)) * 10) / 10;
      // Capaciteitsschatting: 1 student heeft ~15 t/s nodig voor een vloeiende ervaring
      const maxConcurrentCapacityEst = Math.max(4, Math.floor(tokensPerSecond / 12) * 4);

      let verdict = 'Uitstekend voor middelgrote klassen';
      if (tokensPerSecond > 100) verdict = 'Extreem snel (geschikt voor 40+ gelijktijdige studenten)';
      else if (tokensPerSecond > 50) verdict = 'Ruimschoots snel voor actieve klassikale toetsen';
      else if (tokensPerSecond < 20) verdict = 'Beperkt (geschikt voor 1-4 gelijktijdige gebruikers)';

      if (speculativeDraftModel) {
        verdict += ` ⚡ [Speculative Tandem: draft ${speculativeDraftModel}]`;
      }

      return {
        tokensPerSecond,
        ttftMs: ttft,
        totalTokens: evalCount,
        totalDurationMs,
        maxConcurrentCapacityEst,
        verdict,
        modelTested: targetModel,
        speculativeTandemActive: Boolean(speculativeDraftModel),
        speculativeDraftModel
      };
    } catch (err: any) {
      throw new Error(`Benchmark mislukt op ${cleanUrl}: ${err.message}`);
    }
  }

  /**
   * Genereert een kant-en-klaar Docker Compose & Systemd template voor de beheerder
   */
  generateDeploymentBlueprint(type: '4x_gpu' | '2x_gpu' | '1x_gpu' = '4x_gpu'): { dockerCompose: string; instructions: string } {
    if (type === '4x_gpu') {
      const dockerCompose = `version: '3.8'

# Locra 4x GPU Cluster Setup (bijv. 4x NVIDIA RTX 6000 Ada 48GB)
# GPU 0: Snelle 7B/8B chats (Pool A)
# GPU 1: Snelle 7B/8B chats (Pool B)
# GPU 2: Lokale Afbeeldingsgeneratie (SDXL / FLUX)
# GPU 3: 32B/70B Thinking & Redeneermodellen + Standby 7B Spillover

services:
  # GPU 0: Snelle Chat Pool A (Poort 11434)
  ollama-gpu0-fast1:
    image: ollama/ollama:latest
    container_name: locra-gpu0-fast1
    restart: unless-stopped
    ports:
      - "11434:11434"
    environment:
      - CUDA_VISIBLE_DEVICES=0
      - OLLAMA_NUM_PARALLEL=8
      - OLLAMA_MAX_LOADED_MODELS=2
      - OLLAMA_KEEP_ALIVE=24h
    volumes:
      - /opt/locra/models:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              device_ids: ['0']
              capabilities: [gpu]

  # GPU 1: Snelle Chat Pool B (Poort 11435)
  ollama-gpu1-fast2:
    image: ollama/ollama:latest
    container_name: locra-gpu1-fast2
    restart: unless-stopped
    ports:
      - "11435:11434"
    environment:
      - CUDA_VISIBLE_DEVICES=1
      - OLLAMA_NUM_PARALLEL=8
      - OLLAMA_MAX_LOADED_MODELS=2
      - OLLAMA_KEEP_ALIVE=24h
    volumes:
      - /opt/locra/models:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              device_ids: ['1']
              capabilities: [gpu]

  # GPU 2: Lokale Afbeeldingsgeneratie (Poort 11436 / OpenAI Image API)
  image-gen-gpu2:
    image: ghcr.io/locra-education/local-diffusers-api:latest
    container_name: locra-gpu2-images
    restart: unless-stopped
    ports:
      - "11436:8000"
    environment:
      - CUDA_VISIBLE_DEVICES=2
      - DEFAULT_MODEL=stabilityai/stable-diffusion-xl-base-1.0
      - DEVICE=cuda:0
    volumes:
      - /opt/locra/image-models:/root/.cache
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              device_ids: ['2']
              capabilities: [gpu]

  # GPU 3: 32B Denkmodellen & Standby Spitsuur Spillover (Poort 11437)
  ollama-gpu3-thinking:
    image: ollama/ollama:latest
    container_name: locra-gpu3-thinking
    restart: unless-stopped
    ports:
      - "11437:11434"
    environment:
      - CUDA_VISIBLE_DEVICES=3
      - OLLAMA_NUM_PARALLEL=4
      - OLLAMA_MAX_LOADED_MODELS=2
      - OLLAMA_KEEP_ALIVE=24h
    volumes:
      - /opt/locra/models:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              device_ids: ['3']
              capabilities: [gpu]
`;

      const instructions = `### Instructies voor installatie op Ubuntu / Debian server:
1. Installeer de NVIDIA Container Toolkit:
   sudo apt-get install -y nvidia-container-toolkit && sudo systemctl restart docker
2. Sla bovenstaande configuratie op als \`/opt/locra/docker-compose.yml\`.
3. Start de 4 GPU containers:
   sudo docker compose -f /opt/locra/docker-compose.yml up -d
4. Download de gewenste modellen in de containers:
   docker exec -it locra-gpu0-fast1 ollama pull llama3.2:3b
   docker exec -it locra-gpu1-fast2 ollama pull llama3.2:3b
   docker exec -it locra-gpu3-thinking ollama pull qwen2.5:32b
   docker exec -it locra-gpu3-thinking ollama pull llama3.2:3b # voor spitsuur spillover!
5. In Locra Admin (/admin/cluster): Voeg de 4 nodes toe met hun respectievelijke poorten 11434, 11435, 11436 en 11437.`;

      return { dockerCompose, instructions };
    }

    // Generieke 2 GPU setup
    const dockerCompose = `version: '3.8'

services:
  ollama-gpu0:
    image: ollama/ollama:latest
    container_name: locra-gpu0
    restart: unless-stopped
    ports:
      - "11434:11434"
    environment:
      - CUDA_VISIBLE_DEVICES=0
      - OLLAMA_NUM_PARALLEL=8
    volumes:
      - /opt/locra/models:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              device_ids: ['0']
              capabilities: [gpu]

  ollama-gpu1:
    image: ollama/ollama:latest
    container_name: locra-gpu1
    restart: unless-stopped
    ports:
      - "11435:11434"
    environment:
      - CUDA_VISIBLE_DEVICES=1
      - OLLAMA_NUM_PARALLEL=4
    volumes:
      - /opt/locra/models:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              device_ids: ['1']
              capabilities: [gpu]
`;
    return { dockerCompose, instructions: 'Start via docker compose up -d' };
  }
}

export const clusterRouter = new ClusterRouterService();

