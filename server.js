const WebSocket = require('ws');
const Y = require('yjs');
const { setupWSConnection } = require('y-websocket/bin/utils');
const http = require('http');
const url = require('url');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Create an HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket server for CollabX');
});

// Create a WebSocket server
const wss = new WebSocket.Server({ server });

// Map to hold Yjs documents for each session
const docs = new Map();

// Function to get or create a Yjs document for a session
function getYDoc(sessionId) {
  if (!docs.has(sessionId)) {
    const ydoc = new Y.Doc();
    docs.set(sessionId, ydoc);
  }
  return docs.get(sessionId);
}

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  const parsedUrl = url.parse(req.url, true);
  const sessionId = parsedUrl.query.sessionId;
  const token = parsedUrl.query.token;

  // Validate sessionId and token
  if (!sessionId || !token) {
    ws.close(1008, 'Missing sessionId or token');
    return;
  }

  // Verify Firebase Authentication token
  admin.auth().verifyIdToken(token)
    .then((decodedToken) => {
      const uid = decodedToken.uid; // User ID from token
      console.log(`User ${uid} connected to session ${sessionId}`);

      // Get or create the Yjs document for this session
      const ydoc = getYDoc(sessionId);

      // Set up the WebSocket connection with Yjs
      setupWSConnection(ws, req, { doc: ydoc });
    })
    .catch((error) => {
      console.error('Token verification failed:', error);
      ws.close(1008, 'Invalid token');
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});