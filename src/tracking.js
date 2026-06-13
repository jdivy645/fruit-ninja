import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

let handLandmarker = null;
let webcamStream = null;
let active = false;
let trackingLoopId = null;
let videoEl = null;

// Smoothed coordinates and predictors
let smoothFinger = null;
let latestRawFinger = null;
let trackingStatusText = "Touch/Mouse mode";

export async function initTracker(statusCallback) {
  if (handLandmarker) return handLandmarker;
  
  statusCallback("Loading AI Models...");
  try {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
    );
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numHands: 1,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.5
    });
    statusCallback("AI Models Ready");
    return handLandmarker;
  } catch (error) {
    console.error("Failed to load MediaPipe hand landmarker", error);
    statusCallback("Camera Initialization Failed (Touch/Mouse)");
    throw error;
  }
}

export async function startTracking(videoElement, canvasWidth, canvasHeight, statusCallback, onResultsCallback) {
  videoEl = videoElement;
  active = true;
  smoothFinger = null;
  latestRawFinger = null;

  try {
    await initTracker(statusCallback);
    
    statusCallback("Starting Camera...");
    const constraints = {
      video: {
        width: { ideal: 320 },
        height: { ideal: 240 },
        frameRate: { ideal: 30 },
        facingMode: "user"
      },
      audio: false
    };

    webcamStream = await navigator.mediaDevices.getUserMedia(constraints);
    videoEl.srcObject = webcamStream;
    
    await new Promise((resolve) => {
      videoEl.onloadedmetadata = () => {
        videoEl.play().then(resolve);
      };
    });

    statusCallback("Camera Active");
    
    let lastVideoTime = -1;
    
    // Core decoupled tracking loop
    const predictLoop = () => {
      if (!active) return;
      
      const now = performance.now();
      if (videoEl.currentTime !== lastVideoTime) {
        lastVideoTime = videoEl.currentTime;
        
        try {
          const detections = handLandmarker.detectForVideo(videoEl, now);
          processDetections(detections, canvasWidth, canvasHeight, onResultsCallback);
        } catch (err) {
          console.error("Detection error:", err);
        }
      }

      // Check if browser supports requestVideoFrameCallback for maximum efficiency
      if (videoEl.requestVideoFrameCallback) {
        trackingLoopId = videoEl.requestVideoFrameCallback(predictLoop);
      } else {
        trackingLoopId = requestAnimationFrame(predictLoop);
      }
    };

    if (videoEl.requestVideoFrameCallback) {
      trackingLoopId = videoEl.requestVideoFrameCallback(predictLoop);
    } else {
      trackingLoopId = requestAnimationFrame(predictLoop);
    }

  } catch (error) {
    console.warn("Hand tracking webcam initialization failed. Falling back to mouse/touch.", error);
    statusCallback("Touch/Mouse Mode");
    active = false;
    throw error;
  }
}

function processDetections(results, width, height, onResultsCallback) {
  if (results.landmarks && results.landmarks.length > 0) {
    // Landmark 8 is the index finger tip
    const fingerTip = results.landmarks[0][8];
    
    // Mirror the X-coordinate for natural user interaction
    const targetX = width - (fingerTip.x * width);
    const targetY = fingerTip.y * height;
    
    if (!smoothFinger) {
      smoothFinger = { x: targetX, y: targetY, px: targetX, py: targetY };
    }
    
    // Velocity calculation for lag prediction/extrapolation
    const vx = targetX - smoothFinger.px;
    const vy = targetY - smoothFinger.py;
    
    smoothFinger.px = targetX;
    smoothFinger.py = targetY;
    
    // Extrapolate ahead by 0.45 of velocity to catch up tracking delay
    const predX = targetX + vx * 0.45;
    const predY = targetY + vy * 0.45;
    
    // Snappy filtering (0.75 interpolator)
    smoothFinger.x += (predX - smoothFinger.x) * 0.75;
    smoothFinger.y += (predY - smoothFinger.y) * 0.75;
    
    latestRawFinger = { x: smoothFinger.x, y: smoothFinger.y };
    onResultsCallback(latestRawFinger);
  } else {
    // Hand left the screen
    onResultsCallback(null);
  }
}

export function stopTracking() {
  active = false;
  if (videoEl) {
    if (videoEl.requestVideoFrameCallback && trackingLoopId) {
      // requestVideoFrameCallback handles cancels via video elements natively
    } else if (trackingLoopId) {
      cancelAnimationFrame(trackingLoopId);
    }
    videoEl.pause();
    videoEl.srcObject = null;
  }
  if (webcamStream) {
    webcamStream.getTracks().forEach(track => track.stop());
    webcamStream = null;
  }
  smoothFinger = null;
  latestRawFinger = null;
}

export function isTrackingActive() {
  return active;
}
