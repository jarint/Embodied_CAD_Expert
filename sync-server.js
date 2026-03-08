// sync-server.js — WebSocket relay server for multi-client state sync
// Serves both ws:// (3001) and wss:// (3002) so HTTPS clients can connect
import { WebSocketServer } from 'ws';
import { createServer } from 'https';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WS_PORT = 3001;
const WSS_PORT = 3002;

let latestState = {};
const allServers = []; // all WebSocketServers, for cross-server broadcast

// --- Plain WS server (for localhost / HTTP clients) ---
const wsServer = new WebSocketServer({ port: WS_PORT });
allServers.push(wsServer);
setupServer(wsServer, 'ws');
console.log(`[Sync] WS  server on ws://localhost:${WS_PORT}`);

// --- Secure WSS server (for HTTPS / LAN clients) ---
const certPath = resolve(__dirname, 'node_modules/.vite/basic-ssl/_cert.pem');
if (existsSync(certPath)) {
  const pem = readFileSync(certPath);
  const httpsServer = createServer({ key: pem, cert: pem });
  const wssServer = new WebSocketServer({ server: httpsServer });
  allServers.push(wssServer);
  setupServer(wssServer, 'wss');
  httpsServer.listen(WSS_PORT, () => {
    console.log(`[Sync] WSS server on wss://localhost:${WSS_PORT}`);
  });
} else {
  console.warn(`[Sync] No SSL cert at ${certPath}. Run "npm run dev" once first to generate it, then restart sync.`);
  console.warn(`[Sync] WSS not available — LAN HTTPS clients won't sync.`);
}

// --- Shared connection handler ---
function setupServer(server, label) {
  server.on('connection', (ws) => {
    console.log(`[Sync][${label}] Client connected (${server.clients.size} total)`);

    ws.send(JSON.stringify({ type: 'state-update', payload: latestState }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'state-update') {
          latestState = msg.payload;
          broadcastToOthers(ws, raw.toString());
        }
      } catch (e) {
        console.error(`[Sync][${label}] Bad message:`, e);
      }
    });

    ws.on('close', () => {
      console.log(`[Sync][${label}] Client disconnected (${server.clients.size} total)`);
    });
  });
}

// Broadcast to all clients across ALL servers (except sender)
function broadcastToOthers(sender, data) {
  for (const server of allServers) {
    for (const client of server.clients) {
      if (client !== sender && client.readyState === 1) {
        client.send(data);
      }
    }
  }
}
