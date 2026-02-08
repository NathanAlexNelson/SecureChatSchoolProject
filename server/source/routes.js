// Basic CORS, just testing
function Http(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*"); //anybody
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); //so far

    // preflight
    if (req.method === "OPTIONS") {
        res.writeHead(204);
        return res.end();
    }

    // heartbeat
    if (req.method === "GET" && req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: true }));
    }

    res.writeHead(404, { "Content-Type": "application/json" }); //basic
    res.end(JSON.stringify({ error: "not found" }));
}

module.exports = { Http };
