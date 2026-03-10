// gestureNav.js — MediaPipe Hands gesture navigation
// WOZ PROTOTYPE -- @PAULA
// export function initGestureNav() {
//   console.log('[Gesture] WOZ stub loaded');


// }

///Starting here

// Copyright 2023 The MediaPipe Authors.

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//      http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {
  GestureRecognizer,
  FilesetResolver,
  DrawingUtils
} from "@mediapipe/tasks-vision";

let gestureRecognizer;
let webcamRunning = false;
let lastVideoTime = -1;
let stream = null;

let lastGestureName = "";
let stableFrames = 0;
let lastTriggerTime = 0;

const REQUIRED_STABLE_FRAMES = 4;
const COOLDOWN_MS = 220;
const MIN_SCORE = 0.7;

const ZOOM_STEP = 0.35;
const ROTATE_STEP = 0.18;
const SCROLL_STEP = 140;

export async function initGestureNav() {
  const demosSection = document.getElementById("demos");
  const video = document.getElementById("webcam");
  const canvasElement = document.getElementById("output_canvas");
  const gestureOutput = document.getElementById("gesture_output");
  const enableWebcamButton = document.getElementById("webcamButton");

  if (!video || !canvasElement || !gestureOutput || !enableWebcamButton) {
    console.warn("[GestureNav] Gesture HTML not found on this page.");
    return;
  }

  const canvasCtx = canvasElement.getContext("2d");

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
  );

  gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numHands: 1,
    cannedGesturesClassifierOptions: {
      scoreThreshold: MIN_SCORE
    }
  });

  if (demosSection) {
    demosSection.classList.remove("invisible");
  }

  enableWebcamButton.addEventListener("click", async () => {
    if (!webcamRunning) {
      await startWebcam(video);
      webcamRunning = true;
      enableWebcamButton.textContent = "DISABLE WEBCAM";
      predictWebcam(video, canvasElement, canvasCtx, gestureOutput);
    } else {
      stopWebcam(video);
      webcamRunning = false;
      enableWebcamButton.textContent = "ENABLE WEBCAM";
      gestureOutput.textContent = "";
      clearCanvas(canvasCtx, canvasElement);
    }
  });
}

async function startWebcam(video) {
  stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;
  await video.play();
}

function stopWebcam(video) {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
  video.srcObject = null;
}

function clearCanvas(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function predictWebcam(video, canvasElement, canvasCtx, gestureOutput) {
  if (!webcamRunning || !gestureRecognizer) return;

  const nowInMs = Date.now();

  if (video.videoWidth && video.videoHeight) {
    canvasElement.width = video.videoWidth;
    canvasElement.height = video.videoHeight;
  }

  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;

    const results = gestureRecognizer.recognizeForVideo(video, nowInMs);

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    const drawingUtils = new DrawingUtils(canvasCtx);

    if (results.landmarks) {
      for (const landmarks of results.landmarks) {
        drawingUtils.drawConnectors(
          landmarks,
          GestureRecognizer.HAND_CONNECTIONS,
          { color: "#00FF00", lineWidth: 3 }
        );
        drawingUtils.drawLandmarks(landmarks, {
          color: "#FF0000",
          lineWidth: 2
        });
      }
    }

    canvasCtx.restore();

    if (results.gestures && results.gestures.length > 0) {
      const topGesture = results.gestures[0][0];
      const gestureName = topGesture.categoryName;
      const score = topGesture.score;

      gestureOutput.textContent =
        `Gesture: ${gestureName} (${(score * 100).toFixed(1)}%)`;

      if (score >= MIN_SCORE) {
        if (gestureName === lastGestureName) {
          stableFrames++;
        } else {
          lastGestureName = gestureName;
          stableFrames = 1;
        }

        if (stableFrames >= REQUIRED_STABLE_FRAMES) {
          const now = Date.now();
          if (now - lastTriggerTime > COOLDOWN_MS) {
            lastTriggerTime = now;
            handleGestureAction(gestureName);
          }
        }
      } else {
        resetGestureState();
      }
    } else {
      gestureOutput.textContent = "No gesture";
      resetGestureState();
    }
  }

  requestAnimationFrame(() =>
    predictWebcam(video, canvasElement, canvasCtx, gestureOutput)
  );
}

function resetGestureState() {
  lastGestureName = "";
  stableFrames = 0;
}

function handleGestureAction(gesture) {
  switch (gesture) {
    case "Thumb_Up":
      window.dispatchEvent(
        new CustomEvent("gesture-zoom", { detail: { delta: -ZOOM_STEP } })
      );
      break;

    case "Thumb_Down":
      window.dispatchEvent(
        new CustomEvent("gesture-zoom", { detail: { delta: ZOOM_STEP } })
      );
      break;

    case "Pointing_Up":
      window.scrollBy({ top: -SCROLL_STEP, behavior: "smooth" });
      break;

    case "Victory":
      window.scrollBy({ top: SCROLL_STEP, behavior: "smooth" });
      break;

    case "Open_Palm":
      window.dispatchEvent(
        new CustomEvent("gesture-rotate", { detail: { deltaAngle: ROTATE_STEP } })
      );
      break;

    case "Closed_Fist":
      window.dispatchEvent(
        new CustomEvent("gesture-rotate", { detail: { deltaAngle: -ROTATE_STEP } })
      );
      break;
  }
}