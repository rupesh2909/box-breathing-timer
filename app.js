const phases = ["Hold","Inhale", "Hold", "Exhale" ];
let currentPhase = 0;
let interval = document.getElementById("interval").value;
let timer = null;
let wakeLock = null;

let startTime = null;
let roundCount = 0;
let elapsedTimer = null;


const ball = document.getElementById("ball");
const phaseLabel = document.getElementById("phaseLabel");
const beep = document.getElementById("beep");

document.getElementById("startBtn").addEventListener("click", startTimer);
document.getElementById("restartBtn").addEventListener("click", restartCount);
document.getElementById("stopBtn").addEventListener("click", stopTimer);
document.getElementById("interval").addEventListener("change", (e) => {
  interval = parseInt(e.target.value);
});

function restartCount(){
  clearInterval(elapsedTimer);
  elapsedTimer = null;
  startTime = null;
  roundCount = 0;
  updateStats();
}


function startTimer() {
  if (timer) return;
  requestWakeLock();


  startTime = Date.now();
  roundCount = 0

  elapsedTimer = setInterval(() => {
    updateStats();
  }, 1000);



  ball.style.transition = "none";
  moveBallToCorner(currentPhase);

  // Force reflow so that transition reset applies
  ball.offsetHeight;

  // Start first phase immediately with animation
  nextPhase();

  // Schedule subsequent phases
  timer = setInterval(() => {
    nextPhase();
  }, interval * 1000);
}


function pauseTimer() {
  clearInterval(timer);
  timer = null;
  releaseWakeLock();

  clearInterval(elapsedTimer);
  elapsedTimer = null;

}

function stopTimer() {
  clearInterval(timer);
  timer = null;
  currentPhase = 0;
  phaseLabel.textContent = "Ready";
  moveBallToCorner(0);
  releaseWakeLock();
  ball.style.transition = "none";
  clearInterval(elapsedTimer);

}

function nextPhase() {
  currentPhase = (currentPhase + 1) % phases.length;

  if (currentPhase == 1) {
    roundCount++;
  }

  updatePhase();
  updateStats();
}

function updatePhase() {
  const phase = phases[currentPhase];
  phaseLabel.textContent = phase;
  beep.play();
  moveBallToCorner(currentPhase);
}

function moveBallToCorner(phaseIndex) {

  const square = document.querySelector(".square");
  const ballSize = ball.offsetWidth;
  const duration = interval; // seconds


  const squareWidth = square.clientWidth;
  const squareHeight = square.clientHeight;


  const positions = [
    { top: 0, left: 0 },                                         // Top-left
    { top: 0, left: squareWidth - ballSize },                    // Top-right
    { top: squareHeight - ballSize, left: squareWidth - ballSize }, // Bottom-right
    { top: squareHeight - ballSize, left: 0 }                    // Bottom-left
  ];


  const current = positions[phaseIndex];  

	//alert(`${current.top}`);

  //requestAnimationFrame(() => {
    ball.style.transition = `top ${duration}s linear, left ${duration}s linear`;
    ball.style.top = `${current.top}px`;
    ball.style.left = `${current.left}px`;
  //});

}


async function requestWakeLock() {
  try {
    wakeLock = await navigator.wakeLock.request("screen");
  } catch (err) {
    console.error("Wake Lock error:", err);
  }
}

async function releaseWakeLock() {
  if (wakeLock) {
    await wakeLock.release();
    wakeLock = null;
  }
}




function updateStats() {
  if (!startTime) {
    document.getElementById("elapsedTime").textContent = "0:00";
    document.getElementById("roundCount").textContent = roundCount;
    return;
  }

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  document.getElementById("elapsedTime").textContent = formattedTime;
  if(roundCount >0){
    document.getElementById("roundCount").textContent = roundCount-1;
  }
}


