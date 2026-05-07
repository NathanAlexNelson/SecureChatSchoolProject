const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const bcrypt_rounds = 12; // pass scramble 

// username validation 
const username_valid = /^[a-zA-Z0-9_-]{3,32}$/; // 3-32 characters; safe input only
// pass size
const password_min = 8;
const password_max = 128;

// DB
const prod = process.env.ENV_NODE === "production";
let pool = null;
    if (prod) {
        pool = mysql.createPool({ host: process.env.DB_HOST, 
                                  user: process.env.DB_USER,
                                  password: process.env.DB_PASS,
                                  database: process.env.DB_NAME,
                                  waitForConnections: true,
                                  connectionLimit: 5,
                                  queueLimit: 0,
                                  ssl: { rejectUnauthorized: false } });
    }

// FALLBACK for local
// users persist to json 
const base = path.dirname(process.execPath);
const users_file = path.join(base, "data/users.json");

// load from json
function load_user() {
    try {
        if (!fs.existsSync(users_file)) return {};
        const raw = fs.readFileSync(users_file, "utf8");
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

// writes user info to disk
function save_user(data) {
    const temp = users_file + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(temp, users_file); // writes to temp file then rename to prevent crashing
}

// find stored hash & compare w/ bcrypt (updated to load users from disk)
// updated for API
async function verify_cred(username, password) {
    if (prod) {
        const [rows] = await pool.execute("SELECT password_hash FROM users WHERE username = ?", [username]);
        if (rows.length === 0) return false;
        return bcrypt.compare(password, rows[0].password_hash);
    } else {
        const data = load_user();
        const user = data[username];
        if (!user) return false;
        return bcrypt.compare(password, user.password_hash);
    }
}

// registering users (validates both prod and local)
async function reg_user(username, password) {
    // error handling
    if (!username_valid.test(username)) {
        return { ok: false,
                 error: "Username must be 3-32 characters long; use only letters, numbers, underscores, or hyphens"};
    }
    if (typeof password !== "string") {
        return { ok: false,
                 error: "Password must be a string"};
    } 
    if (password.length < password_min) {
        return { ok: false,
                 error: "Password must be at least 8 characters long"};
    }
    if (password.length > password_max) {
        return { ok: false,
                 error: "Password too long, cannot be more than 32 characters"};
    }
    // hashed pass added to data w/ timestamp
    const password_hash = await bcrypt.hash(password, bcrypt_rounds);

    // mysql branch
    if (prod) {
        // check dupe
        const [existing] = await pool.execute("SELECT username FROM users WHERE username = ?", [username]);
        if (existing.length > 0) {
            return { ok: false, error: "User already exists" };
        }
        // new user
        await pool.execute("INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)", [username, password_hash, Date.now()]);
    } else {
        const data = load_user();
    if (data[username]) {
        return { ok: false,
                 error: "User already exists"};
    }
    data[username] = { username,
                       password_hash,
                       created_at: Date.now()};
    save_user(data);
    }
    return {ok:true};
}

// returns ONLY username as array 
function list_users() {
    if (prod) {
        const [rows] = await pool.execute("SELECCT username FROM users");
        return rows.map(r => r.username);
    } else {
        const data = load_user();
        return Object.keys(data);
    }
}

module.exports = { verify_cred, reg_user, list_users };