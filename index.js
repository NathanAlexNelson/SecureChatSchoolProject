document.getElementById("head1").textContent = "Websocket Login Page";
document.getElementById("para1").textContent = "Chat Project - CPSC 455 - Michael Franklin";
document.getElementById("para2").textContent = "By: Alyaan Mir - Nathan Nelson - Tyler Huynh";

let usernameInp;
let loggedIn = false;

LogButt.onclick = function(){
    usernameInp = document.getElementById("myText").value;
    validateFunc(usernameInp);
    
}

// Function to validate alphanumeric input
function validateFunc(inputCheck) {
    let val = inputCheck.trim(); 
    let RegEx = /^[a-z0-9]+$/i; 
    let Valid = RegEx.test(val);
    
    if (Valid) {
        document.getElementById("head2").textContent = `Connected as ${inputCheck}`;
        console.log(inputCheck, "has connected!");
        document.getElementById("myText").value = "";
        loggedIn = true;
    }
    else {
        console.log("Failed to connect");
        loggedIn = false;
    }
}

OutButt.onclick = function(){
    outInp = document.getElementById("myText3").value;
    if (loggedIn == true){
        console.log(usernameInp + ": ", outInp)
        document.getElementById("myText3").value = "";
    }
    else {
        console.log("Not Logged In!")
    }
}