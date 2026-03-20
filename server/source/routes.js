const { handle_login, handle_reg } = require("./auth");
const { list_users } = require("./users");
const { handleUpload, handleDownload } = require("./files");

// Basic CORS, just testing
function Http(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*"); //anybody
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS"); //so far

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

    // login
    if (req.method === "POST" && req.url === "/login") {
        return handle_login(req, res);
    }

    // register
    if (req.method === "POST" && req.url === "/register") {
        return handle_reg(req, res);
    }

    // list (registered only)
    if (req.method === "GET" && req.url === "/users") {
        const users = list_users();
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ users }));
    }

    // file upload
    if (req.method === "POST" && req.url === "/upload") {
        return handleUpload(req, res);
    }

    // file download
    if (req.method === "GET" && req.url.startsWith("/download/")) {
        const fileName = req.url.split("/download/")[1];
        return handleDownload(req, res, fileName);
    }

    // error handling
    res.writeHead(404, { "Content-Type": "application/json" }); //basic
    res.end(JSON.stringify({ error: "not found" }));
}

module.exports = { Http };
