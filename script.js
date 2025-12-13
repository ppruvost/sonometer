let audioContext;
let analyser;
let dataArray;
let micStream;
let running = false;
let dbHistory = [];
let dbValuesForAverage = []; // Tableau pour stocker les valeurs de dB sur 5 secondes
let maxHistoryLength = 600; // 10 minutes * 1 valeur/seconde (600 valeurs)
let soundChart;
let lastUpdateTime = 0;
let averageUpdateInterval = 5000; // Intervalle de 5 secondes pour la moyenne

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
                    data: Array(maxHistoryLength).fill(0),
                    borderColor: "black", // Trait noir
                    borderWidth: 1, // Trait plus fin
                    pointRadius: 0, // Désactive les points
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
                    min: 30,
                    max: 85,
                    grid: {
                        color: "#f0f0f0" // Couleur de la grille plus claire
                    }
                },
                x: {
                    display: false // Masquer les labels de l'axe X pour le défilement
                }
            },
            animation: {
                duration: 0 // Désactive les animations pour un rendu fluide
            },
            plugins: {
                legend: {
                    display: false // Masquer la légende
                }
            }
        },
    });
}

// Mise à jour du graphique
function updateChart(db) {
    dbHistory.push(db);
    if (dbHistory.length > maxHistoryLength) {
        dbHistory.shift();
    }
    soundChart.data.datasets[0].data = dbHistory;
    soundChart.update();
}

// Calcul de la moyenne sur 5 secondes
function calculateAverage() {
    if (dbValuesForAverage.length === 0) return 0;
    const sum = dbValuesForAverage.reduce((a, b) => a + b, 0);
    return Math.round(sum / dbValuesForAverage.length);
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
    dbHistory = [];
    dbValuesForAverage = [];

    try {
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

        initChart();
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
    if (audioContext) {
        audioContext.close();
    }

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

    let displayDb = Math.max(0, db + 90);

    // Stocker les valeurs pour la moyenne
    dbValuesForAverage.push(displayDb);

    // Mise à jour de la moyenne toutes les 5 secondes
    const currentTime = Date.now();
    if (currentTime - lastUpdateTime >= averageUpdateInterval) {
        const averageDb = calculateAverage();
        valueDisp.textContent = averageDb;
        dbValuesForAverage = []; // Réinitialiser le tableau pour les prochaines 5 secondes
        lastUpdateTime = currentTime;
    }

    // Mise à jour barre
    let percent = Math.min(100, (displayDb / 90) * 100);
    soundBar.style.width = percent + "%";

    // Emoji selon le niveau
    if (displayDb < 50) emoji.textContent = "😊";
    else if (displayDb < 65) emoji.textContent = "😐";
    else if (displayDb < 80) emoji.textContent = "😣";
    else emoji.innerHTML = "😵 Port obligatoire 🎧"; // Emoji combiné pour un niveau sonore élevé avec protection auditive

    // Mise à jour du graphique
    updateChart(displayDb);

    requestAnimationFrame(measure);
}
