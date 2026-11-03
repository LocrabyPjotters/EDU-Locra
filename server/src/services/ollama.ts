import { prisma } from '../index';
import { clusterRouter, ClusterTaskRole } from './clusterRouter';

export class OllamaService {
  private fallbackUrl: string;

  constructor() {
    this.fallbackUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api';
  }

  async getBaseUrl(orgId?: string, taskRole: ClusterTaskRole = 'chat_fast', promptPrefix?: string): Promise<{ url: string; nodeId?: string; isCacheHit?: boolean; isOomOffloaded?: boolean }> {
    try {
      if (orgId) {
        // 1. Probeer eerst de geavanceerde ClusterRouter
        const selection = await clusterRouter.selectNodeForTask(prisma, orgId, taskRole, {
          fallbackUrl: this.fallbackUrl,
          promptPrefix
        });

        if (selection.node) {
          const cleanUrl = selection.url.replace(/\/+$/, '');
          const finalUrl = cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
          return {
            url: finalUrl,
            nodeId: selection.node.id,
            isCacheHit: selection.isCacheHit,
            isOomOffloaded: selection.isOomOffloaded
          };
        }

        // 2. Fallback naar legacy OllamaNode
        const nodes = await prisma.ollamaNode.findMany({
          where: { orgId, isActive: true }
        });
        if (nodes.length > 0) {
          const randomIndex = Math.floor(Math.random() * nodes.length);
          return { url: nodes[randomIndex].url };
        }
      }
    } catch (e) {
      console.error('Failed to fetch node from ClusterRouter/DB', e);
    }
    return { url: this.fallbackUrl };
  }

  async getVersion(): Promise<string> {
    const { url } = await this.getBaseUrl();
    try {
      const res = await fetch(`${url}/version`);
      if (!res.ok) throw new Error('Ollama not running');
      const data = await res.json();
      return data.version;
    } catch (e: any) {
      throw new Error(`Failed to connect to Ollama at ${url}: ` + e.message);
    }
  }

  async listModels(): Promise<any[]> {
    const { url } = await this.getBaseUrl();
    try {
      const res = await fetch(`${url}/tags`);
      const data = await res.json();
      return data.models || [];
    } catch (e: any) {
      return [];
    }
  }

  async pullModel(name: string, onProgress?: (status: any) => void): Promise<void> {
    const { url } = await this.getBaseUrl();
    return new Promise(async (resolve, reject) => {
      try {
        const res = await fetch(`${url}/pull`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, stream: true })
        });

        if (!res.body) {
          throw new Error('No response body');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let streamBuffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (streamBuffer.trim()) {
              try {
                const data = JSON.parse(streamBuffer.trim());
                if (onProgress) onProgress(data);
              } catch (e) {}
            }
            break;
          }
          
          streamBuffer += decoder.decode(value, { stream: true });
          const lines = streamBuffer.split('\n');
          streamBuffer = lines.pop() || '';
          
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const data = JSON.parse(trimmed);
              if (onProgress) onProgress(data);
              if (data.status === 'success') {
                resolve();
                return;
              }
            } catch (e) {
              // Fragment veilig overslaan
            }
          }
        }
        resolve();
      } catch (e: any) {
        reject(e);
      }
    });
  }

  async generate(
    prompt: string,
    model: string,
    system?: string,
    stream: boolean = true,
    images?: string[],
    think?: boolean,
    orgId?: string
  ) {
    // Bepaal de vereiste rol
    const isHeavy = think === true || /32b|70b|r1|reason/i.test(model);
    const taskRole: ClusterTaskRole = isHeavy ? 'thinking_heavy' : 'chat_fast';

    const { url, nodeId } = await this.getBaseUrl(orgId, taskRole, system);
    if (nodeId) clusterRouter.startStream(nodeId);

    const cleanImages = (images && images.length > 0)
      ? images.map(img => {
          const idx = img.indexOf('base64,');
          return idx !== -1 ? img.substring(idx + 7) : img;
        })
      : undefined;

    const body: any = { 
      model, 
      prompt, 
      system, 
      stream,
      options: {
        num_ctx: 16384,
        num_predict: 4096
      }
    };
    if (cleanImages && cleanImages.length > 0) {
      body.images = cleanImages;
    }
    body.think = think === true;

    try {
      const res = await fetch(`${url}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      // Stream afronding afvangen
      if (!stream && nodeId) {
        clusterRouter.endStream(nodeId);
      } else if (stream && res.body && nodeId) {
        const originalBody = res.body;
        const reader = originalBody.getReader();
        let streamEnded = false;

        const monitoredStream = new ReadableStream({
          async pull(controller) {
            try {
              const { done, value } = await reader.read();
              if (done) {
                if (!streamEnded) {
                  streamEnded = true;
                  clusterRouter.endStream(nodeId);
                }
                controller.close();
                return;
              }
              controller.enqueue(value);
            } catch (err) {
              if (!streamEnded) {
                streamEnded = true;
                clusterRouter.endStream(nodeId);
              }
              controller.error(err);
            }
          },
          cancel() {
            if (!streamEnded) {
              streamEnded = true;
              clusterRouter.endStream(nodeId);
            }
            reader.cancel();
          }
        });

        return new Response(monitoredStream, {
          headers: res.headers,
          status: res.status,
          statusText: res.statusText
        });
      }

      return res;
    } catch (err) {
      if (nodeId) clusterRouter.endStream(nodeId);
      throw err;
    }
  }

  async getEmbedding(prompt: string, model: string = 'llama3', orgId?: string): Promise<number[]> {
    const { url } = await this.getBaseUrl(orgId, 'embeddings');
    try {
      const res = await fetch(`${url}/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt })
      });
      const data = await res.json();
      return data.embedding || [];
    } catch (e: any) {
      console.error('Failed to get embedding', e);
      return [];
    }
  }
}

export const ollamaClient = new OllamaService();
