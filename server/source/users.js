const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const base = path.dirname(process.execPath);

// users persist to json 
const users_file = path.join(base, "data/users.json");
const bcrypt_rounds = 12; // pass scramble 

// username validation 
const username_valid = /^[a-zA-Z0-9_-]{3,32}$/; // 3-32 characters; safe input only
// pass size
const password_min = 8;
const password_max = 128;

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
async function verify_cred(username, password) {
    const data = load_user();
    const user = data[username];
    if (!user) return false;
    return bcrypt.compare(password, user.password_hash);
}

// registering users
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

    const data = load_user();
    if (data[username]) {
        return { ok: false,
                 error: "User already exists"};
    }

    // hashed pass added to data w/ timestamp
    const password_hash = await bcrypt.hash(password, bcrypt_rounds);
    data[username] = { username,
                       password_hash,
                       created_at: Date.now()};
    save_user(data);
    return {ok:true};
}

// returns ONLY username as array 
function list_users() {
    const data = load_user();
    return Object.keys(data);
}

module.exports = { verify_cred, reg_user, list_users };