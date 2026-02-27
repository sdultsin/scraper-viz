import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PORT = 3847;
const CLIENT_DIR = join(__dirname, '..', 'client');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

// HTTP server for static files
const server = createServer(async (req, res) => {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = join(CLIENT_DIR, filePath);

  try {
    const content = await readFile(filePath);
    const ext = extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'text/plain' });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

// WebSocket server
const wss = new WebSocketServer({ server });
const clients = new Set();

// State tracking for connected clients
let state = {
  nodes: new Map(),
  stats: {
    searchesTotal: 0,
    searchesComplete: 0,
    listingsFound: 0,
    listingsFiltered: 0,
    listingsMatched: 0,
    bySource: { fameswap: 0, swapd: 0, z2u: 0 },
    filterReasons: {},
  },
  recentMatches: [],
  startTime: Date.now(),
};

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`Client connected (${clients.size} total)`);

  // Send current state to new client
  ws.send(JSON.stringify({
    type: 'state:init',
    data: {
      nodes: Array.from(state.nodes.values()),
      stats: state.stats,
      recentMatches: state.recentMatches,
      startTime: state.startTime,
    },
  }));

  ws.on('message', (data) => {
    try {
      const event = JSON.parse(data);
      handleEvent(event);
      // Broadcast to all clients
      broadcast(event);
    } catch (e) {
      console.error('Invalid message:', e);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`Client disconnected (${clients.size} total)`);
  });
});

function handleEvent(event) {
  const { type, source, data } = event;

  switch (type) {
    case 'agent:spawn':
    case 'worker:spawn':
      state.nodes.set(data.id, {
        id: data.id,
        type: type.split(':')[0],
        source,
        label: data.label,
        parentId: data.parentId,
        status: 'active',
        timestamp: event.timestamp,
      });
      break;

    case 'search:start':
      state.stats.searchesTotal++;
      state.stats.bySource[source]++;
      break;

    case 'search:complete':
      state.stats.searchesComplete++;
      break;

    case 'listing:found':
      state.stats.listingsFound++;
      break;

    case 'listing:filtered':
      state.stats.listingsFiltered++;
      if (data.reason) {
        state.stats.filterReasons[data.reason] = (state.stats.filterReasons[data.reason] || 0) + 1;
      }
      break;

    case 'listing:matched':
      state.stats.listingsMatched++;
      state.recentMatches.unshift({
        ...data.listing,
        source,
        timestamp: event.timestamp,
      });
      if (state.recentMatches.length > 5) {
        state.recentMatches.pop();
      }
      break;

    case 'cycle:start':
      // Reset state for new cycle
      state.nodes.clear();
      state.stats = {
        searchesTotal: 0,
        searchesComplete: 0,
        listingsFound: 0,
        listingsFiltered: 0,
        listingsMatched: 0,
        bySource: { fameswap: 0, swapd: 0, z2u: 0 },
        filterReasons: {},
      };
      state.startTime = Date.now();
      break;
  }
}

function broadcast(event) {
  const message = JSON.stringify(event);
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(message);
    }
  }
}

server.listen(PORT, () => {
  console.log(`\n  Scraper Visualization Server`);
  console.log(`  ────────────────────────────`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  WS:      ws://localhost:${PORT}\n`);
});
