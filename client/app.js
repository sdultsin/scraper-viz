// app.js - Main application orchestrator

import { Canvas } from './components/Canvas.js';
import { Dashboard } from './components/Dashboard.js';
import { EventFeed } from './components/EventFeed.js';

class App {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 20;
    this.reconnectDelay = 1000;

    // Initialize components
    this.canvas = new Canvas(document.getElementById('node-canvas'));
    this.dashboard = new Dashboard();
    this.eventFeed = new EventFeed(document.getElementById('feed-content'));

    // Wire up event feed hover -> canvas highlight
    this.eventFeed.setHighlightCallback((nodeId, highlight) => {
      this.canvas.updateNodeStatus(nodeId, highlight ? 'highlighted' : 'active');
    });

    // Connection status elements
    this.statusDot = document.querySelector('.status-dot');
    this.statusText = document.querySelector('.status-text');

    // Connect to WebSocket
    this.connect();

    // Global functions for HTML onclick handlers
    window.toggleSection = this.toggleSection.bind(this);
    window.toggleAutoScroll = this.toggleAutoScroll.bind(this);
  }

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('Connected to visualization server');
      this.setConnectionStatus('connected', 'Connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onclose = () => {
      this.setConnectionStatus('disconnected', 'Disconnected');
      this.scheduleReconnect();
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      this.setConnectionStatus('disconnected', 'Error');
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleEvent(data);
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };
  }

  scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);
      this.setConnectionStatus('pending', `Reconnecting in ${delay/1000}s...`);
      setTimeout(() => this.connect(), delay);
    } else {
      this.setConnectionStatus('disconnected', 'Connection failed');
    }
  }

  setConnectionStatus(status, text) {
    this.statusDot.className = `status-dot ${status}`;
    this.statusText.textContent = text;
  }

  handleEvent(event) {
    const { type, source, data } = event;

    // Special handling for initial state
    if (type === 'state:init') {
      this.initializeState(data);
      return;
    }

    // Add to event feed
    this.eventFeed.addEntry(event);

    // Handle by event type
    switch (type) {
      case 'agent:spawn':
        this.canvas.addNode({
          id: data.id,
          type: 'agent',
          source,
          label: data.label || source,
          parentId: 'orchestrator',
        });
        break;

      case 'worker:spawn':
        this.canvas.addNode({
          id: data.id,
          type: 'worker',
          source,
          label: data.label,
          parentId: data.parentId || source,
        });
        break;

      case 'search:start':
        this.dashboard.incrementStat('searchesTotal');
        this.dashboard.incrementSource(source);
        // Add search node if has id
        if (data.id) {
          this.canvas.addNode({
            id: data.id,
            type: 'search',
            source,
            label: data.label,
            parentId: data.parentId || source,
          });
        }
        break;

      case 'search:complete':
        this.dashboard.incrementStat('searchesComplete');
        if (data.id) {
          this.canvas.updateNodeStatus(data.id, 'complete');
        }
        break;

      case 'listing:found':
        this.dashboard.incrementStat('listingsFound');
        break;

      case 'listing:filtered':
        this.dashboard.incrementStat('listingsFiltered');
        if (data.reason) {
          this.dashboard.addFilterReason(data.reason);
        }
        break;

      case 'listing:matched':
        this.dashboard.incrementStat('listingsMatched');
        this.dashboard.addMatch({
          ...data.listing,
          source,
          timestamp: event.timestamp,
        });
        // Burst effect on the source agent node
        this.canvas.burstParticles(source, 12);
        break;

      case 'cycle:start':
        this.dashboard.reset();
        this.canvas.nodes.clear();
        this.canvas.edges = [];
        // Re-add orchestrator
        this.canvas.addNode({
          id: 'orchestrator',
          type: 'orchestrator',
          label: 'Orchestrator',
          x: this.canvas.width / 2,
          y: 60,
          fixed: true,
        });
        break;

      case 'cycle:end':
        // Mark all nodes as complete
        for (const node of this.canvas.nodes.values()) {
          node.status = 'complete';
        }
        break;

      case 'error':
        // Could add error visualization
        break;
    }
  }

  initializeState(data) {
    // Set start time
    if (data.startTime) {
      this.dashboard.setStartTime(data.startTime);
    }

    // Initialize stats
    if (data.stats) {
      this.dashboard.updateStats(data.stats);
    }

    // Initialize nodes
    if (data.nodes) {
      for (const node of data.nodes) {
        this.canvas.addNode(node);
      }
    }

    // Initialize matches
    if (data.recentMatches) {
      for (const match of data.recentMatches.reverse()) {
        this.dashboard.addMatch(match);
      }
    }
  }

  toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
      section.classList.toggle('collapsed');
    }
  }

  toggleAutoScroll() {
    const isEnabled = this.eventFeed.toggleAutoScroll();
    const button = document.getElementById('feed-toggle');
    button.textContent = `Auto-scroll: ${isEnabled ? 'ON' : 'OFF'}`;
    button.classList.toggle('paused', !isEnabled);
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
