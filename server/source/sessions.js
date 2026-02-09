const crypto = require("crypto");

const sessions = new Map();
const ttl = 60 * 60 * 1000; // 1 hour

function create_sesh(username) {
    const token = crypto.randomBytes(32).toString("hex");
    const expire = Date.now() + ttl;
    sessions.set(token, { username, expire });
    return { token, expire };
}

function validate_sesh(token) {
    const sesh = sessions.get(token);
    if (!sesh) return null;
    
    // delete invalid tokens
    if (Date.now() > sesh.expire) {
        sessions.delete(token);
        return null;
    }
    return sesh;
}

module.exports = { create_sesh, validate_sesh };