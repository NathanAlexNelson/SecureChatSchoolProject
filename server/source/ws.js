const url = require("url");
const { validate_sesh } = require("./sessions");
const { key_store, get_key, remove_key } = require("./crypt");
const { log_msg, close_log } = require("./log");

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

const client_user = new Map(); // username --> ws
const user_socket = new Map(); // ws --> username

function send_json(ws, obj) {
    if (!ws || ws.readyState !== ws.OPEN) return;
    ws.send(JSON.stringify(obj));
}

// notification system
function broadcast(obj, except_ws = null) {
    const message = JSON.stringify(obj);
    for (const ws of client_user.values()) {
        if (ws !== except_ws && ws.readyState === ws.OPEN) ws.send(message);
    }
}

// handle closed sockets
function clean(ws) {
    const username = user_socket.get(ws);
    if (!username) return;
    
    const current = client_user.get(username);
    if (current === ws) client_user.delete(username);
    user_socket.delete(ws);

    // phase 2
    remove_key(username); // rid their key as well
    close_log(username); // close log on top

    // disconnect notification
    broadcast({ type: "system",
                event: "leave",
                user: username,
                ts: Date.now() },
                ws);
}

function list_online() {
    return Array.from(client_user.keys());
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

    // allows reconnects 
    const old = client_user.get(username);
    if (old && old !== ws) {
            send_json(old, { type: "system",
                             event: "kicked",
                             reason: "reconnected",
                             ts: Date.now() 
            });

            old.close(4000, "reconnected");
    } 

    client_user.set(username, ws);
    user_socket.set(ws, username);

    send_json(ws, { type: "system", 
                    event: "connected",
                    user: username,
                    online: list_online(),
                    ts: Date.now(),
    });

    // join notification
    broadcast({ type: "system",
                event: "join",
                user: username,
                ts: Date.now() },
                ws);

    // client message
    ws.on("message", async (raw) => {
        // rate limiting check
        if (isRateLimited(ip)) {
            ws.close(1008, "Rate limit exceeded");
            return;
        }

        let message;
        try {
            const text = Buffer.isBuffer(raw)
            ? raw.toString("utf8")
            : String(raw); // normalize the input for ws

            message = JSON.parse(text);
        } catch {
            send_json(ws, { type: "error", 
                            code: "BAD_JSON",
                            message: "Invalid JSON",
                            ts: Date.now()
            });
            return;
        }

        if (!message || typeof message.type !== "string") {
            send_json(ws, { type: "error", 
                            code: "BAD_FORMAT",
                            message: "Missing message type",
                            ts: Date.now()
            });
            return;
        }

        if (message.type === "pubk_register") {
            const pubk = String(message.pubk || "").trim();

            if (!pubk) {
                send_json(ws, { type: "error", 
                                code: "PUBLICKEY_INVALID",
                                message: "pubk_register needs {pubk} to work",
                                ts: Date.now()
                });
                return;
            }
            key_store(username, pubk); // store after reg & handling
            send_json(ws, { type: "pubkey_register_ack", ts: Date.now() }); // ready for use; front end handle 
            return;
        }

        // request user for public key to encrypt session key
        if (message.type === "pubk_request") {
            const receiver = String(message.username || "").trim();
            if (!receiver) {
                send_json(ws, { type: "error", 
                                code: "PUBKEY_REQ_INVALID",
                                message: "pubk_request needs {username} to send to",
                                ts: Date.now()
                });
                return;
            }

            const pubk = get_key(receiver);
            if (!pubk) {
                send_json(ws, { type: "error", 
                                code: "PUBKEY_NOT_FOUND",
                                message: `${receiver} doesn't have a public key`,
                                ts: Date.now()
                });
                return;
            }

            send_json(ws, { type: "pubk_response", 
                            username: receiver,
                            pubk,
                            ts: Date.now()
            });
            return; //forgot
        }

        // DM (doesn't pass plaintext anymore all cipher)
        if (message.type === "chat") {
            const to = String(message.to || "").trim();
            const text = String(message.text || "");

            if (!to || !text) {
                send_json(ws, { type: "error", 
                                code: "CHAT_INVALID",
                                message: "chat needs {to, text}",
                                ts: Date.now()
                });
                return;
            }

            const to_socket = client_user.get(to);
            if (!to_socket) {
                send_json(ws, { type: "error", 
                                code: "USER_OFFLINE",
                                message: `user is offline: ${to}`,
                                ts: Date.now()
                });
                return;
            }

            send_json(to_socket, { type: "chat", 
                                   from: username,
                                   text,
                                   ts: Date.now()
            });

            // phase 2 logging messages
            await log_msg(username, to, text);
            
            send_json(ws, { type: "chat_ack", 
                            to,
                            ts: Date.now()
            });
            return;
        }

        if (message.type === "typing") {
            const to = String(message.to || "").trim();
            if (!to) return;
            const to_socket = client_user.get(to);
            if (!to_socket) return;

            send_json(to_socket, { type: "typing", 
                                   from: username,
                                   ts: Date.now() });
            return;
        }
        
        // error handling (error handled the error handle)
        send_json(ws, { type: "error",
                        code: "UNKNOWN_TYPE",
                        message: `unknown type: ${message.type}`,
                        ts: Date.now()
        });
    });
    ws.on("close", () => clean(ws));
    ws.on("error", () => clean(ws));
}

module.exports = { websocketcon, list_online };
