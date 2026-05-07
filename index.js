import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const SUPABASE_URL = 'https://lvakoxjxljptsbwdwjly.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_3VSIHvfenIlg1dWugzdMFw_E4Li81YG'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

document.getElementById("head1").textContent = "SecureTech Chat Client";
document.getElementById("para1").textContent = "CPSC 455 - Michael Franklin";
document.getElementById("para2").textContent = "By: Alyaan Mir - Nathan Nelson - Tyler Huynh";

let users = [];
let usernameInp;
let passwordInp;
let validUser = false;

var socket;
let TOKEN;

let ipInp;
let validIP = false;

const LogButt = document.getElementById("LogButt");
const RegButt = document.getElementById("RegButt");
const OutButt = document.getElementById("OutButt");
const FTPButt = document.getElementById("FTPButt");
const LogoutButt = document.getElementById("LogoutButt");
const LoadLogsButt = document.getElementById("LoadLogsButt");

const Login = document.getElementById("Login");
const Chat = document.getElementById("Chat");

function validateFileBeforeUpload(file) {
    const maxSize = 25 * 1024 * 1024;

    const blockedExtensions = [
        ".exe", ".bat", ".cmd", ".sh", ".dll",
        ".msi", ".ps1", ".vbs", ".scr"
    ];

    const allowedTypes = [
        "image/png",
        "image/jpeg",
        "image/gif",
        "application/pdf",
        "text/plain",
        "application/zip",
        "video/mp4"
    ];

    const lowerName = file.name.toLowerCase();

    if (file.size > maxSize) return "File exceeds 25MB limit";

    if (blockedExtensions.some(ext => lowerName.endsWith(ext))) {
        return "Blocked potentially dangerous file type";
    }

// some Electron/browser environments return empty MIME types
if (
    !allowedTypes.includes(file.type) &&
    !lowerName.endsWith(".txt") &&
    !lowerName.endsWith(".png") &&
    !lowerName.endsWith(".jpg") &&
    !lowerName.endsWith(".jpeg") &&
    !lowerName.endsWith(".gif") &&
    !lowerName.endsWith(".pdf") &&
    !lowerName.endsWith(".zip") &&
    !lowerName.endsWith(".mp4")
) {
    return "Unsupported file type";
}

    return null;
}

function addUserToDropdown(user) {
    if (user === usernameInp) return;

    if (!users.includes(user)) {
        users.push(user);
        updateUserDropdown(users);
    }
}

function removeUserFromDropdown(user) {
    users = users.filter(u => u !== user);
    updateUserDropdown(users);
}

function updateUserDropdown(users) {
    const select = document.getElementById("sendTo");
    select.innerHTML = "";

    users.forEach(user => {
        if (user === usernameInp) return;

        const option = document.createElement("option");
        option.value = user;
        option.textContent = user;
        select.appendChild(option);
    });
}

LogButt.onclick = async function () {
    usernameInp = document.getElementById("usernameBox").value.toLowerCase();
    passwordInp = document.getElementById("passwordBox").value;
    ipInp = document.getElementById("ipInp").value;

    validateFunc(usernameInp);
    validateIP(ipInp);

    if (!validUser || !validIP) return;

    try {
        const res = await fetch(`https://${ipInp}:8443/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: usernameInp,
                password: passwordInp
            })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || "Login failed");
        }

        TOKEN = data.token;

        socket = new WebSocket(`wss://${ipInp}:8443?token=${TOKEN}`);

        socket.onopen = function () {
            console.log("WebSocket connected!");
            document.getElementById("head2").textContent = `Connected as ${usernameInp}`;
            Login.style.display = "none";
            Chat.style.display = "block";
        };

        socket.onmessage = function (event) {
            const data = JSON.parse(event.data);

            console.log("Received from server:", data);

            if (data.type === "chat") {
                document.getElementById("head2").textContent =
                    `${data.from}: ${data.text}`;

                if (data.text.includes("Cloud File:")) {
                    const lines = data.text.split("\n");
                    const label = lines[0];
                    const url = lines[1];

                    const fileName = label.replace("Cloud File: ", "");

                    createCloudDownloadButton(fileName, url);
                }
            }

            if (data.type === "system" && data.event === "connected") {
                updateUserDropdown(data.online);
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

RegButt.onclick = async function () {
    usernameInp = document.getElementById("usernameBox").value.toLowerCase();
    passwordInp = document.getElementById("passwordBox").value;
    ipInp = document.getElementById("ipInp").value;

    validateFunc(usernameInp);
    validateIP(ipInp);

    if (!validUser || !validIP) return;

    try {
        const res = await fetch(`https://${ipInp}:8443/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: usernameInp,
                password: passwordInp
            })
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            throw new Error(data.error || "Registration failed");
        }

        alert("Account created successfully!");
        document.getElementById("head2").textContent = `Registered as ${usernameInp}`;

    } catch (err) {
        console.error("Register failed:", err);
        alert(err.message);
        document.getElementById("head2").textContent = "Registration Failed";
    }
};

function validateFunc(inputCheck) {
    let val = inputCheck.trim();
    let RegEx = /^[a-z0-9.]+$/i;
    validUser = RegEx.test(val);

    if (!validUser) {
        alert("Invalid username. Use letters, numbers, or dots only.");
    }
}

function validateIP(inputCheck) {
    let val = inputCheck.trim();
    let RegEx = /^[0-9.]+$/i;
    validIP = RegEx.test(val);

    if (!validIP) {
        alert("Invalid IP address.");
    }
}

FTPButt.onclick = async function () {
    const fileInput = document.getElementById("fileInput");
    const file = fileInput.files[0];

    if (!file) {
        alert("Please select a file first");
        return;
    }

    const validationError = validateFileBeforeUpload(file);

    if (validationError) {
        alert(validationError);
        return;
    }

    try {
        const safeName =
            Date.now() +
            "_" +
            usernameInp +
            "_" +
            file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

        const { error } = await supabase.storage
            .from("securechat-files")
            .upload(safeName, file, {
                cacheControl: "3600",
                upsert: false
            });

        if (error) {
            throw error;
        }

        const { data: publicData } = supabase.storage
            .from("securechat-files")
            .getPublicUrl(safeName);

        const publicURL = publicData.publicUrl;

        console.log("Cloud upload success:", publicURL);
        alert(`Uploaded to cloud storage: ${safeName}`);

        if (validUser && socket && socket.readyState === WebSocket.OPEN) {
            const sendTo = document.getElementById("sendTo").value;

            socket.send(JSON.stringify({
                type: "chat",
                to: sendTo,
                text: `Cloud File: ${safeName}\n${publicURL}`
            }));
        }

    } catch (err) {
        console.error("Upload error:", err);
        alert("Upload failed: " + err.message);
    }
};

OutButt.onclick = function () {
    const outInp = document.getElementById("chatBox").value;
    const sendTo = document.getElementById("sendTo").value;

    if (validUser && socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: "chat",
            to: sendTo,
            text: outInp
        }));

        document.getElementById("chatBox").value = "";

    } else {
        console.log("Not connected to WebSocket!");
    }
};

LogoutButt.onclick = function () {
    if (validUser && socket && socket.readyState === WebSocket.OPEN) {
        document.getElementById("head2").textContent = "Signing Out";
        socket.close(1000, "Normal closure");
        Login.style.display = "block";
        Chat.style.display = "none";
    }
};

function createCloudDownloadButton(fileName, url) {
    const container = document.getElementById("fileButtons");

    const btn = document.createElement("button");
    btn.textContent = `Download ${fileName}`;
    btn.style.margin = "5px";

    btn.onclick = function () {
        window.open(url, "_blank");
    };

    container.appendChild(btn);
}

async function loadLogs() {
    const otherUser = document.getElementById("sendTo").value;

    try {
        const firstuser = usernameInp < otherUser ? usernameInp : otherUser;
        const secuser = usernameInp < otherUser ? otherUser : usernameInp;

        const res = await fetch(`https://${ipInp}:8443/logs/${firstuser}_${secuser}.txt`, {
            method: "GET"
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error);

        document.getElementById("logBox").textContent = data.log;

    } catch (err) {
        console.error(err);
        alert("No logs found or failed to load");
    }
}

if (LoadLogsButt) {
    LoadLogsButt.onclick = loadLogs;
}