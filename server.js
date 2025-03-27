const WebSocket = require('ws');
const Y = require('yjs');
const { setupWSConnection } = require('y-websocket/bin/utils');
const http = require('http');
const url = require('url');

// Create an HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket server for CollabX');
});

// Create a WebSocket server
const wss = new WebSocket.Server({ server });

// Map to hold Yjs documents for each unique sessionId (including language)
const docs = new Map();

// Function to get or create a Yjs document for a full sessionId
function getYDoc(fullSessionId) {
  if (!docs.has(fullSessionId)) {
    const ydoc = new Y.Doc();
    docs.set(fullSessionId, ydoc);
    console.log(`Created new Yjs document for ${fullSessionId}`);
    
    // Clean up document when no clients are connected (optional)
    ydoc.on('destroy', () => {
      docs.delete(fullSessionId);
      console.log(`Destroyed Yjs document for ${fullSessionId}`);
    });
  }
  return docs.get(fullSessionId);
}

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  const parsedUrl = url.parse(req.url, true);
  const fullSessionId = parsedUrl.query.sessionId;

  console.log(`Connection attempt: sessionId=${fullSessionId}`);

  if (!fullSessionId) {
    console.log(`Closing connection: Missing sessionId`);
    ws.close(1008, 'Missing sessionId');
    return;
  }

  console.log(`✅ Connected to ${fullSessionId}`);
  const ydoc = getYDoc(fullSessionId);

  // Pass fullSessionId as the room name to setupWSConnection
  setupWSConnection(ws, req, { doc: ydoc, docName: fullSessionId });

  // Log document updates for debugging
  ydoc.on('update', () => {
    console.log(`Document updated for ${fullSessionId}`);
  });

  // Log connection closure
  ws.on('close', () => {
    console.log(`Client disconnected from ${fullSessionId}`);
    const clients = wss.clients.size;
    if (clients === 0 && docs.has(fullSessionId)) {
      const doc = docs.get(fullSessionId);
      doc.destroy(); // Clean up if no clients remain
    }
  });
});

// Clean up all documents on server shutdown (optional)
wss.on('close', () => {
  docs.forEach((doc) => doc.destroy());
  docs.clear();
  console.log('WebSocket server closed, all documents destroyed');
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});