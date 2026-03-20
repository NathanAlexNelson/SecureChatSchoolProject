document.getElementById("head1").textContent = "Websocket Login Page";
document.getElementById("para1").textContent = "Chat Project - CPSC 455 - Michael Franklin";
document.getElementById("para2").textContent = "By: Alyaan Mir - Nathan Nelson - Tyler Huynh";

let usernameInp;
let passwordInp;
let outInp;
let sendTo;

let loggedIn = false;

let socket;
let TOKEN;

let ipInp;
let validIP = false;

let LogButt = document.getElementById("LogButt");
let OutButt = document.getElementById("OutButt");
let FTPbutt = document.getElementById("FTPbutt");
let fileInput = document.getElementById("fileInput");

// login button
LogButt.onclick = function () {
    usernameInp = document.getElementById("myText").value.toLowerCase();
    passwordInp = document.getElementById("myText2").value;
    ipInp = document.getElementById("ipInp").value;

    validateFunc(usernameInp);
    validateIP(ipInp);

    if (loggedIn === true && validIP === true) {
        fetch(`https://${ipInp}:8443/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username: usernameInp,
                password: passwordInp
            })
        })
        .then(res => res.json())
        .then(data => {
            console.log("Login response:", data);

            if (!data.token) {
                document.getElementById("head2").textContent = "Login failed";
                return;
            }

            TOKEN = data.token;

            socket = new WebSocket(`wss://${ipInp}:8443?token=${TOKEN}`);

            socket.onopen = function () {
                console.log("WebSocket connected!");
                document.getElementById("head2").textContent = `Connected as ${usernameInp}`;
            };

            socket.onmessage = function (event) {
                const msg = JSON.parse(event.data);
                const display = document.getElementById("head2");

                if (msg.type === "chat") {
                    if (msg.text && msg.text.includes("/download/")) {
                        let url = msg.text.split(" ").pop();

                        display.innerHTML = `
                            📎 <b>${msg.from}</b> sent a file:
                            <br>
                            <a href="${url}" target="_blank">Download</a>
                        `;
                    } else {
                        display.textContent = `${msg.from}: ${msg.text}`;
                    }
                }
            };

            socket.onerror = function (e) {
                console.log("WebSocket error:", e);
                document.getElementById("head2").textContent = "WebSocket error";
            };

            socket.onclose = function (e) {
                console.log("WebSocket closed:", e.code, e.reason);
            };
        })
        .catch(err => {
            console.error("Login failed:", err);
            document.getElementById("head2").textContent = "Login failed";
        });
    }
};

// validate username
function validateFunc(inputCheck) {
    let val = inputCheck.trim();
    let RegEx = /^[a-z0-9.]+$/i;
    let Valid = RegEx.test(val);

    if (Valid) {
        loggedIn = true;
    } else {
        console.log("Invalid credentials");
        loggedIn = false;
    }
}

// validate IP
function validateIP(inputCheck) {
    let val = inputCheck.trim();
    let RegEx = /^[0-9.]+$/i;
    let Valid = RegEx.test(val);

    if (Valid) {
        validIP = true;
    } else {
        console.log("IP is not valid!");
        validIP = false;
    }
}

// send normal message
OutButt.onclick = function () {
    outInp = document.getElementById("myText3").value;
    sendTo = document.getElementById("sendTo").value;

    if (loggedIn && socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: "chat",
            to: sendTo,
            text: outInp
        }));

        document.getElementById("head2").textContent = `You → ${sendTo}: ${outInp}`;
        document.getElementById("myText3").value = "";
    } else {
        console.log("Not connected to WebSocket!");
        document.getElementById("head2").textContent = "Not connected to WebSocket";
    }
};

// send file
FTPbutt.onclick = async function () {
    const file = fileInput.files[0];
    sendTo = document.getElementById("sendTo").value;

    if (!file) {
        console.log("No file selected");
        document.getElementById("head2").textContent = "Select a file first";
        return;
    }

    if (!sendTo) {
        console.log("No recipient selected");
        document.getElementById("head2").textContent = "Enter a receiver first";
        return;
    }

    if (!(loggedIn && socket && socket.readyState === WebSocket.OPEN)) {
        console.log("Not connected to WebSocket!");
        document.getElementById("head2").textContent = "Not connected to WebSocket";
        return;
    }

    try {
        const buffer = await file.arrayBuffer();

        const res = await fetch(`https://${ipInp}:8443/upload`, {
            method: "POST",
            body: buffer
        });

        const data = await res.json();
        console.log("Upload response:", data);

        const fileUrl = `https://${ipInp}:8443/download/${data.file}`;

        socket.send(JSON.stringify({
            type: "chat",
            to: sendTo,
            text: `📎 File from ${usernameInp}: ${fileUrl}`
        }));

        document.getElementById("head2").textContent =
            `You sent file: ${file.name} to ${sendTo}`;

        fileInput.value = "";
    } catch (err) {
        console.error("File upload failed:", err);
        document.getElementById("head2").textContent = "File upload failed";
    }
};