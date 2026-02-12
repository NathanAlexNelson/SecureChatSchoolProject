document.getElementById("head1").textContent = "Websocket Login Page";
document.getElementById("para1").textContent = "Chat Project - CPSC 455 - Michael Franklin";
document.getElementById("para2").textContent = "By: Alyaan Mir - Nathan Nelson - Tyler Huynh";

let usernameInp;
let passwordInp;
let serverIP;

let loggedIn = false;

let TOKEN;

let ipInp;
let validIP = false;

const made_users = [
    { username: "tyler", password: "password1" },
    { username: "nathan", password: "password2" },
    { username: "ali", password: "password3" },
];

//This is the test function before adding websocket call
/*LogButt.onclick = function(){
    usernameInp = document.getElementById("myText").value;
    passwordInp = document.getElementById("myText2").value;
    ipInp = document.getElementById("ipInp").value;
    validateFunc(usernameInp);
    validateIP(ipInp)
    if (loggedIn == true && validIP == true){
        document.getElementById("head2").textContent = `Connected as ${usernameInp}`;
        console.log(usernameInp, "has connected!");
        document.getElementById("myText").value = "";
    }

}*/

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
        })
        .catch(err => {
            console.error("Login failed:", err);
        });
    }
}

// Function to validate alphanumeric input
function validateFunc(inputCheck) {
    let val = inputCheck.trim(); 
    let RegEx = /^[a-z0-9.]+$/i; 
    let Valid = RegEx.test(val);

    const user = made_users.find(u => 
        u.username === usernameInp && 
        u.password === passwordInp
    );
    
    if (Valid && user) {
        loggedIn = true;
    }
    else {
        console.log("Invalid credentials");
        loggedIn = false;
    }
}

//validates numbers and dots for IP
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

OutButt.onclick = function(){
    outInp = document.getElementById("myText3").value;
    sendTo = document.getElementById("sendTo").value
    if (loggedIn == true){
        console.log(usernameInp, "sent to", sendTo + ":", outInp)
        document.getElementById("myText3").value = "";
        
        socket.send(JSON.stringify({ 
        type: "chat", 
        to: sendTo, 
        text: outInp
        }));
    }
    else {
        console.log("Not Logged In!")
    }
}

//displays messages to HTML
socket.onmessage = function(event) {
    const data = JSON.parse(event.data);
    if(data.type === "chat"){
        document.getElementById("head2").textContent = `${data.from}: ${data.text}`;
    }
    console.log("Received from server:", data);
};


//TOKEN = socket.send(JSON.stringify({`{"username":${usernameInp}, "password":${passwordInp}` | curl.exe -k -X POST `https://${ipInp}:8443/login` -H "Content-Type: application/json" --data-binary "@-"}));

/*
let TOKEN;

async function login() {
  const response = await fetch("https://SERVER_IP:8443/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      username: "myUser",
      password: "myPassword"
    })
  });

  const data = await response.json();

  TOKEN = data.token;   // store token in variable
  console.log("Token:", TOKEN);
}

const socket = new WebSocket(`wss://SERVER_IP:8443?token=${TOKEN}`);
*/