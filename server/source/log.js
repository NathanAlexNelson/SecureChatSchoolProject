// if users reconnect, new log file will be made with one per sesh

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const prod = process.env.NODE_ENV === "production";

// sql pool for prod
let pool = null; 
if (prod) {
    pool = mysql.createPool({ host: process.env.DB_HOST, 
                              user: process.env.DB_USER,
                              password: process.env.DB_PASS,
                              database: process.env.DB_NAME,
                              waitForConnections: true,
                              connectionLimit: 5,
                              queueLimit: 0, });
}

// fallback for local
const base = path.join(__dirname, "..");
const logdir = path.join(base, "logs");

if (!prod && !fs.existsSync(logdir)) {
    fs.mkdirSync(logdir, { recursive: true }) // no error if parent folders missing; makes folder automatically
}

// tracks session starts times per pair keys
const logmap = new Map();
const session_starts = new Map(); 

// key always formats alphabetically regardless of first sender
function key_pair(firstuser, secuser) {
    return [firstuser, secuser].sort().join(":");
}

function ts_entry() {
    const rn = new Date();
    return `[${rn.toISOString().replace("T", " ").slice(0, 19)}]`;
}

// api implementation
async function log_msg(from, to, text) {
    const key = key_pair(from, to);
    const ts = Date.now();
    // get/create session start time for pair
    if (prod) {
        if (!session_starts.has(key)) {
            session_starts.set(key, ts);
        }
        const session_start = session_starts.get(key);

        try {
            await pool.execute("INSERT INTO logs (sender, receiver, text, ts, session_start) VALUES (?, ?, ?, ?, ?)",
                               [from, to, text, ts, session_start]);
        } catch (err) {
            console.error("log_msg DB error:", err.message);
        }
    } else {
        // if no log file fallback
        if (!logmap.has(key)) {
            const [firstuser, secuser] = key.split(":");
            const fname = `${firstuser}_${secuser}.txt`;
            const fpath = path.join(logdir, fname);
            // session header
            const header = [`SecureChat Session Log`,
                            `Users: ${firstuser} & ${secuser}`,
                            `Started: ${new Date().toISOString()}`,
                            `${"=".repeat(50)}`,
                            ""].join("\n");
            fs.writeFileSync(fpath, header, "utf8");
            logmap.set(key, fpath);
        }
        const fpath = logmap.get(key);
        const entry = `${ts_entry()} ${from} -> ${to}: ${text}\n`;
        fs.appendFileSync(fpath, entry, "utf8"); // appended to log file
    }
}

// checks if users disconnected
function close_log(username) {
    // clears session start for user pairs
    for (const key of session_starts.keys()) {
        if (key.includes(username)) {
            session_starts.delete(key);
        }
    }

    if (!prod) {
        // flat file (write footer)
        for (const [key, fpath] of logmap.entries()) {
            if (key.includes(username)) {
                const footer = `\n${"=".repeat(50)}\nSession ended: ${new Date().toISOString()}\n`; // clearly end 
                // in case of manual deletion
                try {
                    fs.appendFileSync(fpath, footer, "utf8");
                } catch { /* file might be gone */ }
                logmap.delete(key);
            }
        }
    }
}

module.exports = { log_msg, close_log };
