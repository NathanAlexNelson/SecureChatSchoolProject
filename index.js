document.getElementById("head1").textContent = "Websocket Login Page";
document.getElementById("para1").textContent = "Chat Project - CPSC 455 - Michael Franklin";
document.getElementById("para2").textContent = "By: Alyaan Mir - Nathan Nelson - Tyler Huynh";

let username;

LogButt.onclick = function(){
    username = document.getElementById("myText").value;
    document.getElementById("head2").textContent = `Connected as ${username}`;
    console.log(username);
    document.getElementById("myText").value = "";
}