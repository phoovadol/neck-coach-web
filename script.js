// Elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const resetCalBtn = document.getElementById('resetCalBtn');
const demoBtn = document.getElementById('demoBtn');
const statusEl = document.getElementById('status');
const countEl = document.getElementById('count');
const errorBox = document.getElementById('errorBox');
const videoEl = document.getElementById('video');
const canvasEl = document.getElementById('outputCanvas');
const ctx = canvasEl.getContext('2d');

// State
let camera = null;
let faceMesh = null;
let neutralY = null;
let repCount = 0;
let state = 'idle';
let demoMode = false;
let demoInterval = null;

// Thresholds
const DOWN_DIFF = 0.03;
const UP_DIFF = 0.01;

function setStatus(text) {
  statusEl.innerHTML = 'สถานะ: <span>' + text + '</span>';
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove('hidden');
}

function clearError() {
  errorBox.textContent = '';
  errorBox.classList.add('hidden');
}

function initFaceMesh() {
  if (faceMesh) return;
  faceMesh = new FaceMesh({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`});
  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });
  faceMesh.onResults(onResults);
}

function onResults(results) {
  const w = results.image?.width || videoEl.videoWidth || 400;
  const h = results.image?.height || videoEl.videoHeight || 300;
  if (canvasEl.width !== w || canvasEl.height !== h) {
    canvasEl.width = w;
    canvasEl.height = h;
  }

  ctx.save();
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  if (results.image) ctx.drawImage(results.image, 0, 0, canvasEl.width, canvasEl.height);

  const faces = results.multiFaceLandmarks || [];
  if (faces.length === 0) {
    setStatus('ไม่เจอใบหน้า — กรุณาเอียงกล้อง/เพิ่มแสง');
    ctx.restore();
    return;
  }

  const landmarks = faces[0];
  const nose = landmarks[1];
  const y = nose.y;

  const nx = nose.x * canvasEl.width;
  const ny = nose.y * canvasEl.height;
  ctx.fillStyle = 'rgba(255,0,0,0.9)';
  ctx.beginPath();
  ctx.arc(nx, ny, 6, 0, Math.PI * 2);
  ctx.fill();

  processNoseY(y);
  ctx.restore();
}

function processNoseY(y) {
  clearError();
  if (!neutralY) {
    neutralY = y;
    setStatus('Calibration เสร็จ! เริ่มทำ Chin Tuck');
    resetCalBtn.disabled = false;
    stopBtn.disabled = false;
    return;
  }

  const diff = y - neutralY;
  if (state === 'idle' && diff > DOWN_DIFF) {
    state = 'down';
    setStatus('ก้มศีรษะแล้ว');
  }

  if (state === 'down' && diff < UP_DIFF) {
    state = 'idle';
    repCount += 1;
    countEl.textContent = repCount;
    setStatus('เงยกลับขึ้นมา — ครบ ' + repCount + ' รอบ');
  }
}

async function requestCameraPermission() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('เบราว์เซอร์ของคุณไม่รองรับ getUserMedia');
  }
  let stream = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(t => t.stop());
    return true;
  } catch (err) {
    throw err;
  }
}

async function startCamera() {
  initFaceMesh();
  camera = new Camera(videoEl, {
    onFrame: async () => {
      try {
        await faceMesh.send({ image: videoEl });
      } catch (e) {
        console.error('faceMesh.send error', e);
      }
    },
    width: 640,
    height: 480
  });

  try {
    await camera.start();
    videoEl.classList.add('hidden');
    canvasEl.classList.remove('hidden');
    setStatus('กล้องทำงาน — มองตรงไปข้างหน้าเพื่อ calibration');
  } catch (err) {
    camera = null;
    if (err && err.name === 'NotAllowedError') {
      showError('ไม่สามารถเข้าถึงกล้องได้: ปฏิเสธสิทธิ์');
    } else {
      showError('ไม่สามารถเข้าถึงกล้อง: ' + (err?.message || String(err)));
    }
    setStatus('ปัญหาในการเปิดกล้อง');
    startBtn.disabled = false;
    stopBtn.disabled = true;
    throw err;
  }
}

// Event listeners
startBtn.addEventListener('click', async () => {
  if (demoMode) stopDemo();
  clearError();
  startBtn.disabled = true;
  setStatus('กำลังขอสิทธิ์เข้าถึงกล้อง...');

  if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    showError('⚠️ ต้องรันบน HTTPS หรือ localhost เท่านั้น');
  }

  try {
    await requestCameraPermission();
    await startCamera();
    stopBtn.disabled = false;
    resetCalBtn.disabled = false;
  } catch (err) {
    startBtn.disabled = false;
  }
});

stopBtn.addEventListener('click', async () => {
  clearError();
  if (camera) {
    try { await camera.stop(); } catch (e) {}
    camera = null;
  }
  startBtn.disabled = false;
  stopBtn.disabled = true;
  setStatus('หยุดกล้องแล้ว — กดเริ่มเพื่อทดลองใหม่');
});

resetCalBtn.addEventListener('click', () => {
  neutralY = null;
  repCount = 0;
  state = 'idle';
  countEl.textContent = repCount;
  setStatus('Calibration ถูกรีเซ็ต — มองตรงเพื่อเริ่มใหม่');
});

demoBtn.addEventListener('click', () => {
  if (demoMode) stopDemo();
  else startDemo();
});

function startDemo() {
  demoMode = true;
  startBtn.disabled = true;
  stopBtn.disabled = false;
  resetCalBtn.disabled = false;
  demoBtn.textContent = 'หยุด Demo';
  setStatus('Demo mode — จำลองการก้ม/เงย');

  let t = 0;
  neutralY = null;
  repCount = 0;
  state = 'idle';
  countEl.textContent = repCount;

  demoInterval = setInterval(() => {
    t += 0.12;
    const simY = 0.5 + 0.06 * Math.sin(t);
    if (canvasEl.width !== 400 || canvasEl.height !== 300) {
      canvasEl.width = 400;
      canvasEl.height = 300;
    }
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(120, 60, 160, 180);

    const nx = canvasEl.width / 2;
    const ny = simY * canvasEl.height;
    ctx.fillStyle = 'rgba(255,0,0,0.9)';
    ctx.beginPath();
    ctx.arc(nx, ny, 8, 0, Math.PI * 2);
    ctx.fill();

    processNoseY(simY);
  }, 120);
}

function stopDemo() {
  demoMode = false;
  if (demoInterval) clearInterval(demoInterval);
  demoInterval = null;
  demoBtn.textContent = 'ใช้งานแบบทดสอบ (Demo)';
  startBtn.disabled = false;
  stopBtn.disabled = true;
  setStatus('Demo หยุดแล้ว');
}

// Init
canvasEl.width = 400;
canvasEl.height = 300;
initFaceMesh();
