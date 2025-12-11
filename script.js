const startBtn = document.getElementById("start");
const output = document.getElementById("db");

let audioContext, analyser, dataArray, micStream;

async function startMeter() {
    try {
        // Obligatoire pour iPhone : requête micro avec echoCancellation=false
        micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
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
        console.error(e);
        alert("Impossible d’accéder au microphone.");
    }
}

function measure() {
    analyser.getByteTimeDomainData(dataArray);

    // Calcul RMS
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        let v = (dataArray[i] - 128) / 128;
        sum += v * v;
    }
    let rms = Math.sqrt(sum / dataArray.length);

    // Conversion pseudo-dB (approx.) — valeur relative
    let db = 20 * Math.log10(rms);

    // Mise en plage lisible
    if (!isFinite(db)) db = -100;
    db = Math.max(-90, db); 

    output.textContent = (db + 90).toFixed(1); // ~0 à 90 dB

    requestAnimationFrame(measure);
}

startBtn.addEventListener("click", () => {
    if (!audioContext) startMeter();
});
