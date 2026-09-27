"use strict";
/**
 * Concurrency Queue Manager voor Locra LLM Streaming
 * Voorkomt overbelasting van Ollama / lokale GPU door gelijktijdige streaming verzoeken
 * te limiteren op basis van de berekende hardware capaciteit (maxConcurrency).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.concurrencyQueue = void 0;
class ConcurrencyQueueManager {
    activeStreams = new Map();
    queues = new Map();
    /**
     * Verkrijg een streaming slot.
     * Wacht in de FIFO-wachtrij als de actuele concurrency >= maxConcurrency is.
     */
    async acquireSlot(orgId, maxConcurrency, timeoutSec = 45, onWait) {
        const currentActive = this.activeStreams.get(orgId) || 0;
        // Direct plek beschikbaar
        if (currentActive < maxConcurrency) {
            this.activeStreams.set(orgId, currentActive + 1);
            return () => this.releaseSlot(orgId, maxConcurrency);
        }
        // Geen directe plek: voeg toe aan wachtrij
        if (!this.queues.has(orgId)) {
            this.queues.set(orgId, []);
        }
        const queue = this.queues.get(orgId);
        const reqId = Math.random().toString(36).substring(2, 9);
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                // Verwijder uit wachtrij bij timeout
                const currentQueue = this.queues.get(orgId) || [];
                const index = currentQueue.findIndex(q => q.id === reqId);
                if (index !== -1) {
                    currentQueue.splice(index, 1);
                    this.notifyWaiters(orgId);
                }
                reject(new Error(`Wachtrij timeout na ${timeoutSec} seconden. De server verwerkt momenteel te veel verzoeken tegelijk.`));
            }, timeoutSec * 1000);
            const queuedItem = {
                id: reqId,
                orgId,
                resolve: (release) => {
                    clearTimeout(timer);
                    resolve(release);
                },
                reject: (err) => {
                    clearTimeout(timer);
                    reject(err);
                },
                onWait,
                timer
            };
            queue.push(queuedItem);
            const position = queue.length;
            if (onWait) {
                onWait(position);
            }
        });
    }
    /**
     * Geef een slot vrij en laat de eerstvolgende wachtende starten.
     */
    releaseSlot(orgId, maxConcurrency) {
        const currentActive = this.activeStreams.get(orgId) || 0;
        const queue = this.queues.get(orgId) || [];
        if (queue.length > 0) {
            // Laat de volgende wachtende doorgaan
            const nextReq = queue.shift();
            this.notifyWaiters(orgId);
            // De vrijgegeven slot gaat direct over naar de volgende
            nextReq.resolve(() => this.releaseSlot(orgId, maxConcurrency));
        }
        else {
            // Geen wachtenden: verlaag actieve teller
            const newActive = Math.max(0, currentActive - 1);
            this.activeStreams.set(orgId, newActive);
        }
    }
    /**
     * Update de positie van alle wachtenden in de rij
     */
    notifyWaiters(orgId) {
        const queue = this.queues.get(orgId) || [];
        queue.forEach((item, idx) => {
            if (item.onWait) {
                try {
                    item.onWait(idx + 1);
                }
                catch (_) { }
            }
        });
    }
    /**
     * Haal actuele statistieken op voor een organisatie
     */
    getStats(orgId) {
        return {
            activeStreams: this.activeStreams.get(orgId) || 0,
            queuedCount: (this.queues.get(orgId) || []).length
        };
    }
}
exports.concurrencyQueue = new ConcurrencyQueueManager();
