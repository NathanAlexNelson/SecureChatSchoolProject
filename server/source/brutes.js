const max_attempts = 2;
const window = 15 * 60 * 1000; // 15 min

const ip_attempts = new Map();
const user_attempts = new Map();

function get_entry(map, key) {
    const rn = Date.now(); 
    let entry = map.get(key);
    // no entry or window expired since last attempts
    if (!entry || rn - entry.window_start > window) { 
        entry = { count: 0, 
                  window_start: rn,
                  locked_until: null};
        map.set(key, entry); 
    }
    return entry;
}

// is entry locked or nah
function locked(entry) {
    if (!entry.locked_until) return false; // no lockout
    // lockout expired
    if (Date.now() > entry.locked_until) {
        entry.count = 0;
        entry.locked_until = null;
        return false;
    }
    return true;
}

function ms_left(entry) {
    if (!entry.locked_until) return 0; // done
    return Math.max(0, entry.locked_until - Date.now()); // no neg #
}

// coordinates both entry types & formats results for caller
function lockout_check(ip, username) {
    const ip_entry = get_entry(ip_attempts, ip);
    const user_entry = get_entry(user_attempts, username);

    if (locked(ip_entry)) {
        return { locked: true,
                 retry_after_ms: ms_left(ip_entry),
                 retry_after_sec: Math.ceil(ms_left(ip_entry) / 1000)}; // rounds up
    }
    if (locked(user_entry)) {
        return { locked: true,
                 retry_after_ms: ms_left(user_entry),
                 retry_after_sec: Math.ceil(ms_left(user_entry) / 1000)};
    }

    return { locked: false };
}

function fail_record(ip, username) {
    const ip_entry = get_entry(ip_attempts, ip);
    const user_entry = get_entry(user_attempts, username);
    ip_entry.count += 1;
    user_entry.count += 1;

    if (ip_entry.count >= max_attempts) {
        ip_entry.locked_until = Date.now() + window;
    }
    if (user_entry.count >= max_attempts) {
        user_entry.locked_until = Date.now() + window;
    }
}

// delete failed attempts on login
function success_record(ip, username) {
    ip_attempts.delete(ip);
    user_attempts.delete(username);
}

// cleanup every 30 min; reduce memory used & prevent server overload
setInterval(() => {
    const rn = Date.now();

    for (const [key, entry] of ip_attempts.entries()) {
        if (rn - entry.window_start > window * 2) {
            ip_attempts.delete(key);
        }
    }
    for (const [key, entry] of user_attempts.entries()) {
        if (rn - entry.window_start > window * 2) {
            user_attempts.delete(key);
        }
    }
}, window * 2);

module.exports = { lockout_check, fail_record, success_record };