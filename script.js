const soundBar = document.getElementById("soundBar");
const valueDisplay = document.getElementById("value");
const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const alarmSound = document.getElementById("alarmSound");

let audioContext;
let analyser;
let microphone;
let isRunning = false;
let calibrationFactor = 0.6; // Facteur de calibration à ajuster

// Tableau pour stocker les niveaux sonores des 30 dernières secondes
const soundLevels = [];
const AVERAGE_WINDOW_SECONDS = 30;
const MAX_HISTORY_MS = AVERAGE_WINDOW_SECONDS * 1000; // 30 secondes en millisecondes

// Fonction pour démarrer le sonomètre
startButton.addEventListener("click", async () => {
    if (isRunning) return;

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        microphone = stream;
        const source = audioContext.createMediaStreamSource(stream);
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
    soundBar.style.width = "0%";
    valueDisplay.textContent = "0 dB";
    soundLevels.length = 0; // Réinitialiser l'historique
});

// Mise à jour du niveau sonore
function updateSoundLevel() {
    if (!isRunning) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    // Calcul du niveau sonore instantané
    const sum = dataArray.reduce((a, b) => a + b, 0);
    const averageInstant = sum / dataArray.length;
    const soundLevelInstant = Math.min(60, Math.round(averageInstant * calibrationFactor));

    // Ajouter le niveau instantané à l'historique avec timestamp
    const now = Date.now();
    soundLevels.push({ level: soundLevelInstant, timestamp: now });

    // Supprimer les valeurs trop anciennes (> 30 secondes)
    const oldestAllowed = now - MAX_HISTORY_MS;
    const filteredLevels = soundLevels.filter(entry => entry.timestamp >= oldestAllowed);

    // Calculer la moyenne sur les 30 dernières secondes
    let average30s = 0;
    if (filteredLevels.length > 0) {
        const sum30s = filteredLevels.reduce((acc, entry) => acc + entry.level, 0);
        average30s = Math.round(sum30s / filteredLevels.length);
    }

    // Mise à jour de l'affichage avec la moyenne
    valueDisplay.textContent = `${average30s} dB (moyenne 30s)`;
    soundBar.style.width = `${(average30s / 60) * 100}%`;

    // Couleur et alarme selon le niveau moyen
    if (average30s < 40) {
        soundBar.style.background = "green";
    } else if (average30s < 55) {
        soundBar.style.background = "orange";
    } else {
        soundBar.style.background = "red";
        alarmSound.play(); // Déclenche l'alarme si > 55 dB
    }

    requestAnimationFrame(updateSoundLevel);
}
