// imports
const https = require("https");
const fs = require("fs");
const { WebSocketServer } = require("ws");

// config & handlers
const { HOST, PORT, CERT_PATH, KEY_PATH } = require("./config");
const { Http } = require("./routes");
const { websocketcon } = require("./ws");

// HTTP on Render but HTTPS locally
const prod = process.env.NODE_ENV === "production";
let server;
if (prod) {
  const http = require("http");
  server = http.createServer(Http);
  console.log("Running in production mode (HTTP)");
} else {
  const https = require("https");
  const key = fs.readFileSync(KEY_PATH);
  const cert = fs.readFileSync(CERT_PATH);
  server = https.createServer({ key, cert }, Http);
  console.log("Running in development mode (HTTPS)");
}

// connect ws to server
const wss = new WebSocketServer({ server });
// This below is for the heartbeat
const HEARTBEAT_MS = 30_000;

const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_MS);

wss.on("close", () => clearInterval(heartbeatInterval));

// delegate connection handling
wss.on("connection", (ws, req) => websocketcon(ws, req, wss));

server.listen(PORT, HOST, () => {
  const protocol = prod ? "http" : "https";
  const ws_protocol = prod ? "ws" : "wss";
  console.log(`Server: ${protocol}://${HOST}:${PORT}`);
  console.log(`WS: ${ws_protocol}://${HOST}:${PORT}`);
})