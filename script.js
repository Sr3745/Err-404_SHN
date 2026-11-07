import {
    GestureRecognizer,
    FilesetResolver,
    DrawingUtils
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

// --- CLIENT-SIDE DATABASE ---
const SECRET_PASSWORD = ["Victory", "Closed_Fist", "ILoveYou", "Open_Palm"];
// ----------------------------

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const statusBar = document.getElementById("status-bar");
const progressContainer = document.getElementById("progress-container");
const progressCircle = document.querySelector(".progress-ring__circle");
const progressEmoji = document.getElementById("progress-emoji");

const dots = [
    document.getElementById("dot-0"),
    document.getElementById("dot-1"),
    document.getElementById("dot-2"),
    document.getElementById("dot-3")
];

const emojiMap = {
    "Victory": "✌️", "Closed_Fist": "✊", "Open_Palm": "🖐️",
    "Thumb_Up": "👍", "Thumb_Down": "👎", "Pointing_Up": "☝️", "ILoveYou": "🤟"
};

let gestureRecognizer;
let webcamRunning = false;
let lastVideoTime = -1;

let currentSequence = [];
let currentHoldingGesture = "None";
let holdStartTime = 0;
const HOLD_DURATION = 1500; 
let isLockedCoolingDown = false; 
let isVerifying = false;

const radius = progressCircle.r.baseVal.value;
const circumference = radius * 2 * Math.PI;
progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;

async function createGestureRecognizer() {
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
    );
    gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
            delegate: "GPU"
        },
        runningMode: "VIDEO"
    });
    startWebcam();
}

async function startWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.addEventListener("loadeddata", predictWebcam);
        webcamRunning = true;
    } catch (err) {
        console.error("Camera error:", err);
    }
}

async function predictWebcam() {
    if (!gestureRecognizer) return;

    if (video.currentTime !== lastVideoTime && !isVerifying) {
        lastVideoTime = video.currentTime;
        const results = gestureRecognizer.recognizeForVideo(video, Date.now());

        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        const drawingUtils = new DrawingUtils(canvasCtx);

        if (results.landmarks.length > 0) {
            for (const landmarks of results.landmarks) {
                drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, { color: "#ffffff", lineWidth: 3 });
                drawingUtils.drawLandmarks(landmarks, { color: "#baffc9", lineWidth: 2, radius: 4 });
            }

            const detectedGesture = results.gestures[0][0].categoryName;

            if (isLockedCoolingDown) {
                if (detectedGesture === "None") isLockedCoolingDown = false; 
            } 
            else if (detectedGesture !== "None") {
                if (detectedGesture !== currentHoldingGesture) {
                    currentHoldingGesture = detectedGesture;
                    holdStartTime = Date.now();
                    progressContainer.style.opacity = "1";
                    progressContainer.classList.remove("locked-in");
                    progressEmoji.innerText = emojiMap[detectedGesture] || "";
                    statusBar.innerText = "Holding...";
                    statusBar.style.color = "#ffffba";
                } else {
                    const elapsed = Date.now() - holdStartTime;
                    const percentLeft = Math.max(0, 100 - (elapsed / HOLD_DURATION) * 100);
                    const offset = circumference - (percentLeft / 100) * circumference;
                    progressCircle.style.strokeDashoffset = offset;

                    if (elapsed >= HOLD_DURATION) {
                        lockInGesture(detectedGesture);
                    }
                }
            } else {
                resetHolding();
            }
        } else {
            resetHolding();
        }
        canvasCtx.restore();
    }
    if (webcamRunning) window.requestAnimationFrame(predictWebcam);
}

function resetHolding() {
    currentHoldingGesture = "None";
    progressContainer.style.opacity = "0";
    progressCircle.style.strokeDashoffset = 0;
    progressContainer.classList.remove("locked-in");
    statusBar.innerText = "Awaiting Input";
    statusBar.style.color = "#ffb3ba";
    if(!isVerifying) isLockedCoolingDown = false;
}

function lockInGesture(gesture) {
    isLockedCoolingDown = true; 
    progressCircle.style.strokeDashoffset = circumference; 
    progressContainer.classList.add("locked-in"); 

    const slot = currentSequence.length;
    dots[slot].innerText = emojiMap[gesture];
    dots[slot].classList.add("filled");

    currentSequence.push(gesture);
    statusBar.innerText = "Gesture Logged";
    statusBar.style.color = "#baffc9";

    setTimeout(() => { resetHolding(); }, 500);

    if (currentSequence.length === 4) {
        verifySequence(currentSequence);
    }
}

async function verifySequence(sequence) {
    isVerifying = true;
    statusBar.innerText = "Verifying...";
    
    // Check if arrays match exactly
    const isMatch = sequence.length === SECRET_PASSWORD.length && 
                    sequence.every((val, index) => val === SECRET_PASSWORD[index]);

    // Simulate a brief network delay so the UI feels authentic
    setTimeout(async () => {
        if (isMatch) {
            for (let i = 0; i < dots.length; i++) {
                await new Promise(r => setTimeout(r, 250)); 
                dots[i].innerText = '✅';
                dots[i].classList.add("success-pop");
            }
            
            setTimeout(() => {
                document.getElementById("main-layout").style.display = "none";
                document.getElementById("success-page").style.display = "flex";
                webcamRunning = false;
            }, 1000);

        } else {
            statusBar.innerText = "Invalid Password. Retry.";
            dots.forEach(dot => {
                dot.innerText = '❌';
                dot.classList.add("error-shake");
            });

            setTimeout(() => {
                resetBoard();
            }, 2000);
        }
    }, 800);
}

function resetBoard() {
    dots.forEach(dot => {
        dot.innerText = '';
        dot.classList.remove("filled", "error-shake", "success-pop");
    });
    currentSequence = [];
    isVerifying = false;
    resetHolding();
}

createGestureRecognizer();