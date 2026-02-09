const bcrypt = require("bcrypt");

const made_users = [
    { username: "tyler", password: "password1" },
    { username: "nathan", password: "password2" },
    { username: "ali", password: "password3" },
];

// only hash once
const users = new Map();
let init = false;

// hash pass & populate usermap
async function init_users() {
    if (init) return;
    init = true;

    for (const use of made_users) {
        const hash = await bcrypt.hash(use.password, 10);
        users.set(use.username, { username: use.username, password_hash: hash });
    }
}

// find stored hash & compare w/ bcrypt 
async function verify_cred(username, password) {
    await init_users();
    const user = users.get(username);
    if (!user) return false;
    return bcrypt.compare(password, user.password_hash);
}

module.exports = { init_users, verify_cred };