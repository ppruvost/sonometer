const soundBar = document.getElementById("soundBar");
const valueDisplay = document.getElementById("value");
const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const alarmSound = document.getElementById("alarmSound");
const emojiDisplay = document.getElementById("emoji");

let audioContext;
let analyser;
let microphone;
let isRunning = false;

// Historique des valeurs sonores (dernières 30s)
let soundHistory = [];
const HISTORY_DURATION = 30;     // secondes
const FPS_APPROX = 60;           // fréquence estimée de requestAnimationFrame
const MAX_HISTORY = HISTORY_DURATION * FPS_APPROX;

// Fonction pour démarrer le sonomètre
startButton.addEventListener("click", async () => {
    if (isRunning) return;

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;

    try {
        microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = audioContext.createMediaStreamSource(microphone);
        source.connect(analyser);
        isRunning = true;
        updateSoundLevel();
    } catch (err) {
        console.error("Erreur microphone :", err);
        alert("Impossible d'accéder au microphone.");
    }
});

// Fonction pour arrêter le sonomètre
stopButton.addEventListener("click", () => {
    if (!isRunning) return;

    microphone.getTracks().forEach(track => track.stop());
    audioContext.close();
    isRunning = false;

    soundHistory = [];
    soundBar.style.width = "0%";
    valueDisplay.textContent = "0";
    emojiDisplay.textContent = "😊";
});

// Mise à jour du niveau sonore
function updateSoundLevel() {
    if (!isRunning) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    // Calcul du niveau sonore instantané
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
    let instantLevel = Math.min(60, Math.round((sum / dataArray.length) / 60));

    // Ajout au buffer historique
    soundHistory.push(instantLevel);

    // On limite l'historique à 30 secondes
    if (soundHistory.length > MAX_HISTORY) {
        soundHistory.shift();
    }

    // Moyenne sur les 30 dernières secondes
    const historyAverage =
        soundHistory.reduce((a, b) => a + b, 0) / soundHistory.length;

    const avgLevel = Math.round(historyAverage);

    // Mise à jour visuelle
    valueDisplay.textContent = avgLevel;
    soundBar.style.width = ${avgLevel * 10}%;

    // Emoji + couleur en fonction du niveau moyen
    if (avgLevel < 5) {
        soundBar.style.background = "green";
        emojiDisplay.textContent = "😊"; 
    } else if (avgLevel < 8) {
        soundBar.style.background = "orange";
        emojiDisplay.textContent = "🤔"; 
    } else {
        soundBar.style.background = "red";
        emojiDisplay.textContent = "🤯"; 
        alarmSound.play();
    }

    requestAnimationFrame(updateSoundLevel);
}
