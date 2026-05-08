import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

document.getElementById("head1").textContent = "SecureTech Chat Client";
document.getElementById("para1").textContent = "CPSC 455 - Michael Franklin";
document.getElementById("para2").textContent = "By: Alyaan Mir - Nathan Nelson - Tyler Huynh";

let pendingMessages = {};
let users = [];
let usernameInp;
let passwordInp;
let serverIP;
let pendingKeyRequests = new Set();

let allUsers = [];
let validUser = false;

var socket;
let TOKEN;

let ipInp = `securechatschoolproject.onrender.com`;

const supabaseUrl = "https://lvakoxjxljptsbwdwjly.supabase.co";
const supabaseKey = "sb_publishable_3VSIHvfenIlg1dWugzdMFw_E4Li81YG";
const supabase = createClient(supabaseUrl, supabaseKey);

// Keys for E2E encryption shared is an array to allow multiple keys be shared
let keyPair;
let sharedKeys = {};

const RegButt = document.getElementById("RegButt");
const LogButt = document.getElementById("LogButt");
const OutButt = document.getElementById("OutButt");
const FTPButt = document.getElementById("FTPButt");
const LogoutButt = document.getElementById("LogoutButt");

const Login = document.getElementById("Login");
const Chat = document.getElementById("Chat");

const peerPublicKeys = {};

// Typing indicator
const chatBox = document.getElementById("chatBox");
const sendToBox = document.getElementById("sendTo");

let typingTimeout;

// File Scanning, Low-Level front end
const dangerousExtensions = [
    ".exe",
    ".bat",
    ".cmd",
    ".scr",
    ".ps1",
    ".js",
    ".vbs",
    ".jar",
    ".msi"
];

function isDangerousFile(filename) {
    const lower = filename.toLowerCase();

    return dangerousExtensions.some(ext =>
        lower.endsWith(ext)
    );
}

function validateFileBeforeUpload(file) {
    const maxSize = 25 * 1024 * 1024;

    if (file.size > maxSize) {
        return "File exceeds 25MB limit";
    }

    if (isDangerousFile(file.name)) {
        return "Blocked dangerous file type";
    }

    if (
        file.name.includes("/") ||
        file.name.includes("\\") ||
        file.name.includes("..")
    ) {
        return "Invalid filename";
    }

    return null;
}

// Add a user to the list and update dropdown
function addUserToDropdown(user) {
    if (user === usernameInp) return; // Prevent adding self
    if (!users.includes(user)) {
        users.push(user);
        updateUserDropdown(users);
        updateOfflineUsers();
    }
}

// Remove a user from the list and update dropdown
function removeUserFromDropdown(user) {
    users = users.filter(u => u !== user);
    updateUserDropdown(users);
    updateOfflineUsers();
}

function updateUserDropdown(users) {
    const select = document.getElementById("sendTo");

    // Clear old list
    select.innerHTML = "";

    users.forEach(user => {
        if (user === usernameInp) return; //Prevents user from messaging themself

        const option = document.createElement("option");
        option.value = user;
        option.textContent = user;
        select.appendChild(option);
    });
    updateOfflineUsers();
}

function updateOfflineUsers() {
    const box = document.getElementById("offlineUsers");

    const offlineUsers = allUsers.filter(user =>
        user !== usernameInp && !users.includes(user)
    );

    box.value = offlineUsers.map(u => `${u} (offline)`).join("\n");
}

document.getElementById("showOfflineBtn").onclick = async function () {
    await fetchAllUsers();
    updateOfflineUsers();
};

async function fetchAllUsers() {
    console.log("test");
    try {
        const res = await fetch(`https://${ipInp}/users`, {
            headers: {
                "Authorization": `Bearer ${TOKEN}`
            }
        });

        const data = await res.json();

        allUsers = data.users || [];
        console.log("All users loaded:", allUsers);

    } catch (err) {
        console.error("Failed to fetch users:", err);
        allUsers = [];
    }
}

chatBox.addEventListener("input", () => {
    const sendTo = sendToBox.value;

    if (!sendTo || !socket || socket.readyState !== WebSocket.OPEN) return;

    socket.send(JSON.stringify({
        type: "typing",
        from: usernameInp,
        to: sendTo
    }));

    // stop typing after 1.5s of inactivity
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.send(JSON.stringify({
            type: "typing",
            from: usernameInp,
            to: sendTo,
            stop: true
        }));
    }, 1500);
});

//This is the button that should call to websocket
LogButt.onclick = async function(){
    usernameInp = document.getElementById("usernameBox").value.toLowerCase();
    passwordInp = document.getElementById("passwordBox").value;
    
    if (!keyPair) {
        keyPair = await generateKeyPair();
    }
    const pubKey = await exportPublicKey();
    
    validateFunc(usernameInp);
    
    if (!validUser) return;

    try {
        const res = await fetch(`https://${ipInp}/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username: usernameInp,
                password: passwordInp,
            })
        });

        const data = await res.json();

        console.log("Login response:", data);

        if (!res.ok) {
            throw new Error(data.error || "Login failed");
        }

        TOKEN = data.token;

        // Create WebSocket
        socket = new WebSocket(`wss://${ipInp}?token=${TOKEN}`);

        socket.onopen = async function () {
            console.log("WebSocket connected!");
            
            socket.send(JSON.stringify({
                type: "pubk_register",
                pubk: pubKey
            }));

            await fetchAllUsers();
            setTimeout(updateOfflineUsers, 200);

            document.getElementById("head2").textContent = `Connected as ${usernameInp}`;
            
            Login.style.display = "none";
            Chat.style.display = "block";
        };

        socket.onmessage = async function (event) {
            const data = JSON.parse(event.data);

            console.log("Received from server:", data);

            if (data.type === "pubk_response") {
                peerPublicKeys[data.username] = await importPublicKey(data.pubk);

                if (keyPair?.privateKey && peerPublicKeys[data.username]) {
                    await getSharedKey(data.username);
                }

                flushQueue(data.username);

                document.getElementById("head2").textContent = "Public Key Acquired!";
            }

            if (data.type === "typing") {
                const indicator = document.getElementById("typingIndicator");

                if (data.stop) {
                    indicator.textContent = " ";
                } else {
                    indicator.textContent = `${data.from} is typing...`;
                }
            }
            
            if (data.type === "chat") {

                const key = await getSharedKey(data.from);

                // 1. Must have encrypted payload
                if (!data.text || !data.iv) {
                    console.warn("Incomplete chat message (queued or corrupted):", data);
                    return;
                }

                // 2. Must be valid Base64 BEFORE decrypt
                if (!isBase64(data.text) || !isBase64(data.iv)) {
                    console.error("Invalid Base64 chat payload:", data);
                    return;
                }

                if (!key) {
                    console.warn("Key not ready yet. Queueing message.");

                    setTimeout(async () => {
                        const retryKey = await getSharedKey(data.from);
                        if (!retryKey) return;

                        const decrypted = await decryptMessage(
                            retryKey,
                            data.text,
                            data.iv
                        );

                        saveLocalLog(data.from, usernameInp, decrypted);
                        loadLogs();

                        if (decrypted.startsWith("Cloud File:")) {
                            handleCloudFileMessage(data.from, decrypted);
                        } else {
                            document.getElementById("head2").textContent =
                                `${data.from}: ${decrypted}`;
                        }
                    }, 300);

                    return;
                }

                const decrypted = await decryptMessage(
                    key,
                    data.text,
                    data.iv
                );

                saveLocalLog(data.from, usernameInp, decrypted);
                loadLogs();

                if (decrypted.startsWith("Cloud File:")) {
                    handleCloudFileMessage(data.from, decrypted);
                } else {
                    document.getElementById("head2").textContent =
                        `${data.from}: ${decrypted}`;
                }
            }

            if (data.type === "system" && data.event === "connected") {
                users = data.online || [];   // FULL SYNC
                updateUserDropdown(users);
                updateOfflineUsers();
            }

            if (data.type === "system" && data.event === "join") {
                addUserToDropdown(data.user);
            }

            if (data.type === "system" && data.event === "leave") {
                removeUserFromDropdown(data.user);
            }
        };

        socket.onerror = function (e) {
            console.log("WebSocket error:", e);
        };

        socket.onclose = function (e) {
            console.log("WebSocket closed:", e.code, e.reason);
        };

    } catch (err) {
        console.error("Login failed:", err);
        alert(err.message);
        document.getElementById("head2").textContent = "Login Failed";
    }
};

async function encryptFile(sharedKey, file) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const fileBuffer = await file.arrayBuffer();

    const ciphertext = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv,
        },
        sharedKey,
        fileBuffer
    );

    return {
        ciphertext: arrayBufferToBase64(ciphertext),
        iv: arrayBufferToBase64(iv),
        filename: file.name,
        mimeType: file.type || "application/octet-stream"
    };
}

function isBase64(str) {
    return typeof str === "string" &&
        /^[A-Za-z0-9+/=]+$/.test(str.trim());
}

//Register button uses same input as login
RegButt.onclick = async function(){
    usernameInp = document.getElementById("usernameBox").value.toLowerCase();
    passwordInp = document.getElementById("passwordBox").value;
    validateFunc(usernameInp);
    
    if (!validUser) return;

    try {
        const res = await fetch(`https://${ipInp}/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username: usernameInp,
                password: passwordInp
            })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || "Registration failed");
        }

        console.log("Register response:", data);

        alert("Account created successfully!");
        document.getElementById("head2").textContent = `Registered as ${usernameInp}`;

    } catch (err) {
        console.error("Register failed:", err);
        alert(err.message);
        document.getElementById("head2").textContent = 'Registration Failed';
    }
};

// Function to validate alphanumeric input does not check username that is done at server launch in backend
function validateFunc(inputCheck) {
    let val = inputCheck.trim(); 
    let RegEx = /^[a-z0-9.]+$/i; 
    let Valid = RegEx.test(val);
    
    if (Valid) {
        validUser = true;
    }
    else {
        console.log("Invalid credentials");
        validUser = false;
    }
}

// Cloud FTP button - uploads encrypted file to Supabase and sends URL as encrypted chat
FTPButt.onclick = async function () {
    const fileInput = document.getElementById("fileInput");
    const file = fileInput.files[0];

    if (!file) {
        alert("Please select a file first");
        return;
    }

    const sendTo = document.getElementById("sendTo").value;

    if (!sendTo) {
        alert("Please select a recipient");
        return;
    }

    const validationError = validateFileBeforeUpload(file);

    if (validationError) {
        alert(validationError);
        return;
    }

    try {
        const key = await getSharedKey(sendTo);

        if (!key) {
            alert("Encryption key not ready yet. Send a normal message first.");
            return;
        }

        const enc = await encryptFile(key, file);

        const encryptedPackage = {
            filename: enc.filename,
            mimeType: enc.mimeType,
            ciphertext: enc.ciphertext,
            iv: enc.iv
        };

        const safeName =
            Date.now() +
            "_" +
            usernameInp +
            "_" +
            file.name.replace(/[^a-zA-Z0-9._-]/g, "_") +
            ".securechat.txt";

        const encryptedBlob = new Blob(
            [JSON.stringify(encryptedPackage)],
            { type: "text/plain" }
        );

        const { error } = await supabase.storage
            .from("securechat-files")
            .upload(safeName, encryptedBlob, {
                cacheControl: "3600",
                upsert: false,
                contentType: "text/plain"
            });

        if (error) {
            throw error;
        }

        const { data: publicData } = supabase.storage
            .from("securechat-files")
            .getPublicUrl(safeName);

        const publicURL = publicData.publicUrl;

        const cloudMessage = `Cloud File: ${file.name}\n${publicURL}`;

        const msgEnc = await encryptMessage(key, cloudMessage);

        socket.send(JSON.stringify({
            type: "chat",
            from: usernameInp,
            to: sendTo,
            text: msgEnc.ciphertext,
            iv: msgEnc.iv
        }));

        saveLocalLog(usernameInp, sendTo, cloudMessage);
        loadLogs();

        alert(`Encrypted cloud file sent: ${file.name}`);

    } catch (err) {
        console.error("Upload error:", err);
        alert("Upload failed: " + err.message);
    }
};

//santize message before sending
function sanitizeMessage(input) {

    if (typeof input !== "string") {
        return "";
    }

    // Normalize Unicode
    let sanitized = input.normalize("NFKC");

    // Remove null bytes + dangerous control chars
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

    // Trim whitespace
    sanitized = sanitized.trim();

    // Limit message size
    const MAX_LENGTH = 4000;

    if (sanitized.length > MAX_LENGTH) {
        sanitized = sanitized.slice(0, MAX_LENGTH);
    }

    // Escape HTML special chars
    sanitized = sanitized
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    return sanitized;
}

//E2E encyrption using ECDH
function generateKeyPair() {
  return crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveKey"]
  );
}

async function decryptFile(sharedKey, ciphertext, iv) {
    const decrypted = await crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: base64ToArrayBuffer(iv),
        },
        sharedKey,
        base64ToArrayBuffer(ciphertext)
    );

    return decrypted; // ArrayBuffer
}

async function exportPublicKey() {
  const raw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  return arrayBufferToBase64(raw);
}

async function importPublicKey(base64Key) {
  const raw = base64ToArrayBuffer(base64Key);

  return crypto.subtle.importKey(
    "raw",
    raw,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    false,
    []
  );
}

async function getSharedKey(peerId) {

    if (!peerId || typeof peerId !== "string") {
        console.error("Invalid peerId:", peerId);
        return null;
    }

    if (sharedKeys[peerId]) {
        return sharedKeys[peerId];
    }

    const peerPublicKey = peerPublicKeys[peerId];

    if (!peerPublicKey) {

        if (!socket || socket.readyState !== WebSocket.OPEN) {
            console.error("Socket not connected");
            return null;
        }

        if (!pendingKeyRequests.has(peerId)) {

            pendingKeyRequests.add(peerId);

            console.log("Requesting public key for:", peerId);

            socket.send(JSON.stringify({
                type: "pubk_request",
                username: peerId
            }));
        }

        return null;
    }

    const key = await crypto.subtle.deriveKey(
        {
            name: "ECDH",
            public: peerPublicKey,
        },
        keyPair.privateKey,
        {
            name: "AES-GCM",
            length: 256,
        },
        false,
        ["encrypt", "decrypt"]
    );

    sharedKeys[peerId] = key;

    return key;
}

async function decryptMessage(sharedKey, ciphertext, iv) {
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToArrayBuffer(iv),
    },
    sharedKey,
    base64ToArrayBuffer(ciphertext)
  );

  return new TextDecoder().decode(decrypted);
}

async function encryptMessage(sharedKey, message) {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    sharedKey,
    encoder.encode(message)
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv)
  };
}

function arrayBufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

OutButt.onclick = async function () {
    const sendTo = document.getElementById("sendTo").value;
    const rawMsg = document.getElementById("chatBox").value;
    const msg = sanitizeMessage(rawMsg);

    if (!msg) {
        alert("Invalid or empty message");
        return;
    }
	
    if (!sendTo) {
    	alert("Please select a user");
    	return;
	}
    document.getElementById("chatBox").value = "";

    let key = await getSharedKey(sendTo);

    if (!key) {
        console.warn("Key not ready, queueing message");

        if (!pendingMessages[sendTo]) {
            pendingMessages[sendTo] = [];
        }

        pendingMessages[sendTo].push(msg);
        return;
    }

    const enc = await encryptMessage(key, msg);
    
    socket.send(JSON.stringify({
        type: "chat",
        from: usernameInp,
        to: sendTo,
        text: enc.ciphertext,
        iv: enc.iv
    }));
    
    saveLocalLog(usernameInp, sendTo, msg);
    loadLogs();

    //clears typing status
    socket.send(JSON.stringify({
        type: "typing",
        from: usernameInp,
        to: sendTo,
        stop: true
    }));

    document.getElementById("typingIndicator").textContent = "";
};

async function flushQueue(user) {
    if (!pendingMessages[user]) return;

    const key = await getSharedKey(user);
    if (!key) return;

    for (const msg of pendingMessages[user]) {

        if (!msg || typeof msg !== "string") {
            console.warn("Skipping invalid queued message:", msg);
            continue;
        }

        const enc = await encryptMessage(key, msg);

        if (!enc || !enc.ciphertext || !enc.iv) {
            console.error("Encryption failed for queued message:", msg);
            continue;
        }

        socket.send(JSON.stringify({
            type: "chat",
            from: usernameInp,
            to: user,
            text: enc.ciphertext,
            iv: enc.iv
        }));

        saveLocalLog(usernameInp, user, msg);
        loadLogs();
    }

    delete pendingMessages[user];
}

LogoutButt.onclick = function () {
    if (validUser && socket && socket.readyState === WebSocket.OPEN) {
        document.getElementById("head2").textContent = 'Signing Out';
        socket.close(1000, 'Normal closure');
        Login.style.display = "block";
        Chat.style.display = "none";
    }
};

function handleCloudFileMessage(from, decrypted) {
    const lines = decrypted.split("\n");
    const label = lines[0];
    const url = lines[1];

    const fileName = label.replace("Cloud File: ", "");

    document.getElementById("head2").textContent =
        `${from} sent a cloud file: ${fileName}`;

    createCloudDownloadButton(fileName, url, from);
}

function createCloudDownloadButton(fileName, url, fromUser) {
    const container = document.getElementById("fileButtons");

    const btn = document.createElement("button");
    btn.textContent = `Download ${fileName}`;
    btn.style.margin = "5px";

    btn.onclick = async function () {
        try {
            const key = await getSharedKey(fromUser);

            if (!key) {
                alert("Encryption key not ready");
                return;
            }

            const res = await fetch(url);

            if (!res.ok) {
                throw new Error("Failed to download cloud file");
            }

            const encryptedPackage = await res.json();

            const decryptedBuffer = await decryptFile(
                key,
                encryptedPackage.ciphertext,
                encryptedPackage.iv
            );

            const blob = new Blob(
                [decryptedBuffer],
                {
                    type:
                        encryptedPackage.mimeType ||
                        "application/octet-stream"
                }
            );

            const downloadUrl = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = encryptedPackage.filename || fileName;
            a.click();

            URL.revokeObjectURL(downloadUrl);

        } catch (err) {
            console.error(err);
            alert("Cloud download failed: " + err.message);
        }
    };

    container.appendChild(btn);
}

//Shows logs of each user
function getConversationKey(user1, user2) {
    return [user1, user2].sort().join("_");
}

function saveLocalLog(sender, receiver, text) {

    const convoKey = getConversationKey(sender, receiver);

    const key = `logs_${convoKey}`;

    const existing = JSON.parse(localStorage.getItem(key) || "[]");

    existing.push({
        sender,
        receiver,
        text,
        timestamp: Date.now()
    });

    localStorage.setItem(key, JSON.stringify(existing));
}

async function loadLogs() {
    const otherUser = document.getElementById("sendTo").value;
    if (!usernameInp) return;
    if (!otherUser) return;

    console.log("usernameInp:", usernameInp);
    console.log("otherUser:", otherUser);

    if (!otherUser) {
        console.error("No recipient selected");
        return;
    }

    const convoKey = getConversationKey(usernameInp, otherUser);

    const key = `logs_${convoKey}`;

    const logs = JSON.parse(localStorage.getItem(key) || "[]");

    logs.sort((a, b) => a.timestamp - b.timestamp);

    let output = "";

    for (const msg of logs) {
        output += `${msg.sender}: ${msg.text}\n`;
    }

    document.getElementById("logBox").value = output;
}

window.loadLogs = loadLogs;