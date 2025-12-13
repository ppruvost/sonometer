let audioContext;
let analyser;
let dataArray;
let micStream;
let running = false;
let dbHistory = []; // Tableau pour stocker les valeurs de dB
let maxHistoryLength = 100; // Nombre maximal de points à afficher
let soundChart; // Variable pour le graphique

const startBtn = document.getElementById("startButton");
const stopBtn = document.getElementById("stopButton");
const soundBar = document.getElementById("soundBar");
const valueDisp = document.getElementById("value");
const emoji = document.getElementById("emoji");
const alarmSound = document.getElementById("alarmSound");

// Initialisation du graphique
function initChart() {
    const ctx = document.getElementById("soundChart").getContext("2d");
    soundChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: Array(maxHistoryLength).fill(""),
            datasets: [
                {
                    label: "Niveau sonore (dB)",
                    data: dbHistory,
                    borderColor: "rgb(75, 192, 192)",
                    tension: 0.1,
                    fill: false,
                },
            ],
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: false,
                    min: 0,
                    max: 90,
                },
            },
        },
    });
}

// Mise à jour du graphique
function updateChart(db) {
    dbHistory.push(db);
    if (dbHistory.length > maxHistoryLength) {
        dbHistory.shift(); // Supprime le premier élément si le tableau est trop long
    }
    soundChart.data.datasets[0].data = dbHistory;
    soundChart.update();
}

// iPhone : doit être unmuted *après* interaction humaine
startBtn.addEventListener("click", () => {
    alarmSound.muted = false;
    startMeter();
});

stopBtn.addEventListener("click", stopMeter);

async function startMeter() {
    if (running) return;
    running = true;
    dbHistory = []; // Réinitialise l'historique

    try {
        // iPhone nécessite ces paramètres exacts
        micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
            },
        });

        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(micStream);

        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;

        dataArray = new Uint8Array(analyser.fftSize);

        source.connect(analyser);

        initChart(); // Initialise le graphique
        measure();
    } catch (e) {
        console.error("Erreur accès micro :", e);
        alert("Impossible d'accéder au micro : " + e.message);
        running = false;
    }
}

function stopMeter() {
    running = false;

    if (micStream) {
        micStream.getTracks().forEach((t) => t.stop());
        micStream = null;
    }
    if (audioContext) audioContext.close();

    valueDisp.textContent = "0";
    soundBar.style.width = "0%";
    emoji.textContent = "😊";
}

function measure() {
    if (!running) return;

    analyser.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        let v = (dataArray[i] - 128) / 128;
        sum += v * v;
    }
    let rms = Math.sqrt(sum / dataArray.length);
    let db = 20 * Math.log10(rms);
    if (!isFinite(db)) db = -100;

    // Converti en 0–90 dB approx.
    let displayDb = Math.max(0, db + 90);
    displayDb = Math.round(displayDb); // Arrondi sans virgule

    valueDisp.textContent = displayDb;

    // Mise à jour barre
    let percent = Math.min(100, (displayDb / 90) * 100);
    soundBar.style.width = percent + "%";

    // Emoji selon le niveau
    if (displayDb < 50) emoji.textContent = "😊";
    else if (displayDb < 65) emoji.textContent = "😐";
    else emoji.textContent = "😣";

    // Mise à jour du graphique
    updateChart(displayDb);

    requestAnimationFrame(measure);
}
