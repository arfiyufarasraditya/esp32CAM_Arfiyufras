const ipInput = document.getElementById("cameraIp");
const connectBtn = document.getElementById("connectBtn");
const cameraFeed = document.getElementById("cameraFeed");
const placeholder = document.getElementById("placeholder");
const statusBox = document.querySelector(".status");
const statusText = document.getElementById("statusText");
const flashState = document.getElementById("flashState");
const message = document.getElementById("message");

let cameraAddress = "";
let checkTimer = null;

function setOnline(online) {
  statusBox.classList.toggle("online", online);
  statusText.textContent = online ? "CAMERA ONLINE" : "NOT CONNECTED";
}

function cleanIp(value) {
  return value.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

async function checkCamera() {
  if (!cameraAddress) return;
  try {
    const response = await fetch(`http://${cameraAddress}/`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(2500)
    });
    if (!response.ok) throw new Error("Camera tidak merespons");
    setOnline(true);
    message.textContent = "ESP32-CAM terhubung. Streaming sedang ditampilkan.";
    if (cameraFeed.style.display !== "block") {
      cameraFeed.src = `http://${cameraAddress}:81/stream`;
      cameraFeed.style.display = "block";
      placeholder.style.display = "none";
    }
  } catch (error) {
    setOnline(false);
    cameraFeed.removeAttribute("src");
    cameraFeed.style.display = "none";
    placeholder.style.display = "grid";
    message.textContent = "Kamera belum terjangkau. Periksa hotspot dan alamat IP.";
  }
}

function connectCamera() {
  const ip = cleanIp(ipInput.value);
  if (!ip) {
    message.textContent = "Masukkan alamat IP ESP32-CAM terlebih dahulu.";
    return;
  }
  cameraAddress = ip;
  localStorage.setItem("camvision_ip", ip);
  if (checkTimer) clearInterval(checkTimer);
  checkCamera();
  checkTimer = setInterval(checkCamera, 5000);
}

async function setFlash(state) {
  if (!cameraAddress) {
    message.textContent = "Hubungkan kamera terlebih dahulu.";
    return;
  }
  try {
    // no-cors avoids browser CORS blocking on older firmware, but the response is unreadable.
    // Current firmware includes CORS headers, so normal fetch is used.
    const response = await fetch(`http://${cameraAddress}/flash?state=${state}`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(3000)
    });
    if (!response.ok) throw new Error("Perintah gagal");
    const result = (await response.text()).trim();
    flashState.textContent = result;
    message.textContent = `Flash berhasil diatur: ${result}`;
  } catch (error) {
    message.textContent = "Gagal mengontrol flash. Pastikan kamera online dan HP satu jaringan.";
    setOnline(false);
  }
}

connectBtn.addEventListener("click", connectCamera);
document.getElementById("flashOn").addEventListener("click", () => setFlash("on"));
document.getElementById("flashOff").addEventListener("click", () => setFlash("off"));

const savedIp = localStorage.getItem("camvision_ip");
if (savedIp) ipInput.value = savedIp;
