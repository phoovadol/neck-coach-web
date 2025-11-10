// ====== โหลด FaceMesh และ utils ======
const videoEl = document.getElementById("video");
const canvasEl = document.getElementById("outputCanvas");
const canvasCtx = canvasEl.getContext("2d");

let faceMesh = null;
let camera = null;
let isRunning = false;

// ====== ฟังก์ชันเริ่มต้น FaceMesh ======
async function initFaceMesh() {
  faceMesh = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
  });

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  faceMesh.onResults(onResults);
}

// ====== แสดงผลลัพธ์บน Canvas ======
function onResults(results) {
  if (!isRunning) return;

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasEl.width, canvasEl.height);

  if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
    for (const landmarks of results.multiFaceLandmarks) {
      drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION,
        { color: "#C0C0C070", lineWidth: 1 });
      drawConnectors(canvasCtx, landmarks, FACEMESH_FACE_OVAL,
        { color: "#FF3030", lineWidth: 2 });
    }
  }

  canvasCtx.restore();
}

// ====== เริ่มกล้อง ======
async function startCamera() {
  if (isRunning) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoEl.srcObject = stream;
    await videoEl.play();

    isRunning = true;

    camera = new Camera(videoEl, {
      onFrame: async () => {
        if (faceMesh && isRunning) {
          await faceMesh.send({ image: videoEl });
        }
      },
      width: 640,
      height: 480,
    });
    camera.start();

    document.getElementById("status").innerHTML = "สถานะ: <span>กำลังทำงาน...</span>";
  } catch (err) {
    alert("❌ ไม่สามารถเข้าถึงกล้องได้ โปรดอนุญาตการใช้งานกล้อง");
    console.error(err);
  }
}

// ====== หยุดกล้อง ======
function stopCamera() {
  isRunning = false;
  if (camera) camera.stop();
  document.getElementById("status").innerHTML = "สถานะ: <span>หยุดแล้ว</span>";
}

// ====== รีเซ็ต ======
function resetSystem() {
  stopCamera();
  document.getElementById("count").innerText = "จำนวนครั้ง: 0";
  document.getElementById("status").innerHTML = "สถานะ: <span>พร้อม</span>";
}

// ====== Event ปุ่ม ======
document.getElementById("startBtn").addEventListener("click", startCamera);
document.getElementById("stopBtn").addEventListener("click", stopCamera);
document.getElementById("resetCalBtn").addEventListener("click", resetSystem);

// ====== โหลด FaceMesh ======
initFaceMesh();
