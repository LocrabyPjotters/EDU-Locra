import { prisma } from '../index';

export class OllamaService {
  private fallbackUrl: string;

  constructor() {
    this.fallbackUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api';
  }

  async getBaseUrl(orgId?: string): Promise<string> {
    try {
      // Find all active nodes. If orgId is provided, we could filter, but let's just use all active for load balancing.
      const nodes = await prisma.ollamaNode.findMany({
        where: { isActive: true }
      });
      if (nodes.length > 0) {
        // Random selection (Load Balancing)
        const randomIndex = Math.floor(Math.random() * nodes.length);
        return nodes[randomIndex].url;
      }
    } catch (e) {
      console.error('Failed to fetch OllamaNodes from DB', e);
    }
    return this.fallbackUrl;
  }

  async getVersion(): Promise<string> {
    const url = await this.getBaseUrl();
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
    const url = await this.getBaseUrl();
    try {
      const res = await fetch(`${url}/tags`);
      const data = await res.json();
      return data.models || [];
    } catch (e: any) {
      return [];
    }
  }

  async pullModel(name: string, onProgress?: (status: any) => void): Promise<void> {
    const url = await this.getBaseUrl();
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

  async generate(prompt: string, model: string, system?: string, stream: boolean = true, images?: string[], think?: boolean) {
    const url = await this.getBaseUrl();
    const cleanImages = images?.map(img => {
      const idx = img.indexOf('base64,');
      return idx !== -1 ? img.substring(idx + 7) : img;
    });

    const body: any = { model, prompt, system, stream, images: cleanImages };
    body.think = think === true;

    const res = await fetch(`${url}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return res;
  }

  async getEmbedding(prompt: string, model: string = 'llama3'): Promise<number[]> {
    const url = await this.getBaseUrl();
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
