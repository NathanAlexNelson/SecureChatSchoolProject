function websocketcon(ws, req, wss) {
    // confirmation
    ws.send(JSON.stringify({ type: "system",
                             event: "connected",
                             ts: Date.now() })) //ts for log
    ws.on("message", (raw) => {
        const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw); //normalize the input for ws

        ws.send(JSON.stringify({ type: "echo",
                                 text,
                                 ts: Date.now() }))
    });
}

module.exports = { websocketcon };