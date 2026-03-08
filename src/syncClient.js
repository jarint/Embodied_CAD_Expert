// syncClient.js — Browser-side WebSocket client for state sync

let ws = null;
let remoteStateCallback = null;
let reconnectTimer = null;
let reconnectDelay = 500;
const MAX_RECONNECT_DELAY = 5000;

export function initSyncClient() {
  connect();
}

function connect() {
  // Use wss:// when page is served over HTTPS (port 3002), ws:// otherwise (port 3001).
  // This avoids mixed-content blocking on HTTPS pages.
  const isSecure = location.protocol === 'https:';
  const url = isSecure
    ? `wss://${location.hostname}:3002`
    : `ws://${location.hostname}:3001`;

  try {
    ws = new WebSocket(url);
  } catch (e) {
    console.warn('[Sync] WebSocket blocked (likely mixed content on HTTPS). Sync disabled.');
    updateConnectionStatus(false);
    return;
  }

  ws.onopen = () => {
    console.log('[Sync] Connected to', url);
    reconnectDelay = 500;
    updateConnectionStatus(true);
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'state-update' && remoteStateCallback) {
        remoteStateCallback(msg.payload);
      }
    } catch (e) {
      console.error('[Sync] Failed to parse message:', e);
    }
  };

  ws.onclose = () => {
    updateConnectionStatus(false);
    scheduleReconnect();
  };

  ws.onerror = () => {
    // onclose will fire after this, handling reconnection
  };
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
    connect();
  }, reconnectDelay);
}

export function broadcastState(calloutStoreData) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'state-update',
      payload: calloutStoreData
    }));
  }
}

export function onRemoteState(callback) {
  remoteStateCallback = callback;
}

function updateConnectionStatus(connected) {
  const el = document.getElementById('connection-status');
  if (!el) return;
  if (connected) {
    el.textContent = '\u25cf Synced';
    el.style.color = '';
  } else {
    el.textContent = '\u25cb Offline';
    el.style.color = '#e04040';
  }
}
