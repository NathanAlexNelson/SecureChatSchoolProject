const { verify_cred, reg_user } = require("./users");
const { create_sesh } = require("./sessions");
const { lockout_check, fail_record, success_record } = require("./brutes");

// read json from incoming http request 
function read_json(req) {
    return new Promise((resolve, reject) => {
        let data = "";

        // concatenate data chunks until end
        req.on("data", (chunk) => {
            data += chunk;

            // reject big ahh bodies
            if (data.length > 1_000_000) { // cap @ 1mb; prevent DoS
                reject(new Error("Body too large"));
                req.destroy();
            }
        });
        req.on("end", () => {
            try {
                resolve(JSON.parse(data || "{}")); // {} if empty parse
            } catch {
                reject(new Error("Invalid JSON"));
            }
        });
    });
}

// POST login
async function handle_login(req, res) {
    try {
        const body = await read_json(req);

        // normalize
        const username = String(body.username || "").trim();
        const password = String(body.password || "");

        if (!username || !password) {
            res.writeHead(400, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "username and password required" }));
        }

        let ip = req.socket?.remoteAddress || "unknown"; // ? for optional chaining & unknown for fallback
        if (ip.startsWith("::ffff:")) { // normalize ip
            ip = ip.slice(7);
        }

        const lockout = lockout_check(ip, username);
        if (lockout.locked) {
            res.writeHead(429, { "Content-Type": "application/json" }); // rate limiting
            return res.end(JSON.stringify({
                error: `Fail too many times. Try again in ${lockout.retry_after_sec} seconds`,
                retry_after_sec: lockout.retry_after_sec}));
        } 

        // check against bcrypt (added fail recording)
        const ok = await verify_cred(username, password);
        if (!ok) {
            fail_record(ip, username);
            res.writeHead(401, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "invalid login info" }));
        }

        success_record(ip, username);
        const { token, expire } = create_sesh(username);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ token, expire }));
    }
    catch (err) {
        // error handle big ahh bodies or invalid json
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
    }
}

// POST register 
async function handle_reg(req, res) {
    try {
        const body = await read_json(req);
        const username = String(body.username || "").trim(); // normalize both username & pass 
        const password = String(body.password || "");
        if (!username || !password) {
            res.writeHead(400, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Both username & password is required to register"}));
        }

        const reg_result = await reg_user(username, password);
        if (!reg_result.ok) {
            res.writeHead(409, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: reg_result.error })); // returns specific error msg from 409 http stat
        }

        const { token, expire } = create_sesh(username); // autologin
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ token, expire, username }));
    } catch (error) { // safe than sorry u alr know
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message })); 
    }
}

module.exports = { handle_login, handle_reg };