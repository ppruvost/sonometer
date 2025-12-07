/* ========================================
   CONFIGURATION
   ======================================== */
const CONFIG = {
  FRAME_STEP_MS: 33,
  BG_FRAMES: 18,
  MIN_PIXELS_BALL: 40,
  MIN_PIXELS_MIRE: 120,
  BALL_REAL_DIAM_M: 0.20,
  HSV: { H_MIN: 40, H_MAX: 75, S_MIN: 0.28, V_MIN: 0.45 },
  MOTION_DIFF_THRESHOLD: 55,
  STRIDE: 2,
};

/* ========================================
   VARIABLES GLOBALES
   ======================================== */
let videoEl, canvasOverlay, ctx;
let startRecBtn, stopRecBtn, loadFileBtn, fileInput, processBtn, slowMoBtn, exportCSVBtn;
let recStateP, blobSizeP, nSamplesSpan, aEstimatedSpan, aTheorySpan, regEquationP, pxToMeterDisplay, rampAngleDisplay;
let mediaRecorder = null;
let recordedChunks = [];
let recordedBlob = null;
let loadedVideoURL = null;
let bgAccumulator = null;
let bgCount = 0;
let useBackground = false;
let samplesRaw = [];
let samplesFilt = [];
let pxToMeter = null;
let kalman = null;
let slowMotionFactor = 1;
let posChart = null, velChart = null;

/* ========================================
   INITIALISATION
   ======================================== */
window.addEventListener("load", () => {
  videoEl = document.getElementById("preview");
  canvasOverlay = document.getElementById("previewCanvas");
  ctx = canvasOverlay.getContext("2d");

  startRecBtn = document.getElementById("startRecBtn");
  stopRecBtn = document.getElementById("stopRecBtn");
  loadFileBtn = document.getElementById("loadFileBtn");
  fileInput = document.getElementById("fileInput");
  processBtn = document.getElementById("processBtn");
  slowMoBtn = document.getElementById("slowMoBtn");
  exportCSVBtn = document.getElementById("exportCSVBtn");

  recStateP = document.getElementById("recState");
  blobSizeP = document.getElementById("blobSize");
  nSamplesSpan = document.getElementById("nSamples");
  aEstimatedSpan = document.getElementById("aEstimated");
  aTheorySpan = document.getElementById("aTheory");
  regEquationP = document.getElementById("regEquation");
  pxToMeterDisplay = document.getElementById("pxToMeterDisplay");
  rampAngleDisplay = document.getElementById("rampAngleDisplay");

  startRecBtn.addEventListener("click", startRecording);
  stopRecBtn.addEventListener("click", stopRecording);
  loadFileBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", onFileSelected);
  processBtn.addEventListener("click", processVideo);
  slowMoBtn.addEventListener("click", toggleSlowMo);
  exportCSVBtn.addEventListener("click", exportCSV);

  startPreview();
});

/* ========================================
   DÉMARRER LA PRÉVISUALISATION DE LA WEBCAM
   ======================================== */
async function startPreview() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
    videoEl.srcObject = stream;
    videoEl.addEventListener("loadedmetadata", resizeCanvases);
    await waitForFirstNonBlackFrame(videoEl, 2000);
    recStateP.textContent = "État : Prévisualisation OK";
    requestAnimationFrame(previewLoop);
  } catch (e) {
    console.error("Erreur d'accès à la webcam :", e);
    recStateP.textContent = "État : Caméra indisponible";
  }
}

/* ========================================
   REDIMENSIONNER LES CANVAS
   ======================================== */
function resizeCanvases() {
  const W = videoEl.videoWidth || 640;
  const H = videoEl.videoHeight || 480;
  canvasOverlay.width = W;
  canvasOverlay.height = H;
}

/* ========================================
   ATTENDRE UNE IMAGE NON NOIRE
   ======================================== */
function waitForFirstNonBlackFrame(video, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const checkFrame = () => {
      if (Date.now() - startTime > timeoutMs) {
        resolve();
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

      let isBlack = true;
      for (let i = 0; i < imageData.length; i += 4) {
        if (imageData[i] > 10 || imageData[i + 1] > 10 || imageData[i + 2] > 10) {
          isBlack = false;
          break;
        }
      }

      if (!isBlack) {
        resolve();
      } else {
        requestAnimationFrame(checkFrame);
      }
    };

    checkFrame();
  });
}

/* ========================================
   BOUCLE DE PRÉVISUALISATION
   ======================================== */
function previewLoop() {
  if (videoEl.readyState >= 2) {
    if (canvasOverlay.width !== videoEl.videoWidth || canvasOverlay.height !== videoEl.videoHeight) {
      resizeCanvases();
    }
    ctx.clearRect(0, 0, canvasOverlay.width, canvasOverlay.height);

    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = canvasOverlay.width;
    tmpCanvas.height = canvasOverlay.height;
    const tmpCtx = tmpCanvas.getContext("2d");
    tmpCtx.drawImage(videoEl, 0, 0, tmpCanvas.width, tmpCanvas.height);
    const frame = tmpCtx.getImageData(0, 0, tmpCanvas.width, tmpCanvas.height);

    const det = detectBallOrMireQuick(frame);
    if (det) {
      ctx.beginPath();
      ctx.strokeStyle = det.type === "ball" ? "lime" : "cyan";
      ctx.lineWidth = 3;
      ctx.arc(det.x, det.y, 12, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  requestAnimationFrame(previewLoop);
}

/* ========================================
   DÉTECTION RAPIDE (POUR LA PRÉVISUALISATION)
   ======================================== */
function detectBallOrMireQuick(imgData) {
  const ball = detectBallHSV(imgData, 6);
  if (ball) return ball;
  const mire = detectMireBW(imgData, 6);
  if (mire) return mire;
  return null;
}

/* ========================================
   DÉTECTION DE LA BALLE (HSV)
   ======================================== */
function detectBallHSV(imgData, stride = 2) {
  const data = imgData.data;
  const W = imgData.width, H = imgData.height;
  let sumX = 0, sumY = 0, count = 0;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  for (let y = 0; y < H; y += stride) {
    const row = y * W;
    for (let x = 0; x < W; x += stride) {
      const i = (row + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const hsv = rgbToHsv(r, g, b);
      if (hsv.h >= CONFIG.HSV.H_MIN && hsv.h <= CONFIG.HSV.H_MAX && hsv.s >= CONFIG.HSV.S_MIN && hsv.v >= CONFIG.HSV.V_MIN) {
        sumX += x; sumY += y; count++;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }

  if (count < CONFIG.MIN_PIXELS_BALL) return null;
  const diamPx = Math.max(maxX - minX, maxY - minY);
  return { type: "ball", x: sumX / count, y: sumY / count, count, diamPx };
}

/* ========================================
   CONVERSION RGB -> HSV
   ======================================== */
function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, v = max;
  const d = max - min;
  s = max === 0 ? 0 : d / max;
  if (d !== 0) {
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s, v };
}

/* ========================================
   DÉTECTION DE LA MIRE (NOIR ET BLANC)
   ======================================== */
function detectMireBW(imgData, stride = 2) {
  const data = imgData.data;
  const W = imgData.width, H = imgData.height;
  let sumX = 0, sumY = 0, count = 0;

  for (let y = 0; y < H; y += stride) {
    const row = y * W;
    for (let x = 0; x < W; x += stride) {
      const i = (row + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const lum = (r + g + b) / 3;
      if (lum < 40 || lum > 215) {
        sumX += x; sumY += y; count++;
      }
    }
  }

  if (count < CONFIG.MIN_PIXELS_MIRE) return null;
  return { type: "mire", x: sumX / count, y: sumY / count, count };
}

/* ========================================
   DÉMARRER L'ENREGISTREMENT
   ======================================== */
function startRecording() {
  if (!videoEl.srcObject) {
    alert("Caméra non initialisée.");
    return;
  }

  try {
    mediaRecorder = new MediaRecorder(videoEl.srcObject);
  } catch (e) {
    alert("Impossible d'initialiser l'enregistrement : " + e);
    return;
  }

  recordedChunks = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size) recordedChunks.push(e.data);
  };

  mediaRecorder.onstop = () => {
    recordedBlob = new Blob(recordedChunks, { type: "video/webm" });
    loadedVideoURL = URL.createObjectURL(recordedBlob);
    blobSizeP.textContent = `Taille vidéo : ${(recordedBlob.size / 1024 / 1024).toFixed(2)} MB`;
    processBtn.disabled = false;
    slowMoBtn.disabled = false;
    recStateP.textContent = "État : Enregistrement terminé";
  };

  mediaRecorder.start();
  recStateP.textContent = "État : Enregistrement...";
  startRecBtn.disabled = true;
  stopRecBtn.disabled = false;
}

/* ========================================
   ARRÊTER L'ENREGISTREMENT
   ======================================== */
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
  startRecBtn.disabled = false;
  stopRecBtn.disabled = true;
}

/* ========================================
   CHARGEMENT D'UN FICHIER VIDÉO
   ======================================== */
function onFileSelected(e) {
  const file = e.target.files[0];
  if (!file) return;

  loadedVideoURL = URL.createObjectURL(file);
  blobSizeP.textContent = `Taille vidéo : ${(file.size / 1024 / 1024).toFixed(2)} MB`;
  processBtn.disabled = false;
  slowMoBtn.disabled = false;
  exportCSVBtn.disabled = true;
}

/* ========================================
   TRAITEMENT DE LA VIDÉO
   ======================================== */
async function processVideo() {
  if (!loadedVideoURL && !videoEl.srcObject) {
    alert("Aucune source vidéo : enregistre ou charge un fichier.");
    return;
  }

  samplesRaw = [];
  samplesFilt = [];
  pxToMeter = null;
  bgAccumulator = null;
  bgCount = 0;
  useBackground = false;

  nSamplesSpan.textContent = "0";
  aEstimatedSpan.textContent = "—";
  aTheorySpan.textContent = "—";
  regEquationP.textContent = "Équation : —";
  pxToMeterDisplay.textContent = "Calibration : —";
  rampAngleDisplay.textContent = "Angle rampe : —";
  exportCSVBtn.disabled = true;

  const procVid = document.createElement("video");
  procVid.muted = true;
  procVid.playsInline = true;
  procVid.width = canvasOverlay.width || 640;
  procVid.height = canvasOverlay.height || 480;

  if (loadedVideoURL) {
    procVid.src = loadedVideoURL;
  } else {
    alert("Traitement en direct non supporté — enregistre et traite le fichier enregistré.");
    return;
  }

  await procVid.play().catch(() => { });

  const W = procVid.videoWidth || 640;
  const H = procVid.videoHeight || 480;
  canvasOverlay.width = W;
  canvasOverlay.height = H;

  const tmpCanvas = document.createElement("canvas");
  tmpCanvas.width = W;
  tmpCanvas.height = H;
  const tmpCtx = tmpCanvas.getContext("2d");

  // Estimation du fond à partir des premières images
  for (let i = 0; i < CONFIG.BG_FRAMES; i++) {
    const t = Math.min(procVid.duration || 0, i * (1 / 30));
    await seekAndDraw(procVid, t, tmpCtx, W, H, (imgData) => {
      if (!bgAccumulator) bgAccumulator = new Float32Array(imgData.data.length);
      const data = imgData.data;
      for (let k = 0; k < data.length; k++) bgAccumulator[k] += data[k];
      bgCount++;
    });
  }

  if (bgCount > 0) {
    for (let k = 0; k < bgAccumulator.length; k++) bgAccumulator[k] /= bgCount;
    useBackground = true;
  }

  // Traitement de la vidéo
  const stepMs = Math.max(10, CONFIG.FRAME_STEP_MS);
  for (let tMs = 0; tMs * 0.001 <= (procVid.duration || 0) + 0.0001; tMs += stepMs) {
    const tSec = tMs * 0.001;
    await seekAndDraw(procVid, tSec, tmpCtx, W, H, (imgData) => {
      const det = detectBallOrMire(imgData, useBackground ? bgAccumulator : null);
      if (det) {
        samplesRaw.push({ t: tSec, x_px: det.x, y_px: det.y, type: det.type, diamPx: det.diamPx || null });
        if (!pxToMeter && det.type === "ball" && det.diamPx && det.diamPx > 2) {
          pxToMeter = CONFIG.BALL_REAL_DIAM_M / det.diamPx;
          pxToMeterDisplay.textContent = pxToMeter.toFixed(6) + " m/px";
        }
      }
    });
  }

  if (samplesRaw.length < 3) {
    alert("Aucune détection fiable : vérifie l'éclairage, la mire/balle, ou la vidéo.");
    return;
  }

  // Tri et application du filtre de Kalman
  samplesRaw.sort((a, b) => a.t - b.t);
  kalman = createKalman();
  let kinit = false;
  let prevT = samplesRaw[0].t;

  for (let i = 0; i < samplesRaw.length; i++) {
    const s = samplesRaw[i];
    const t = s.t;
    const x_m = pxToMeter ? s.x_px * pxToMeter : s.x_px;
    const y_m = pxToMeter ? s.y_px * pxToMeter : s.y_px;

    if (!kinit) {
      kalman.setFromMeasurement([[x_m], [y_m]]);
      kinit = true;
      samplesFilt.push({ t, x: x_m, y: y_m, vx: 0, vy: 0 });
      prevT = t;
      continue;
    }

    const dt = Math.max(1e-6, t - prevT);
    kalman.predict(dt);
    kalman.update([[x_m], [y_m]]);
    prevT = t;
    const st = kalman.getState();
    samplesFilt.push({ t, x: st.x, y: st.y, vx: Math.round(st.vx * 1000) / 1000, vy: Math.round(st.vy * 1000) / 1000 });
  }

  // Estimation de l'angle de la rampe
  const ramp = estimateRampAngleAndAxis(samplesFilt);
  rampAngleDisplay.textContent = ramp.angleDeg.toFixed(2) + "°";

  // Ajustement des données et ajustement parabolique
  const sVals = samplesFilt.map(p => {
    const dx = p.x - ramp.cx;
    const dy = p.y - ramp.cy;
    return dx * ramp.ux + dy * ramp.uy;
  });

  const ts = samplesFilt.map(p => p.t);
  const parab = fitParabola(ts, sVals);
  const aEst = parab ? parab.a : NaN;
  aEstimatedSpan.textContent = Number.isFinite(aEst) ? aEst.toFixed(4) : "—";
  const aTheory = 9.81 * Math.sin(ramp.angleDeg * Math.PI / 180);
  aTheorySpan.textContent = aTheory.toFixed(4);

  if (parab) {
    regEquationP.textContent = `s(t) = ${(parab.a / 2).toFixed(4)}·t² + ${parab.v0.toFixed(4)}·t + ${parab.s0.toFixed(4)}`;
  }

  // Construction des graphiques
  buildCharts(samplesFilt);
  nSamplesSpan.textContent = String(samplesFilt.length);
  exportCSVBtn.disabled = false;
}

/* ========================================
   RECHERCHER ET DESSINER UNE IMAGE À UN TEMPS DONNÉ
   ======================================== */
function seekAndDraw(video, tSec, tctx, W, H, cb) {
  return new Promise((res) => {
    const onseeked = () => {
      tctx.drawImage(video, 0, 0, W, H);
      const img = tctx.getImageData(0, 0, W, H);
      cb(img);
      video.removeEventListener('seeked', onseeked);
      res();
    };
    video.addEventListener('seeked', onseeked);
    video.currentTime = Math.min(video.duration || tSec, tSec);
  });
}

/* ========================================
   DÉTECTION COMBINÉE : BALLE OU MIRE OU MOUVEMENT
   ======================================== */
function detectBallOrMire(imgData, bgAccum = null) {
  const ball = detectBallHSV(imgData, CONFIG.STRIDE);
  const mire = detectMireBW(imgData, CONFIG.STRIDE);

  if (ball && mire) {
    const sb = ball.count / CONFIG.MIN_PIXELS_BALL;
    const sm = mire.count / CONFIG.MIN_PIXELS_MIRE;
    return sb >= sm ? ball : mire;
  }

  if (ball) return ball;
  if (mire) return mire;

  if (bgAccum) {
    const m = detectMotionByBg(imgData, bgAccum, CONFIG.STRIDE, CONFIG.MOTION_DIFF_THRESHOLD);
    if (m) { m.type = "motion"; return m; }
  }

  return null;
}

/* ========================================
   DÉTECTION PAR SOUSTRACTION DE FOND
   ======================================== */
function detectMotionByBg(imgData, bgAccum, stride = 2, threshold = 60) {
  const data = imgData.data;
  const W = imgData.width, H = imgData.height;
  let sumX = 0, sumY = 0, count = 0;

  for (let y = 0; y < H; y += stride) {
    const row = y * W;
    for (let x = 0; x < W; x += stride) {
      const idx = (row + x) * 4;
      const dr = Math.abs(data[idx] - bgAccum[idx]);
      const dg = Math.abs(data[idx + 1] - bgAccum[idx + 1]);
      const db = Math.abs(data[idx + 2] - bgAccum[idx + 2]);
      if (dr + dg + db > threshold) {
        sumX += x; sumY += y; count++;
      }
    }
  }

  if (count < 8) return null;
  return { x: sumX / count, y: sumY / count, count };
}

/* ========================================
   AJUSTEMENT PARABOLIQUE
   ======================================== */
function fitParabola(tArr, sArr) {
  const n = tArr.length;
  if (n < 3) return null;

  let S0 = 0, S1 = 0, S2 = 0, S3 = 0, S4 = 0;
  let T0 = 0, T1 = 0, T2 = 0;

  for (let i = 0; i < n; i++) {
    const t = tArr[i], s = sArr[i];
    const t2 = t * t, t3 = t2 * t, t4 = t3 * t;
    S0 += 1; S1 += t; S2 += t2; S3 += t3; S4 += t4;
    T0 += s; T1 += t * s; T2 += t2 * s;
  }

  const A = [[S4, S3, S2], [S3, S2, S1], [S2, S1, S0]];
  const B = [T2, T1, T0];
  const sol = solve3x3(A, B);

  if (!sol) return null;
  const Acoef = sol[0], Bcoef = sol[1], Ccoef = sol[2];
  const a = 2 * Acoef;
  return { a, v0: Bcoef, s0: Ccoef };
}

/* ========================================
   RÉSOLUTION D'UN SYSTÈME LINÉAIRE 3X3
   ======================================== */
function solve3x3(A, B) {
  const M = [A[0].slice(), A[1].slice(), A[2].slice()];
  const b = [B[0], B[1], B[2]];

  for (let i = 0; i < 3; i++) {
    let piv = M[i][i];
    if (Math.abs(piv) < 1e-12) {
      let swapped = false;
      for (let r = i + 1; r < 3; r++) {
        if (Math.abs(M[r][i]) > 1e-12) {
          [M[i], M[r]] = [M[r], M[i]];
          [b[i], b[r]] = [b[r], b[i]];
          swapped = true;
          break;
        }
      }
      if (!swapped) return null;
      piv = M[i][i];
    }

    for (let j = i; j < 3; j++) M[i][j] /= piv;
    b[i] /= piv;

    for (let r = 0; r < 3; r++) {
      if (r === i) continue;
      const f = M[r][i];
      for (let j = i; j < 3; j++) M[r][j] -= f * M[i][j];
      b[r] -= f * b[i];
    }
  }

  return b;
}

/* ========================================
   ESTIMATION DE L'ANGLE DE LA RAMPE
   ======================================== */
function estimateRampAngleAndAxis(samples) {
  const n = samples.length;
  const xs = samples.map(s => s.x), ys = samples.map(s => s.y);
  const cx = xs.reduce((a, b) => a + b, 0) / n;
  const cy = ys.reduce((a, b) => a + b, 0) / n;

  let sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - cx, dy = ys[i] - cy;
    sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
  }

  sxx /= n; syy /= n; sxy /= n;
  const trace = sxx + syy;
  const det = sxx * syy - sxy * sxy;
  const lambda1 = trace / 2 + Math.sqrt((trace * trace) / 4 - det);

  let vx = sxy, vy = lambda1 - sxx;
  if (Math.abs(vx) < 1e-8 && Math.abs(vy) < 1e-8) { vx = 1; vy = 0; }

  const norm = Math.hypot(vx, vy) || 1;
  vx /= norm; vy /= norm;
  const angleDeg = Math.atan2(vy, vx) * 180 / Math.PI;

  return { angleDeg, ux: vx, uy: vy, cx, cy };
}

/* ========================================
   CONSTRUCTION DES GRAPHIQUES
   ======================================== */
function buildCharts(samples) {
  const t = samples.map(s => s.t.toFixed(3));
  const xs = samples.map(s => s.x);
  const ys = samples.map(s => s.y);
  const vs = samples.map(s => Math.hypot(s.vx || 0, s.vy || 0));

  if (posChart) posChart.destroy();
  if (velChart) velChart.destroy();

  posChart = new Chart(document.getElementById("posChart"), {
    type: 'line',
    data: {
      labels: t,
      datasets: [
        { label: 'x (m)', data: xs, borderColor: 'blue', fill: false },
        { label: 'y (m)', data: ys, borderColor: 'green', fill: false }
      ]
    },
    options: { animation: false, responsive: true }
  });

  velChart = new Chart(document.getElementById("velChart"), {
    type: 'line',
    data: {
      labels: t,
      datasets: [
        { label: 'v (m/s)', data: vs, borderColor: 'red', fill: false }
      ]
    },
    options: { animation: false, responsive: true }
  });
}

/* ========================================
   EXPORT EN CSV
   ======================================== */
function exportCSV() {
  if (!samplesFilt.length) {
    alert("Aucune donnée filtrée à exporter.");
    return;
  }

  let csv = "t(s),x(m),y(m),vx(m/s),vy(m/s)\n";
  for (const s of samplesFilt) csv += `${s.t},${s.x},${s.y},${s.vx || ''},${s.vy || ''}\n`;

  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = "exAO03_data.csv";
  a.click();
}

/* ========================================
   ACTIVER/DÉSACTIVER LE RALENTI
   ======================================== */
function toggleSlowMo() {
  slowMotionFactor = slowMotionFactor === 1 ? 0.4 : 1;
  slowMoBtn.textContent = slowMotionFactor === 1 ? "Ralenti ×1" : "Ralenti ×0.4";
}

/* ========================================
   FILTRE DE KALMAN 2D
   ======================================== */
function createKalman() {
  let x = [[0], [0], [0], [0]];
  let P = [[1e3, 0, 0, 0], [0, 1e3, 0, 0], [0, 0, 1e3, 0], [0, 0, 0, 1e3]];
  const qPos = 1e-6, qVel = 1e-4;
  const Q = [[qPos, 0, 0, 0], [0, qVel, 0, 0], [0, 0, qPos, 0], [0, 0, 0, qVel]];
  const H = [[1, 0, 0, 0], [0, 0, 1, 0]];
  let R = [[1e-4, 0], [0, 1e-4]];

  function predict(dt) {
    const F = [[1, dt, 0, 0], [0, 1, 0, 0], [0, 0, 1, dt], [0, 0, 0, 1]];
    x = matMul(F, x);
    P = addM(matMul(matMul(F, P), transpose(F)), Q);
  }

  function update(z) {
    const y_resid = subM(z, matMul(H, x));
    const S = addM(matMul(matMul(H, P), transpose(H)), R);
    const K = matMul(matMul(P, transpose(H)), inv2x2(S));
    x = addM(x, matMul(K, y_resid));
    const I = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
    const KH = matMul(K, H);
    P = matMul(subM(I, KH), P);
  }

  function setFromMeasurement(z) {
    x = [[z[0][0]], [0], [z[1][0]], [0]];
    P = [[1e-1, 0, 0, 0], [0, 1e-1, 0, 0], [0, 0, 1e-1, 0], [0, 0, 0, 1e-1]];
  }

  function getState() {
    return { x: x[0][0], vx: x[1][0], y: x[2][0], vy: x[3][0] };
  }

  return { predict, update, getState, setFromMeasurement };
}

/* ========================================
   FONCTIONS MATRICIELLES POUR LE FILTRE DE KALMAN
   ======================================== */
function identity(n, scale = 1) {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? scale : 0));
}

function transpose(A) {
  return A[0].map((_, c) => A.map(r => r[c]));
}

function matMul(A, B) {
  const aR = A.length, aC = A[0].length, bC = B[0].length;
  const C = Array.from({ length: aR }, () => Array.from({ length: bC }, () => 0));
  for (let i = 0; i < aR; i++) {
    for (let k = 0; k < aC; k++) {
      const aik = A[i][k];
      for (let j = 0; j < bC; j++) {
        C[i][j] += aik * B[k][j];
      }
    }
  }
  return C;
}

function addM(A, B) {
  return A.map((r, i) => r.map((v, j) => v + B[i][j]));
}

function subM(A, B) {
  return A.map((r, i) => r.map((v, j) => v - B[i][j]));
}

function inv2x2(M) {
  const [a, b, c, d] = [M[0][0], M[0][1], M[1][0], M[1][1]];
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-12) return [[1e12, 0], [0, 1e12]];
  return [[d / det, -b / det], [-c / det, a / det]];
}
