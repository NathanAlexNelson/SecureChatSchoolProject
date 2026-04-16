document.getElementById("head1").textContent = "SecureTech Chat Client";
document.getElementById("para1").textContent = "CPSC 455 - Michael Franklin";
document.getElementById("para2").textContent = "By: Alyaan Mir - Nathan Nelson - Tyler Huynh";

let users = [];
let usernameInp;
let passwordInp;
let serverIP;

let validUser = false;

var socket;
let TOKEN;

let ipInp;
let validIP = false;

const LogButt = document.getElementById("LogButt");
const OutButt = document.getElementById("OutButt");
const FTPButt = document.getElementById("FTPButt");
const LogoutButt = document.getElementById("LogoutButt");

const Login = document.getElementById("Login");
const Chat = document.getElementById("Chat");

// Add a user to the list and update dropdown
function addUserToDropdown(user) {
    if (user === usernameInp) return; // Prevent adding self
    if (!users.includes(user)) {
        users.push(user);
        updateUserDropdown(users);
    }
}

// Remove a user from the list and update dropdown
function removeUserFromDropdown(user) {
    users = users.filter(u => u !== user);
    updateUserDropdown(users);
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
}

//This is the button that should call to websocket
LogButt.onclick = async function(){
    usernameInp = document.getElementById("usernameBox").value.toLowerCase();
    passwordInp = document.getElementById("passwordBox").value;
    ipInp = document.getElementById("ipInp").value;
    validateFunc(usernameInp);
    validateIP(ipInp);

    if (!validUser || !validIP) return;

    try {
        const res = await fetch(`https://${ipInp}:8443/login`, {
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

        console.log("Login response:", data);

        if (!res.ok) {
            throw new Error(data.error || "Login failed");
        }

        TOKEN = data.token;

        // Create WebSocket
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

                if (data.text.includes("File: ") && data.text.includes("has been sent")) {
                    const fileName = data.text.split("File: ")[1].split(" has been sent")[0];
                    createDownloadButton(fileName);
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
}

//Register button uses same input as login
RegButt.onclick = async function(){
    usernameInp = document.getElementById("usernameBox").value.toLowerCase();
    passwordInp = document.getElementById("passwordBox").value;
    ipInp = document.getElementById("ipInp").value;
    validateFunc(usernameInp);
    validateIP(ipInp);

    if (!validUser || !validIP) return;

    try {
        const res = await fetch(`https://${ipInp}:8443/register`, {
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

        if (!res.ok || !data.ok) {
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
}

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

// Validates numbers and dots for IP
function validateIP(inputCheck) {
    let val = inputCheck.trim(); 
    let RegEx = /^[0-9.]+$/i; 
    let Valid = RegEx.test(val);
    
    if (Valid) {
        validIP = true;
    }
    else {
        console.log("IP is not valid!");
    }
}

FTPButt.onclick = async function () {
    const fileInput = document.getElementById("fileInput");
    const file = fileInput.files[0];

    if (!file) {
        alert("Please select a file first");
        return;
    }

    try {
        const res = await fetch(`https://${ipInp}:8443/upload`, {
            method: "POST",
            headers: {
                "Authorization": `Sender ${TOKEN}`,
                "x-filename": file.name // forgot to add header
            },
            body: file
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || "Upload failed");
        }

        console.log("Upload success:", data);
        alert(`Uploaded: ${data.file}`);

        // Notify recipient via WebSocket
        if (validUser && socket && socket.readyState === WebSocket.OPEN) {
            const sendTo = document.getElementById("sendTo").value;
            socket.send(JSON.stringify({
                type: "chat",
                to: sendTo,
                text: `File: ${data.file} has been sent!`
            }));
        }

    } catch (err) {
        console.error("Upload error:", err);
        alert(err.message);
    }
};

OutButt.onclick = function () {
    outInp = document.getElementById("chatBox").value;
    sendTo = document.getElementById("sendTo").value;

    if (validUser && socket && socket.readyState === WebSocket.OPEN) {

        socket.send(JSON.stringify({
            type: "chat",
            to: sendTo,
            text: outInp
        }));

        document.getElementById("myText3").value = "";

    } else {
        console.log("Not connected to WebSocket!");
    }
}

LogoutButt.onclick = function () {
    if (validUser && socket && socket.readyState === WebSocket.OPEN) {
        document.getElementById("head2").textContent = 'Signing Out'
        socket.close(1000, 'Normal closure');
        Login.style.display = "block";
        Chat.style.display = "none";
    }
}

// FTP download button
function createDownloadButton(fileName) {
    const container = document.getElementById("fileButtons");

    // Create the button
    const btn = document.createElement("button");
    btn.textContent = `Download ${fileName}`;
    btn.style.margin = "5px";

    // When clicked, download the file
    btn.onclick = async function () {
        try {
            const res = await fetch(`https://${ipInp}:8443/download/${fileName}`, {
                method: "GET",
                headers: {
                    "Authorization": `Sender ${TOKEN}`
                }
            });

            if (!res.ok) throw new Error("Download failed");

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            a.click();

            // Clean up
            window.URL.revokeObjectURL(url);

        } catch (err) {
            console.error(err);
            alert("Download failed: " + err.message);
        }
    };

    container.appendChild(btn);
}

//Shows logs of each user
async function loadLogs() {
    const otherUser = document.getElementById("sendTo").value;

    try {
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