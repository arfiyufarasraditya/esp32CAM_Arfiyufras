const ipInput = document.getElementById("cameraIp");
const connectBtn = document.getElementById("connectBtn");
const cameraFeed = document.getElementById("cameraFeed");
const videoWrap = document.getElementById("videoWrap");
const placeholder = document.getElementById("placeholder");
const statusBox = document.querySelector(".status");
const statusText = document.getElementById("statusText");
const flashState = document.getElementById("flashState");
const message = document.getElementById("message");

let cameraAddress = "";
let checkTimer = null;
let wakeLock = null;

const defaults = {
  resolution: "QVGA", quality: 14, brightness: 0, contrast: 0, saturation: 0,
  vflip: false, hmirror: true, rotation: 180, videoSize: 100
};

const settingIds = ["resolution", "quality", "brightness", "contrast", "saturation", "vflip", "hmirror"];

function setOnline(online) {
  statusBox.classList.toggle("online", online);
  statusText.textContent = online ? "CAMERA ONLINE" : "NOT CONNECTED";
}

function cleanIp(value) {
  return value.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

function apiUrl(path, params = {}) {
  const query = new URLSearchParams(params);
  return `http://${cameraAddress}${path}${query.toString() ? "?" + query.toString() : ""}`;
}

async function checkCamera() {
  if (!cameraAddress) return;
  try {
    const response = await fetch(apiUrl("/"), {
      method: "GET", cache: "no-store", signal: AbortSignal.timeout(3000)
    });
    if (!response.ok) throw new Error("Kamera tidak merespons");
    setOnline(true);
    message.textContent = "ESP32-CAM terhubung. Streaming sedang ditampilkan.";
    document.getElementById("settingsCameraIp").textContent = `Kamera di ${cameraAddress}`;
    if (cameraFeed.dataset.active !== "true") reloadVideo();
  } catch (error) {
    setOnline(false);
    cameraFeed.dataset.active = "false";
    cameraFeed.removeAttribute("src");
    cameraFeed.style.display = "none";
    placeholder.style.display = "grid";
    message.textContent = "Kamera belum terjangkau. Periksa hotspot, IP, dan izin jaringan browser.";
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
  cameraFeed.dataset.active = "false";
  checkCamera();
  checkTimer = setInterval(checkCamera, 8000);
}

function reloadVideo() {
  if (!cameraAddress) {
    message.textContent = "Hubungkan kamera terlebih dahulu.";
    return;
  }
  cameraFeed.dataset.active = "true";
  cameraFeed.style.display = "block";
  placeholder.style.display = "none";
  cameraFeed.src = `http://${cameraAddress}:81/stream?t=${Date.now()}`;
  message.textContent = "Memuat ulang streaming kamera...";
}

cameraFeed.addEventListener("error", () => {
  cameraFeed.dataset.active = "false";
  cameraFeed.style.display = "none";
  placeholder.style.display = "grid";
  message.textContent = "Streaming gagal dimuat. Periksa koneksi kamera dan akses HTTP lokal.";
});

async function sendCameraSettings() {
  if (!cameraAddress) {
    document.getElementById("settingsMessage").textContent = "Hubungkan kamera terlebih dahulu.";
    return;
  }

  const params = {};
  for (const id of settingIds) {
    const el = document.getElementById(id);
    params[id] = el.type === "checkbox" ? (el.checked ? "1" : "0") : el.value;
  }

  try {
    const response = await fetch(apiUrl("/camera", params), {
      method: "GET", cache: "no-store", signal: AbortSignal.timeout(4000)
    });
    if (!response.ok) throw new Error("Pengaturan ditolak");
    const result = await response.text();
    document.getElementById("settingsMessage").textContent = result || "Pengaturan kamera diterapkan.";
    applyDisplaySettings();
  } catch (error) {
    document.getElementById("settingsMessage").textContent =
      "Gagal mengirim pengaturan. Pastikan firmware Arduino sudah diperbarui dan HP satu jaringan dengan kamera.";
  }
}

function applyDisplaySettings() {
  const rotation = Number(document.getElementById("rotation").value);
  const size = Number(document.getElementById("videoSize").value);
  document.getElementById("videoSizeValue").textContent = `${size}%`;
  cameraFeed.style.width = `${size}%`;
  cameraFeed.style.height = `${size}%`;
  cameraFeed.style.transform = `rotate(${rotation}deg)`;
  if (rotation === 90 || rotation === 270) {
    cameraFeed.style.width = `${Math.min(100, size * 0.72)}%`;
    cameraFeed.style.height = `${Math.min(140, size * 1.35)}%`;
  }
}

function updateValueLabels() {
  ["quality", "brightness", "contrast", "saturation"].forEach(id => {
    document.getElementById(`${id}Value`).textContent = document.getElementById(id).value;
  });
  applyDisplaySettings();
}

async function setFlash(state) {
  if (!cameraAddress) {
    message.textContent = "Hubungkan kamera terlebih dahulu.";
    return;
  }
  try {
    const response = await fetch(apiUrl("/flash", {state}), {
      method: "GET", cache: "no-store", signal: AbortSignal.timeout(3000)
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

function openSettings() {
  document.getElementById("settingsBackdrop").hidden = false;
  applyDisplaySettings();
}
function closeSettings() {
  document.getElementById("settingsBackdrop").hidden = true;
}

async function toggleWakeLock(enabled) {
  try {
    if (enabled && "wakeLock" in navigator) {
      wakeLock = await navigator.wakeLock.request("screen");
      document.getElementById("settingsMessage").textContent = "Layar akan dijaga tetap menyala selama halaman aktif.";
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    } else if (wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    } else if (enabled) {
      document.getElementById("settingsMessage").textContent = "Browser ini belum mendukung fitur layar tetap menyala.";
    }
  } catch (error) {
    document.getElementById("settingsMessage").textContent = "Izin layar tetap menyala tidak tersedia.";
  }
}

function resetSettings() {
  document.getElementById("resolution").value = defaults.resolution;
  document.getElementById("quality").value = defaults.quality;
  document.getElementById("brightness").value = defaults.brightness;
  document.getElementById("contrast").value = defaults.contrast;
  document.getElementById("saturation").value = defaults.saturation;
  document.getElementById("vflip").checked = defaults.vflip;
  document.getElementById("hmirror").checked = defaults.hmirror;
  document.getElementById("rotation").value = defaults.rotation;
  document.getElementById("videoSize").value = defaults.videoSize;
  updateValueLabels();
  sendCameraSettings();
}

connectBtn.addEventListener("click", connectCamera);
document.getElementById("flashOn").addEventListener("click", () => setFlash("on"));
document.getElementById("flashOff").addEventListener("click", () => setFlash("off"));
document.getElementById("openSettings").addEventListener("click", openSettings);
document.getElementById("closeSettings").addEventListener("click", closeSettings);
document.getElementById("reloadVideo").addEventListener("click", reloadVideo);
document.getElementById("resetSettings").addEventListener("click", resetSettings);

settingIds.forEach(id => {
  const el = document.getElementById(id);
  el.addEventListener(el.type === "checkbox" || el.tagName === "SELECT" ? "change" : "input", () => {
    updateValueLabels();
    sendCameraSettings();
  });
});
["rotation", "videoSize"].forEach(id => {
  document.getElementById(id).addEventListener("input", updateValueLabels);
  document.getElementById(id).addEventListener("change", updateValueLabels);
});
document.getElementById("keepAwake").addEventListener("change", event => toggleWakeLock(event.target.checked));
document.getElementById("settingsBackdrop").addEventListener("click", event => {
  if (event.target.id === "settingsBackdrop") closeSettings();
});

const savedIp = localStorage.getItem("camvision_ip");
if (savedIp) ipInput.value = savedIp;
updateValueLabels();
