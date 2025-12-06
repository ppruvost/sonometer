// webcam.js — gestion webcam + boucle d'analyse automatique


let video = null;
let stream = null;
let videoReadyForAnalysis = false;
let analysisActive = false;


// --- Démarrage caméra ---
async function startCamera() {
video = document.getElementById("video");


try {
stream = await navigator.mediaDevices.getUserMedia({
video: { facingMode: { ideal: "environment" } },
audio: false
});


video.srcObject = stream;


// Vérifie si la vidéo est prête
video.addEventListener("loadedmetadata", () => {
if (video.videoWidth > 50 && video.videoHeight > 50) {
videoReadyForAnalysis = true;
}
});


video.addEventListener("resize", () => {
if (video.videoWidth > 50 && video.videoHeight > 50) {
videoReadyForAnalysis = true;
}
});


} catch (e) {
console.error("Erreur caméra :", e);
}
}


// --- Boucle d'analyse continue (automatique) ---
function startWebcamAnalysis() {
analysisActive = true;


function loop() {
if (analysisActive && videoReadyForAnalysis) {
try {
autoCalibAngle(); // Détection ellipse + angle
autoCaptureFrame(); // Ajout automatique d'un échantillon
} catch (e) {
console.error("Erreur analyse:", e);
}
}
requestAnimationFrame(loop);
}
loop();
}


// --- Stop analyse ---
function stopWebcamAnalysis() {
analysisActive = false;
}


// --- Gestion boutons ---
window.addEventListener("load", () => {
const btnStart = document.getElementById("btnStartCam");
const btnStop = document.getElementById("btnStopRec");


btnStart.onclick = async () => {
});
