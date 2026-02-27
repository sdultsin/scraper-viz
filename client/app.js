// app.js - Main application orchestrator

import { Canvas } from './components/Canvas.js';
import { Dashboard } from './components/Dashboard.js';
import { EventFeed } from './components/EventFeed.js';

class App {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    this.reconnectDelay = 1000;
    this.demoMode = false;
    this.demoInterval = null;

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

    // Check for demo mode in URL or if deployed (not localhost)
    const isDeployed = !window.location.hostname.includes('localhost') &&
                       !window.location.hostname.includes('127.0.0.1');
    const urlParams = new URLSearchParams(window.location.search);

    if (urlParams.has('demo') || isDeployed) {
      this.startDemoMode();
    } else {
      this.connect();
    }

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
      // Fall back to demo mode
      console.log('WebSocket connection failed, starting demo mode');
      this.startDemoMode();
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

  startDemoMode() {
    this.demoMode = true;
    this.setConnectionStatus('connected', 'Demo Mode');

    const sources = ['fameswap', 'swapd', 'z2u'];
    const searchTerms = [
      'twitter ai account', 'tech influencer', 'crypto twitter',
      'gaming channel', 'finance account', 'startup founder'
    ];
    const filterReasons = [
      'blocked_category', 'low_niche_score', 'over_budget',
      'wtb_title', 'service_content', 'too_few_followers'
    ];
    const handles = [
      '@TechNewsDaily', '@AIStartupGuy', '@CryptoTrader99',
      '@DevCommunity', '@StartupWeekly', '@CodeMaster',
      '@DataScienceHub', '@MLEngineer', '@ProductHunter'
    ];

    let searchId = 0;
    let workerId = 0;

    // Spawn agents
    sources.forEach((source, i) => {
      setTimeout(() => {
        this.handleEvent({
          type: 'agent:spawn',
          source,
          timestamp: Date.now(),
          data: { id: source, label: source.charAt(0).toUpperCase() + source.slice(1) }
        });
      }, i * 300);
    });

    // Main demo loop
    setTimeout(() => {
      this.demoInterval = setInterval(() => {
        const source = sources[Math.floor(Math.random() * sources.length)];
        const rand = Math.random();

        if (rand < 0.15) {
          // Spawn worker
          const id = `worker-${workerId++}`;
          this.handleEvent({
            type: 'worker:spawn',
            source,
            timestamp: Date.now(),
            data: { id, label: `Page ${Math.floor(Math.random() * 10) + 1}`, parentId: source }
          });
        } else if (rand < 0.25) {
          // Start search
          const id = `search-${searchId++}`;
          const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];
          this.handleEvent({
            type: 'search:start',
            source,
            timestamp: Date.now(),
            data: { id, label: term }
          });
          // Complete it after a delay
          setTimeout(() => {
            this.handleEvent({
              type: 'search:complete',
              source,
              timestamp: Date.now(),
              data: { id }
            });
          }, 2000 + Math.random() * 3000);
        } else if (rand < 0.5) {
          // Found listing
          this.handleEvent({
            type: 'listing:found',
            source,
            timestamp: Date.now(),
            data: { listing: { title: handles[Math.floor(Math.random() * handles.length)] } }
          });
        } else if (rand < 0.85) {
          // Filtered listing
          this.handleEvent({
            type: 'listing:filtered',
            source,
            timestamp: Date.now(),
            data: { reason: filterReasons[Math.floor(Math.random() * filterReasons.length)] }
          });
        } else {
          // Matched listing!
          const handle = handles[Math.floor(Math.random() * handles.length)];
          const followers = Math.floor(Math.random() * 50000) + 500;
          const price = Math.floor(Math.random() * 500) + 50;
          this.handleEvent({
            type: 'listing:matched',
            source,
            timestamp: Date.now(),
            data: {
              listing: { handle, title: handle, followers, price }
            }
          });
        }
      }, 400 + Math.random() * 600);
    }, 1000);
  }

  stopDemoMode() {
    if (this.demoInterval) {
      clearInterval(this.demoInterval);
      this.demoInterval = null;
    }
    this.demoMode = false;
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
