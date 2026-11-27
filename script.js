
let espIP = "";
const pressedButtons = new Set();
let currentCommand = "";

const temperatureHistory = [];
const MAX_DATA = 60;

function resetTemperatureGraph() {
    temperatureHistory.length = 0;

    document.getElementById("chartCurrentTemp").textContent = "--.- °C";

    drawTemperatureChart();
}

// MENGAMBIL ALAMAT ESP32
function getAddress() {
    let address = document.getElementById("espIP").value.trim();

    if (!address) {
        return false;
    }

    if (!address.startsWith("http://") &&
        !address.startsWith("https://")) {
        address = "http://" + address;
    }

    espIP = address.replace(/\/$/, "");
    return true;
}

// MENGIRIM PERINTAH KE ESP32
async function sendCommand(path) {
    if (!espIP) return;

    try {
        await fetch(espIP + path, {
            method: "GET",
            cache: "no-store"
        });
    } catch (error) {
        console.log("Koneksi ESP32 gagal:", error);
    }
}

// CONNECT ROBOT
async function connectRobot() {
    if (!getAddress()) {
        alert("Masukkan IP ESP32 terlebih dahulu!");
        return;
    }
    resetTemperatureGraph();
    await lockLandscape();
    updateStatus();
}



// PERINTAH GERAK
function move(direction) {
    sendCommand("/api/cmd?m=" + direction);
}

// OTOMATIS STOP SAAT TOMBOL DILEPAS
function stopMove() {
    if (activeDirection !== null) {
        activeDirection = null;
        move("X");
    }
}

// MOTOR SPEED
function setSpeed(value) {
    document.getElementById("speedValue").textContent =
        value + " / 255";

    sendCommand("/api/speed?v=" + value);
}

// SERVO
function setServo(id, value) {
    document.getElementById(id + "Value").textContent =
        value + "°";

    sendCommand("/api/servo?id=" + id + "&v=" + value);
}

// KENDALI TOMBOL GERAK
// KENDALI KOMBINASI TOMBOL
function updateMovement() {
    let command = "";

    if (pressedButtons.has("S")) {
        command = "S";
    }
    else if (pressedButtons.has("W") && pressedButtons.has("A")) {
        command = "WA";
    }
    else if (pressedButtons.has("W") && pressedButtons.has("D")) {
        command = "WD";
    }
    else if (pressedButtons.has("W")) {
        command = "W";
    }
    else if (pressedButtons.has("A")) {
        command = "A";
    }
    else if (pressedButtons.has("D")) {
        command = "D";
    }
    else {
        command = "X";
    }

    if (command !== currentCommand) {
        currentCommand = command;
        move(command);
    }
}

// TOMBOL GERAK
document.querySelectorAll(".move-btn").forEach(button => {

    button.addEventListener("pointerdown", function(event) {
        event.preventDefault();

        if (!espIP && !getAddress()) {
            alert("Hubungkan ESP32 terlebih dahulu!");
            return;
        }

        this.setPointerCapture(event.pointerId);

        pressedButtons.add(this.dataset.direction);
        updateMovement();
    });

    button.addEventListener("pointerup", function(event) {
        event.preventDefault();

        pressedButtons.delete(this.dataset.direction);
        updateMovement();
    });

    button.addEventListener("pointercancel", function() {
        pressedButtons.delete(this.dataset.direction);
        updateMovement();
    });

    button.addEventListener("lostpointercapture", function() {
        pressedButtons.delete(this.dataset.direction);
        updateMovement();
    });
});

// PENGAMAN
window.addEventListener("blur", function() {
    pressedButtons.clear();
    updateMovement();
});

// MEMBACA DATA SENSOR DARI ESP32
async function updateStatus() {
    if (!espIP) return;

    try {
        const response = await fetch(espIP + "/api/status", {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("HTTP error");
        }

        const data = await response.json();

        document.getElementById("connection").textContent =
            "● CONNECTED";

        document.getElementById("temperature").textContent =
            Number(data.temperature).toFixed(1);
        addTemperaturePoint(
            Number(data.temperature),
            data.time
        );

        document.getElementById("ambient").textContent =
            Number(data.ambient).toFixed(1) + " °C";

        document.getElementById("clock").textContent = data.time;
        document.getElementById("date").textContent = data.date;

        document.getElementById("motor").textContent = data.motor;
        document.getElementById("sd").textContent = data.sd;
        document.getElementById("mlx").textContent = data.mlx;
        document.getElementById("rtc").textContent = data.rtc;

    } catch (error) {
        document.getElementById("connection").textContent =
            "● DISCONNECTED";
    }
}

async function lockLandscape() {
    try {
        if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
        }

        if (screen.orientation && screen.orientation.lock) {
            await screen.orientation.lock("landscape");
        }
    } catch (error) {
        console.log("Orientasi landscape tidak didukung:", error);
    }
}

// DAFTARKAN PWA
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js")
            .then(() => {
                console.log("NEON ROVER PWA aktif");
            })
            .catch(error => {
                console.log("PWA gagal:", error);
            });
    });
}
// UPDATE STATUS SETIAP 1 DETIK
setInterval(updateStatus, 1000);


// MENAMBAHKAN DATA SUHU KE GRAFIK
function addTemperaturePoint(temperature, time) {
    if (!Number.isFinite(temperature)) return;

    temperatureHistory.push({
        temperature: temperature,
        time: time || new Date().toLocaleTimeString("id-ID")
    });

    if (temperatureHistory.length > MAX_DATA) {
        temperatureHistory.shift();
    }

    document.getElementById("chartCurrentTemp").textContent =
        temperature.toFixed(1) + " °C";

    drawTemperatureChart();
}


// MENGGAMBAR GRAFIK SUHU
function drawTemperatureChart() {
    const canvas = document.getElementById("temperatureChart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (width === 0 || height === 0) return;

    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const left = 40;
    const right = width - 10;
    const top = 15;
    const bottom = height - 25;

    const graphHeight = bottom - top;
    const graphWidth = right - left;

    let values = temperatureHistory.map(p => p.temperature);

    let minTemp = values.length ? Math.min(...values) : 0;
    let maxTemp = values.length ? Math.max(...values) : 10;

    if (maxTemp === minTemp) {
        minTemp += 1;
        maxTemp -= 1;
    }

    const padding = (maxTemp - minTemp) * 0.2;
    minTemp -= padding;
    maxTemp += padding;

    // GARIS GRID DAN LABEL SUHU
    ctx.font = "10px Arial";
    ctx.textAlign = "right";
    ctx.fillStyle = "#8ca6c9";

    for (let i = 0; i <= 4; i++) {
        const y = top + (graphHeight / 4) * i;

        ctx.strokeStyle = "#24415c";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.stroke();

        const temp = maxTemp -
            ((maxTemp - minTemp) / 4) * i;

        ctx.fillText(temp.toFixed(1) + "°", left - 5, y + 3);
    }

    if (temperatureHistory.length === 0) return;

    // MENGGAMBAR GARIS SUHU
    ctx.strokeStyle = "#00e5ff";
    ctx.lineWidth = 2;
    ctx.beginPath();

    temperatureHistory.forEach((point, index) => {
        const x = left +
            (index / Math.max(temperatureHistory.length - 1, 1)) *
            graphWidth;

        const y = bottom -
            ((point.temperature - minTemp) /
            (maxTemp - minTemp)) * graphHeight;

        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });

    ctx.stroke();

    // LABEL WAKTU
    ctx.fillStyle = "#8ca6c9";
    ctx.font = "10px Arial";
    ctx.textAlign = "left";

    ctx.fillText(temperatureHistory[0].time, left, height - 5);

    ctx.textAlign = "right";

    ctx.fillText(
        temperatureHistory[temperatureHistory.length - 1].time,
        right,
        height - 5
    );
}

