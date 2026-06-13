import { initGame, startGame, pauseGame, registerInputPoint, clearInputPoint, resize } from './game.js';
import { initAudio, toggleAudio, isAudioEnabled } from './audio.js';
import { startTracking, stopTracking } from './tracking.js';

// DOM selectors
const bgCanvas = document.getElementById('bgCanvas');
const gameCanvas = document.getElementById('gameCanvas');
const webcam = document.getElementById('webcam');

const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const pauseScreen = document.getElementById('pauseScreen');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const pauseBtn = document.getElementById('pauseBtn');

const scoreDisplay = document.getElementById('scoreDisplay');
const comboHud = document.getElementById('comboHud');
const livesRow = document.getElementById('livesRow');
const highscoreHud = document.getElementById('highscoreHud');
const goScore = document.getElementById('goScore');
const goHighscore = document.getElementById('goHighscore');
const camStatusText = document.getElementById('camStatusText');
const centerText = document.getElementById('centerText');

// Settings Selectors
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');
const soundToggle = document.getElementById('soundToggle');
const trackingToggle = document.getElementById('trackingToggle');
const cameraPreviewToggle = document.getElementById('cameraPreviewToggle');
const trackingContainer = document.getElementById('trackingContainer');

let useTracking = true;
let showCameraPreview = true;
let mouseFallbackActive = false;

// Initialize Game Engine
initGame(gameCanvas, bgCanvas, {
  scoreDisplay,
  comboHud,
  livesRow,
  highscoreHud,
  centerText,
  gameOverScreen,
  goScore,
  goHighscore,
  pauseBtn,
  pauseScreen
});

// Sound Settings Handler
soundToggle.addEventListener('change', () => {
  const isEnabled = toggleAudio();
  soundToggle.checked = isEnabled;
});

// Tracking Settings Handler
trackingToggle.addEventListener('change', async () => {
  useTracking = trackingToggle.checked;
  if (useTracking) {
    setupTracking();
  } else {
    disableTracking();
  }
});

// Camera Preview Toggle
cameraPreviewToggle.addEventListener('change', () => {
  showCameraPreview = cameraPreviewToggle.checked;
  trackingContainer.style.display = showCameraPreview ? 'block' : 'none';
});

// Open/Close settings
settingsBtn.addEventListener('click', () => {
  settingsModal.classList.add('active');
  pauseGame(true);
});

closeSettings.addEventListener('click', () => {
  settingsModal.classList.remove('active');
  pauseGame(false);
});

// Close settings if clicked backdrop
settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) {
    settingsModal.classList.remove('active');
    pauseGame(false);
  }
});

// Setup Mouse Fallback
function setupMouseFallback() {
  if (mouseFallbackActive) return;
  mouseFallbackActive = true;

  const updateFromPointer = (e) => {
    if (useTracking) return; // Ignore if tracking active
    
    const rect = gameCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    registerInputPoint(x, y);
  };

  gameCanvas.addEventListener('pointerdown', (e) => {
    gameCanvas.setPointerCapture(e.pointerId);
    updateFromPointer(e);
  });
  
  gameCanvas.addEventListener('pointermove', updateFromPointer);
  
  gameCanvas.addEventListener('pointerup', () => {
    clearInputPoint();
  });
  
  gameCanvas.addEventListener('pointercancel', () => {
    clearInputPoint();
  });
}

// Disable webcam tracking
function disableTracking() {
  stopTracking();
  camStatusText.textContent = "Touch/Mouse mode";
  trackingContainer.classList.remove('active');
  setupMouseFallback();
}

// Enable webcam tracking
async function setupTracking() {
  try {
    trackingContainer.classList.add('active');
    camStatusText.textContent = "Loading tracking...";
    
    await startTracking(
      webcam,
      window.innerWidth,
      window.innerHeight,
      (status) => {
        camStatusText.textContent = status;
      },
      (coords) => {
        if (coords) {
          registerInputPoint(coords.x, coords.y);
        } else {
          clearInputPoint();
        }
      }
    );
  } catch (error) {
    console.warn("MediaPipe failed to start, falling back.", error);
    trackingToggle.checked = false;
    useTracking = false;
    disableTracking();
  }
}

// User Interaction Trigger
function initUserSession() {
  initAudio();
  soundToggle.checked = isAudioEnabled();
  
  if (useTracking) {
    setupTracking();
  } else {
    disableTracking();
  }
  
  startGame();
}

startBtn.addEventListener('click', () => {
  startScreen.style.opacity = '0';
  setTimeout(() => {
    startScreen.style.display = 'none';
  }, 300);
  initUserSession();
});

restartBtn.addEventListener('click', () => {
  startGame();
});

pauseBtn.addEventListener('click', () => {
  pauseGame();
});

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'KeyP') {
    pauseGame();
  }
});

// Setup default fallbacks in case user toggles webcam off
setupMouseFallback();
