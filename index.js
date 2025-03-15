//Developed by Yuliia Kruta

function sendStringToMicrobit(str) {
  const serialComponent = document.querySelector('custom-serial');
  if (serialComponent) {
    serialComponent.writeToSerial(`${str}\n`);
  }
}

let calcAge = document.getElementById("calcAge"); 
let output = document.getElementById("output");
let outputBday = document.getElementById("outputBday");


calcAge.addEventListener("click", ()=> {calculateAge()});
  
function calculateAge(){
  const dob = new Date(document.getElementById("dob").value);
  const today = new Date();
  const dateDiffer = new Date(today - dob);
  let age = dateDiffer.getUTCFullYear() - 1970;
  let result = "";
  if(age<0 || age > 125){
    output.textContent = "Please input the valid date";
    sendStringToMicrobit("Error");
  }
  else{
    result = age.toString();
    output.textContent = "See your age on the Micro:Bit! (Your age is "+result+")";
    if(dob.getDate()==today.getDate() && dob.getMonth()==today.getMonth()){
      outputBday.textContent = "And Happy Birthday! \u{1F38A}";
      sendStringToMicrobit(result+" music");
    }
    sendStringToMicrobit(result);
  }
}