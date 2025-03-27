const WebSocket = require("ws");
const Y = require("yjs");
const { setupWSConnection } = require("y-websocket/bin/utils");
const http = require("http");
const url = require("url");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
const serviceAccount = process.env.SERVICE_ACCOUNT
  ? JSON.parse(process.env.SERVICE_ACCOUNT)
  : require("./serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Create an HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("WebSocket server for CollabX");
});

// Create a WebSocket server
const wss = new WebSocket.Server({ server });

// Map to hold Yjs documents for each session-language combo
const docs = new Map();

// Function to get or create a Yjs document for a session-language
function getYDoc(sessionId) {
  if (!docs.has(sessionId)) {
    const ydoc = new Y.Doc();
    docs.set(sessionId, ydoc);
    console.log(`Created new Yjs document for ${sessionId}`);
  }
  return docs.get(sessionId);
}

// Handle WebSocket connections
wss.on("connection", (ws, req) => {
  const parsedUrl = url.parse(req.url, true);
  const sessionId = parsedUrl.query.sessionId;
  const token = parsedUrl.query.token;

  console.log(
    `Connection attempt: sessionId=${sessionId}, token=${
      token ? "provided" : "missing"
    }`
  );

  if (!sessionId || !token) {
    console.log(`Closing connection: Missing sessionId or token`);
    ws.close(1008, "Missing sessionId or token");
    return;
  }

  // Log the full token for debugging
  console.log(`Received token: ${token}`);

  // Verify the token with Firebase Admin SDK
  admin
    .auth()
    .verifyIdToken(token)
    .then((decodedToken) => {
      const uid = decodedToken.uid;
      console.log(`✅ User ${uid} connected to ${sessionId}`);

      const ydoc = getYDoc(sessionId);
      setupWSConnection(ws, req, { doc: ydoc });

      ydoc.on("update", () => {
        console.log(`Document updated for ${sessionId}`);
      });
    })
    .catch((error) => {
      console.error(`❌ Token verification failed for ${sessionId}:`, error);
      ws.close(1008, "Invalid token");
    });
});

// Clean up documents (optional, if needed)
wss.on("close", () => {
  docs.forEach((doc) => doc.destroy());
  docs.clear();
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});
