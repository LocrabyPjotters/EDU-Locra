export class OllamaService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api';
  }

  async getVersion(): Promise<string> {
    try {
      const res = await fetch(`${this.baseUrl}/version`);
      if (!res.ok) throw new Error('Ollama not running');
      const data = await res.json();
      return data.version;
    } catch (e: any) {
      throw new Error('Failed to connect to Ollama: ' + e.message);
    }
  }

  async listModels(): Promise<any[]> {
    try {
      const res = await fetch(`${this.baseUrl}/tags`);
      const data = await res.json();
      return data.models || [];
    } catch (e: any) {
      return [];
    }
  }

  async pullModel(name: string, onProgress?: (status: any) => void): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const res = await fetch(`${this.baseUrl}/pull`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, stream: true })
        });

        if (!res.body) {
          throw new Error('No response body');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(Boolean);
          
          for (const line of lines) {
            const data = JSON.parse(line);
            if (onProgress) onProgress(data);
            if (data.status === 'success') {
              resolve();
              return;
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
    // Ollama expects base64 strings without the data URI prefix (data:image/jpeg;base64,...)
    const cleanImages = images?.map(img => {
      const idx = img.indexOf('base64,');
      return idx !== -1 ? img.substring(idx + 7) : img;
    });

    const body: any = { model, prompt, system, stream, images: cleanImages };
    
    // Explicitly control thinking mode for models that support it (e.g. qwen3.5).
    // When think is false, we disable thinking so the model responds directly.
    // When think is true, the model will use extended reasoning before answering.
    // When think is undefined, we default to false to prevent unwanted thinking.
    body.think = think === true;

    const res = await fetch(`${this.baseUrl}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return res;
  }

  async getEmbedding(prompt: string, model: string = 'llama3'): Promise<number[]> {
    try {
      const res = await fetch(`${this.baseUrl}/embeddings`, {
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
