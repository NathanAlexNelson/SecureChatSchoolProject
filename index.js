document.getElementById("head1").textContent = "Websocket Login Page";
document.getElementById("para1").textContent = "Chat Project - CPSC 455 - Michael Franklin";
document.getElementById("para2").textContent = "By: Alyaan Mir - Nathan Nelson - Tyler Huynh";

let usernameInp;
let passwordInp;
let serverIP;

let loggedIn = false;

var socket;
let TOKEN;

let ipInp;
let validIP = false;

//This is the button that should call to websocket
LogButt.onclick = function(){
    usernameInp = document.getElementById("myText").value.toLowerCase();
    passwordInp = document.getElementById("myText2").value.toLowerCase();
    ipInp = document.getElementById("ipInp").value;
    validateFunc(usernameInp);
    validateIP(ipInp)

    if (loggedIn == true && validIP == true){
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

            // Token created here
            TOKEN = data.token;
            // Create WebSocket HERE
            socket = new WebSocket(`wss://${ipInp}:8443?token=${TOKEN}`);


            //All of this has to be in the same function as token and socket creation
            socket.onopen = function () {
                console.log("WebSocket connected!");
                document.getElementById("head2").textContent = `Connected as ${usernameInp}`;
            };

            // Displays messages to HTML
            socket.onmessage = function(event) {
                const data = JSON.parse(event.data);

                console.log("Received from server:", data);

                if (data.type === "chat") {
                    document.getElementById("head2").textContent =
                        `${data.from}: ${data.text}`;
                }
            };

            socket.onerror = function(e){
                console.log("WebSocket error:", e);
            };

            socket.onclose = function(e){
                console.log("WebSocket closed:", e.code, e.reason);
            };
        })
        .catch(err => {
            console.error("Login failed:", err);
        });
    }
}

// Function to validate alphanumeric input does not check username that is done at server launch in backend
function validateFunc(inputCheck) {
    let val = inputCheck.trim(); 
    let RegEx = /^[a-z0-9.]+$/i; 
    let Valid = RegEx.test(val);
    
    if (Valid) {
        loggedIn = true;
    }
    else {
        console.log("Invalid credentials");
        loggedIn = false;
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

OutButt.onclick = function () {
    outInp = document.getElementById("myText3").value;
    sendTo = document.getElementById("sendTo").value;

    if (loggedIn && socket && socket.readyState === WebSocket.OPEN) {

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