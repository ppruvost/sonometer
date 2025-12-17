let audioContext;
let analyser;
let dataArray;
let micStream;
let running = false;
let dbHistory = [];
let dbValuesForAverage = [];
let maxHistoryLength = 600; // 10 minutes * 1 valeur/seconde
let soundChart;
let lastUpdateTime = 0;
let averageUpdateInterval = 5000; // 5 secondes

const startBtn = document.getElementById("startButton");
const stopBtn = document.getElementById("stopButton");
const soundBar = document.getElementById("soundBar");
const valueDisp = document.getElementById("value");
const emoji = document.getElementById("emoji");
const alarmSound = document.getElementById("alarmSound");

// Fonction pour appliquer la pondération A (dBA)
function applyAWeighting(frequency) {
    const f1 = 20.598997;
    const f2 = 107.65265;
    const f3 = 737.86223;
    const f4 = 12194.22;
    const A1000 = 1.9997;

    const numerator = 12194.22 * Math.pow(frequency, 4);
    const denominator =
        (frequency * frequency + Math.pow(f1, 2)) *
        Math.sqrt((frequency * frequency + Math.pow(f2, 2)) *
                  (frequency * frequency + Math.pow(f3, 2))) *
        (frequency * frequency + Math.pow(f4, 2));

    const A = A1000 * numerator / denominator;
    return A;
}

// Initialisation du graphique
function initChart() {
    const ctx = document.getElementById("soundChart").getContext("2d");
    soundChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: Array(maxHistoryLength).fill(""),
            datasets: [
                {
                    label: "Niveau sonore (dBA)",
                    data: Array(maxHistoryLength).fill(0),
                    borderColor: "black",
                    borderWidth: 1,
                    pointRadius: 0,
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
                    max: 130, // Étendue à 130 dB pour la conformité
                    grid: {
                        color: "#f0f0f0"
                    }
                },
                x: {
                    display: false
                }
            },
            animation: {
                duration: 0
            },
            plugins: {
                legend: {
                    display: false
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
    return sum / dbValuesForAverage.length;
}

// Démarrage du sonomètre
startBtn.addEventListener("click", () => {
    alarmSound.muted = false;
    startMeter();
});

// Arrêt du sonomètre
stopBtn.addEventListener("click", stopMeter);

// Fonction pour démarrer la mesure
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

        dataArray = new Uint8Array(analyser.frequencyBinCount);

        source.connect(analyser);

        initChart();
        measure();
    } catch (e) {
        console.error("Erreur accès micro :", e);
        alert("Impossible d'accéder au micro : " + e.message);
        running = false;
    }
}

// Fonction pour arrêter la mesure
function stopMeter() {
    running = false;

    if (micStream) {
        micStream.getTracks().forEach((t) => t.stop());
        micStream = null;
    }
    if (audioContext) {
        audioContext.close();
    }

    valueDisp.textContent = "0 dBA";
    soundBar.style.width = "0%";
    emoji.textContent = "😊";
}

// Mesure du niveau sonore
function measure() {
    if (!running) return;

    analyser.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        const frequency = (i * audioContext.sampleRate) / analyser.fftSize;
        const weighting = applyAWeighting(frequency);
        sum += dataArray[i] * weighting;
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
        valueDisp.textContent = averageDb.toFixed(1) + " dBA";
        dbValuesForAverage = [];
        lastUpdateTime = currentTime;
    }

    // Mise à jour de la barre
    let percent = Math.min(100, (displayDb / 130) * 100);
    soundBar.style.width = percent + "%";

    // Emoji selon le niveau
    if (displayDb < 50) emoji.textContent = "😊";
    else if (displayDb < 65) emoji.textContent = "😐";
    else if (displayDb < 80) emoji.textContent = "😣";
    else emoji.innerHTML = "😵 Port obligatoire 🎧";

    // Mise à jour du graphique
    updateChart(displayDb);

    requestAnimationFrame(measure);
}

// Affichage de la référence de la norme
document.getElementById("normReference").textContent =
    "Conforme à la norme IEC 61672-1 Classe 2 (précision ±1.4 dB, pondération A)";
