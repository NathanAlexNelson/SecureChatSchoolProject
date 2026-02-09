const url = require("url");
const { validate_sesh } = require("./sessions");

// ===== Rate limiting (per-IP sliding window) =====
const rateMap = new Map();
const WINDOW_MS = 10_000; // 10 seconds
const MAX_MSGS = 25;

function isRateLimited(ip) {
    const now = Date.now();
    let entry = rateMap.get(ip);

    if (!entry || now - entry.start > WINDOW_MS) {
        entry = { start: now, count: 0 };
        rateMap.set(ip, entry);
    }

    entry.count += 1;
    return entry.count > MAX_MSGS;
}

// cleanup so map doesn't grow forever
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of rateMap.entries()) {
        if (now - entry.start > WINDOW_MS * 6) rateMap.delete(ip);
    }
}, WINDOW_MS * 6);

// ===== Heartbeat helper =====
function heartbeat() {
    this.isAlive = true;
}

function websocketcon(ws, req, wss) {
    const parsed = url.parse(req.url, true);
    const token = parsed.query.token;
    const sesh = validate_sesh(token);

    // reject invalid connections
    if (!sesh) {
        ws.close(1008, "unauthorized"); // 1008 = policy violation
        return;
    }

    let ip =
        req.socket && req.socket.remoteAddress
            ? req.socket.remoteAddress
            : "unknown";

    // normalize IPv6-mapped IPv4 (optional but helpful)
    if (ip.startsWith("::ffff:")) ip = ip.slice(7);

    // enable heartbeat for this socket (server.js pings; this marks alive on pong)
    ws.isAlive = true;
    ws.on("pong", heartbeat);

    const username = sesh.username; // tie user to socket

    // confirmation
    ws.send(JSON.stringify({
        type: "system",
        event: "connected",
        user: username,
        ts: Date.now()
    })); // for logging

    // client message
    ws.on("message", (raw) => {
        // rate limiting check
        if (isRateLimited(ip)) {
            ws.close(1008, "Rate limit exceeded");
            return;
        }

        const text = Buffer.isBuffer(raw)
            ? raw.toString("utf8")
            : String(raw); // normalize the input for ws

        ws.send(JSON.stringify({
            type: "echo",
            from: username,
            text,
            ts: Date.now()
        }));
    });

    ws.on("close", () => {
        // cleanup user connection tracking l8r
    });
}

module.exports = { websocketcon };
