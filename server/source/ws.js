const url = require("url");
const { validate_sesh } = require("./sessions");

function websocketcon(ws, req, wss) {
    const parsed = url.parse(req.url, true);
    const token = parsed.query.token;
    const sesh = validate_sesh(token);

    // reject invalid connections
    if (!sesh) {
        ws.close(1008, "unauthorized"); // 1008 = policy violation
        return;
    }
    const username = sesh.username; // tie user to socket

    // confirmation
    ws.send(JSON.stringify({ type: "system",
                             event: "connected",
                             user: username,
                             ts: Date.now() })) // for logging
    // client message
    ws.on("message", (raw) => {
        const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw); //normalize the input for ws

        ws.send(JSON.stringify({ type: "echo",
                                 from: username,
                                 text,
                                 ts: Date.now() }))
    });

    ws.on("close", () => {
        // cleanup user connection tracking l8r
    })
}

module.exports = { websocketcon };