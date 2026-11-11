
let espIP = "";
let activeDirection = null;

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
document.querySelectorAll(".move-btn").forEach(button => {

    button.addEventListener("pointerdown", function(event) {
        event.preventDefault();

        if (!espIP && !getAddress()) {
            alert("Hubungkan ESP32 terlebih dahulu!");
            return;
        }

        if (activeDirection !== null) {
            stopMove();
        }

        activeDirection = this.dataset.direction;
        move(activeDirection);
    });

    button.addEventListener("pointerup", function(event) {
        event.preventDefault();
        stopMove();
    });

    button.addEventListener("pointerleave", stopMove);
    button.addEventListener("pointercancel", stopMove);
});

// PENGAMAN JIKA JARI DILEPAS DI LUAR TOMBOL
document.addEventListener("pointerup", stopMove);
document.addEventListener("pointercancel", stopMove);
window.addEventListener("blur", stopMove);

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

// UPDATE STATUS SETIAP 1 DETIK
setInterval(updateStatus, 1000);
