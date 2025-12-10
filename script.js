const soundBar = document.getElementById("soundBar");
const valueDisplay = document.getElementById("value");
const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const alarmSound = document.getElementById("alarmSound");

let audioContext;
let analyser;
let microphone;
let isRunning = false;
let calibrationFactor = 0.6; // Facteur de calibration à ajuster selon tes tests

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
});

// Mise à jour du niveau sonore
function updateSoundLevel() {
    if (!isRunning) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    // Calcul du niveau sonore moyen
    const sum = dataArray.reduce((a, b) => a + b, 0);
    const average = sum / dataArray.length;

    // Conversion en dB (0-60) avec calibration
    const soundLevel = Math.min(60, Math.round(average * calibrationFactor));

    // Mise à jour de l'affichage
    valueDisplay.textContent = `${soundLevel}`;
    soundBar.style.width = `${(soundLevel / 60) * 100}%`;

    // Couleur et alarme selon le niveau
    if (soundLevel < 40) {
        soundBar.style.background = "green";
    } else if (soundLevel < 55) {
        soundBar.style.background = "orange";
    } else {
        soundBar.style.background = "red";
        alarmSound.play(); // Déclenche l'alarme si > 55 dB
    }

    requestAnimationFrame(updateSoundLevel);
}
