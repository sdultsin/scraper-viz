import WebSocket from 'ws';

const WS_URL = process.env.SCRAPER_VIZ_URL || 'ws://localhost:3847';

class ScraperEmitter {
  constructor(source) {
    this.source = source;
    this.ws = null;
    this.queue = [];
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.connect();
  }

  connect() {
    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.on('open', () => {
        console.log(`[${this.source}] Connected to visualization server`);
        this.reconnectAttempts = 0;
        // Flush queued messages
        while (this.queue.length > 0) {
          const msg = this.queue.shift();
          this.ws.send(msg);
        }
      });

      this.ws.on('close', () => {
        this.scheduleReconnect();
      });

      this.ws.on('error', (err) => {
        // Silently handle - don't crash scraper if viz isn't running
        if (err.code !== 'ECONNREFUSED') {
          console.error(`[${this.source}] Viz connection error:`, err.message);
        }
      });
    } catch {
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts);
    }
  }

  emit(type, data = {}) {
    const event = {
      type,
      source: this.source,
      timestamp: Date.now(),
      data,
    };

    const msg = JSON.stringify(event);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(msg);
    } else {
      // Queue for later if disconnected
      if (this.queue.length < 100) {
        this.queue.push(msg);
      }
    }
  }

  // Convenience methods
  agentSpawn(id, label) {
    this.emit('agent:spawn', { id, label });
  }

  workerSpawn(id, label, parentId) {
    this.emit('worker:spawn', { id, label, parentId });
  }

  searchStart(id, label) {
    this.emit('search:start', { id, label });
  }

  searchComplete(id) {
    this.emit('search:complete', { id });
  }

  listingFound(listing) {
    this.emit('listing:found', { listing });
  }

  listingFiltered(listing, reason) {
    this.emit('listing:filtered', { listing, reason });
  }

  listingMatched(listing) {
    this.emit('listing:matched', { listing });
  }

  cycleStart() {
    this.emit('cycle:start', {});
  }

  cycleEnd() {
    this.emit('cycle:end', {});
  }

  error(message, details = {}) {
    this.emit('error', { message, ...details });
  }
}

// Factory function to create emitters for each scraper
export function createEmitter(source) {
  return new ScraperEmitter(source);
}

// Pre-configured emitters
export const fameswap = new ScraperEmitter('fameswap');
export const swapd = new ScraperEmitter('swapd');
export const z2u = new ScraperEmitter('z2u');

export default { createEmitter, fameswap, swapd, z2u };
