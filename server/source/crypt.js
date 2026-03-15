const pubks = new Map(); // memory only since keys regen

function key_store(user, pubk) {
    if (typeof pubk !== "string" || !pubk.trim()) {
        return false;
    }

    pubks.set(user, pubk.trim());
    return true;
}

function get_key(user) {
    return pubks.get(user) || null; // null if user not connected or no key reg; also makes return explicit
}

function remove_key(user) {
    pubks.delete(user);
}

module.exports = { key_store, get_key, remove_key };