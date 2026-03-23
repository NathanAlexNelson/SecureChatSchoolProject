// if users reconnect, new log file will be made with one per sesh

const fs = require("fs");
const path = require("path");

const base = path.dirname(process.execPath);
const logdir = path.join(base, "logs");

if (!fs.existsSync(logdir)) {
    fs.mkdirSync(logdir, { recursive: true }) // no error if parent folders missing; makes folder automatically
}

const logmap = new Map();

// key always formats alphabetically regardless of first sender
function key_pair(firstuser, secuser) {
    return [firstuser, secuser].sort().join(":");
}

// file format as yyyy-mm-dd_time
function timestampfile() {
    const rn = new Date();
    const date = rn.toISOString().slice(0, 10);
    const time = rn.toTimeString().slice(0, 8).replace(/:/g, "");
    return `${date}_${time}`;
}

function ts_entry() {
    const rn = new Date();
    return `[${rn.toISOString().replace("T", " ").slice(0, 19)}]`;
}

function log_msg(from, to, text) {
    const key = key_pair(from, to);
    // if no log file
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

// checks if users disconnected
function close_log(username) {
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

module.exports = { log_msg, close_log };