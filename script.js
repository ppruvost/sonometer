let audioContext;
let analyser;
let dataArray;
let micStream;
let running = false;

const startBtn = document.getElementById("startButton");
const stopBtn = document.getElementById("stopButton");
const soundBar = document.getElementById("soundBar");
const valueDisp = document.getElementById("value");
const emoji = document.getElementById("emoji");
const alarmSound = document.getElementById("alarmSound");

// iPhone : doit être unmuted *après* interaction humaine
startBtn.addEventListener("click", () => {
    alarmSound.muted = false;
    startMeter();
});

stopBtn.addEventListener("click", stopMeter);

async function startMeter() {
    if (running) return;
    running = true;

    try {
        // iPhone nécessite ces paramètres exacts
        micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        });

        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(micStream);

        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;

        dataArray = new Uint8Array(analyser.fftSize);

        source.connect(analyser);

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
        micStream.getTracks().forEach(t => t.stop());
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
    let displayDb = Math.max(0, (db + 90));
    valueDisp.textContent = displayDb.toFixed(1);

    // Mise à jour barre
    let percent = Math.min(100, (displayDb / 90) * 100);
    soundBar.style.width = percent + "%";

    // Emoji selon le niveau
    if (displayDb < 40) emoji.textContent = "😊";
    else if (displayDb < 60) emoji.textContent = "😐";
    else emoji.textContent = "😣";

    requestAnimationFrame(measure);
}
