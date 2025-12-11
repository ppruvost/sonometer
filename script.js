const soundBar = document.getElementById("soundBar");
const valueDisplay = document.getElementById("value");
const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const alarmSound = document.getElementById("alarmSound");

let audioContext;
let analyser;
let microphone;
let isRunning = false;

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
    soundBar.style.width = "0%";
    valueDisplay.textContent = "0";
});

// Mise à jour du niveau sonore
function updateSoundLevel() {
    if (!isRunning) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    // Calcul du niveau sonore moyen
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
    }
    const average = sum / dataArray.length;
    const soundLevel = Math.min(10, Math.round(average / 10));

    // Mise à jour de la barre et de l'affichage
    valueDisplay.textContent = soundLevel;
    soundBar.style.width = `${soundLevel * 10}%`;

    // Couleur selon le niveau
    if (soundLevel < 5) {
        soundBar.style.background = "green";
    } else if (soundLevel < 8) {
        soundBar.style.background = "orange";
    } else {
        soundBar.style.background = "red";
        alarmSound.play(); // Alerte sonore
    }

    requestAnimationFrame(updateSoundLevel);
}
