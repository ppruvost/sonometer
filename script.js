// script.js — analyse automatique de la mire + graphiques


// --- Stockage données ---
let samples = [];
let t0 = null;


// Valeurs affichées
tconst = document.getElementById("sampleCount");
aEst = document.getElementById("aEst");
angleEst = document.getElementById("angleEst");


// --- Charts ---
let chartPos, chartVit, chartReg;


window.addEventListener("load", () => {
chartPos = new Chart(document.getElementById("chartPos"), {
type: "line",
data: { labels: [], datasets: [{label:"Position Y", data:[]}] },
options:{ responsive:true }
});


chartVit = new Chart(document.getElementById("chartVit"), {
type: "line",
data: { labels: [], datasets: [{label:"Vitesse", data:[]}] },
options:{ responsive:true }
});


chartReg = new Chart(document.getElementById("chartReg"), {
type: "line",
data: { labels: [], datasets: [{label:"Régression v = a·t", data:[]}] },
options:{ responsive:true }
});
});


// --- Détection ellipse + angle ---
function autoCalibAngle() {
// ICI : intégrer ton code ellipse/Hough
// Placeholder en attendant :
const angle = Math.random() * 10;
angleEst.textContent = angle.toFixed(1);
}


// --- Capture automatique d'un échantillon ---
function autoCaptureFrame() {
if (!t0) t0 = performance.now();
const t = (performance.now() - t0) / 1000;


// Simulation en attendant la vraie détection
const y = Math.sin(t);


samples.push({ t, y });
tconst.textContent = samples.length;


updateCharts();
estimateAcceleration();
}


// --- Mise à jour des graphiques ---
function updateCharts() {
const t = samples.map(s => s.t);
const y = samples.map(s => s.y);


chartPos.data.labels = t;
chartPos.data.datasets[0].data = y;
chartPos.update();


// vitesse simple
let v = [];
for (let i=1;i<y.length;i++) v.push((y[i]-y[i-1])/(t[i]-t[i-1]));


}
