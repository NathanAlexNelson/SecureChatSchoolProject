// imports
const https = require("https");
const fs = require("fs");
const { WebSocketServer } = require("ws");

// config & handlers
const { HOST, PORT, CERT_PATH, KEY_PATH } = require("./config");
const { Http } = require("./routes");
const { websocketcon } = require("./ws");


const key = fs.readFileSync(KEY_PATH);
const cert = fs.readFileSync(CERT_PATH);
const server = https.createServer({ key, cert }, Http);

// connect ws to server
const wss = new WebSocketServer({ server });
wss.on("connection", (ws, req) => websocketcon(ws, req, wss));

server.listen(PORT, HOST, () => {
    console.log(`HTTPS: https://${HOST}:${PORT}`);
    console.log(`WS: wss://${HOST}:${PORT}`);
})