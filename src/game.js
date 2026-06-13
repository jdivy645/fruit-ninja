import { playSwipe, playSlice, playCombo, playExplosion, playPowerup, playGameOver } from './audio.js';

// Configuration constants
const MAX_LIVES = 3;
const TRAIL_LIFE = 240;
const HIGH_SCORE_KEY = 'fnhs';
const GRAVITY = 0.35;

const FRUITS = [
  { emoji: '🍎', color: '#e63939', juice: '#ff6666', r: 34 },
  { emoji: '🍊', color: '#ff8c00', juice: '#ffbb44', r: 32 },
  { emoji: '🍉', color: '#33cc44', juice: '#ff4455', r: 42 },
  { emoji: '🍍', color: '#ddcc00', juice: '#ffee44', r: 36 },
  { emoji: '🍓', color: '#cc2244', juice: '#ff5577', r: 28 },
  { emoji: '🥝', color: '#5aa832', juice: '#aadd44', r: 28 },
];

const SPECIAL_BANANAS = {
  freeze: { emoji: '🍌', color: '#00c3ff', juice: '#aae6ff', r: 36, isSpecial: 'freeze' },
  frenzy: { emoji: '🍌', color: '#ffaa00', juice: '#ffe2aa', r: 36, isSpecial: 'frenzy' }
};

// State variables
let width = 0;
let height = 0;
let score = 0;
let lives = MAX_LIVES;
let combo = 0;
let highScore = parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10);
let gameRunning = false;
let paused = false;
let lastTime = 0;
let spawnTimer = 0;
let spawnInterval = 1000;
let gameTime = 0;
let animationFrameId = 0;
let scaleDpr = 1;

let smoothFinger = null;
let finger = null;
let handTrail = [];
let fruits = [];
let splitFruits = []; // Sliced halves flying apart
let particles = [];
let comboTimer = null;
let shakeFrames = 0;
let shakeStrength = 0;

// Powerup states
let freezeTimeLeft = 0; // ms
let frenzyTimeLeft = 0; // ms
let frenzySpawnTimer = 0;

// DOM references
let canvas = null;
let ctx = null;
let bgCanvas = null;
let bgCtx = null;
let scoreDisplay = null;
let comboHud = null;
let livesRow = null;
let highscoreHud = null;
let centerText = null;
let gameOverScreen = null;
let goScore = null;
let goHighscore = null;
let pauseBtn = null;
let pauseScreen = null;

export function initGame(gameCanvasEl, bgCanvasEl, elements) {
  canvas = gameCanvasEl;
  ctx = canvas.getContext('2d');
  bgCanvas = bgCanvasEl;
  bgCtx = bgCanvas.getContext('2d');
  
  scoreDisplay = elements.scoreDisplay;
  comboHud = elements.comboHud;
  livesRow = elements.livesRow;
  highscoreHud = elements.highscoreHud;
  centerText = elements.centerText;
  gameOverScreen = elements.gameOverScreen;
  goScore = elements.goScore;
  goHighscore = elements.goHighscore;
  pauseBtn = elements.pauseBtn;
  pauseScreen = elements.pauseScreen;
  
  ctx.imageSmoothingEnabled = true;
  bgCtx.imageSmoothingEnabled = true;
  
  resize();
  window.addEventListener('resize', resize);
  
  renderLives();
  highscoreHud.textContent = 'BEST: ' + highScore;
}

export function startGame() {
  score = 0;
  lives = MAX_LIVES;
  combo = 0;
  gameTime = 0;
  spawnTimer = 0;
  spawnInterval = 1000;
  fruits = [];
  splitFruits = [];
  particles = [];
  handTrail = [];
  finger = null;
  smoothFinger = null;
  freezeTimeLeft = 0;
  frenzyTimeLeft = 0;
  frenzySpawnTimer = 0;
  clearTimeout(comboTimer);

  scoreDisplay.textContent = '0';
  renderLives();
  updateComboHud();
  highscoreHud.textContent = 'BEST: ' + highScore;
  
  gameOverScreen.classList.remove('active');
  pauseScreen.classList.remove('active');
  pauseBtn.style.display = 'block';
  pauseBtn.textContent = '⏸ PAUSE';
  gameRunning = true;
  paused = false;
  lastTime = performance.now();

  cancelAnimationFrame(animationFrameId);
  animationFrameId = requestAnimationFrame(loop);
}

export function resize() {
  if (!canvas || !bgCanvas) return;
  
  scaleDpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;

  canvas.width = bgCanvas.width = Math.round(width * scaleDpr);
  canvas.height = bgCanvas.height = Math.round(height * scaleDpr);
  canvas.style.width = bgCanvas.style.width = width + 'px';
  canvas.style.height = bgCanvas.style.height = height + 'px';

  ctx.setTransform(scaleDpr, 0, 0, scaleDpr, 0, 0);
  bgCtx.setTransform(scaleDpr, 0, 0, scaleDpr, 0, 0);
  
  drawStaticBackground();
}

function drawStaticBackground() {
  bgCtx.clearRect(0, 0, width, height);
  
  // Radial gradient backing
  const grad = bgCtx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#110905');
  grad.addColorStop(0.5, '#070402');
  grad.addColorStop(1, '#020100');
  bgCtx.fillStyle = grad;
  bgCtx.fillRect(0, 0, width, height);

  // Soft spotlight glow
  const glow = bgCtx.createRadialGradient(
    width * 0.5, height * 0.4, 0,
    width * 0.5, height * 0.4, Math.max(width, height) * 0.85
  );
  glow.addColorStop(0, 'rgba(255, 140, 50, 0.08)');
  glow.addColorStop(0.5, 'rgba(120, 50, 10, 0.03)');
  glow.addColorStop(1, 'transparent');
  bgCtx.fillStyle = glow;
  bgCtx.fillRect(0, 0, width, height);

  // Subtle wood board stripes
  bgCtx.save();
  bgCtx.globalAlpha = 0.04;
  bgCtx.strokeStyle = '#ffbb77';
  bgCtx.lineWidth = 1.5;
  for (let i = 0; i < 16; i++) {
    const y = (height / 16) * i;
    bgCtx.beginPath();
    bgCtx.moveTo(0, y);
    bgCtx.bezierCurveTo(width * 0.25, y + 10, width * 0.75, y - 10, width, y);
    bgCtx.stroke();
  }
  bgCtx.restore();
}

function renderLives() {
  livesRow.innerHTML = '';
  for (let i = 0; i < MAX_LIVES; i++) {
    const dot = document.createElement('div');
    dot.className = 'life-icon' + (i >= lives ? ' lost' : '');
    livesRow.appendChild(dot);
  }
}

function updateComboHud() {
  comboHud.textContent = combo >= 3 ? combo + 'x COMBO!' : '';
  comboHud.classList.toggle('visible', combo >= 3);
}

function showFloatingText(text) {
  centerText.textContent = text;
  centerText.classList.add('visible');
  setTimeout(() => {
    centerText.classList.remove('visible');
  }, 450);
}

export function triggerScreenShake(strength = 14, frames = 18) {
  shakeFrames = frames;
  shakeStrength = strength;
}

function spawnFruit(isBomb = false, specialType = null) {
  const margin = 80;
  const def = specialType 
    ? SPECIAL_BANANAS[specialType]
    : FRUITS[Math.floor(Math.random() * FRUITS.length)];
    
  const x = margin + Math.random() * Math.max(0, width - margin * 2);
  const targetRise = height * (0.62 + Math.random() * 0.22) + 80;
  const launchSpeed = Math.sqrt(2 * GRAVITY * targetRise);
  const inwardBias = ((width / 2 - x) / width) * 4.2;
  
  return {
    x,
    y: height + 80,
    speedX: inwardBias + (Math.random() - 0.5) * 3.5,
    speedY: -launchSpeed,
    radius: isBomb ? 32 : def.r + Math.random() * 10,
    rotation: Math.random() * 360,
    rotSpeed: (Math.random() - 0.5) * 4.5,
    def,
    type: isBomb ? 'bomb' : (specialType ? specialType : 'fruit'),
    cut: false
  };
}

function spawnWave() {
  // If frenzy is active, we spawn more fruits, and no bombs
  if (frenzyTimeLeft > 0) {
    const count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const fruit = spawnFruit(false);
      fruit.x += (i - (count - 1) / 2) * 85;
      fruits.push(fruit);
    }
    return;
  }

  const count = 1 + Math.floor(Math.random() * 3);
  
  // Chance to spawn special bananas
  const specialChance = 0.08; 
  // Spawn bombs more frequently as requested
  const bombChance = Math.min(0.24 + gameTime / 45000 * 0.18, 0.45);

  for (let i = 0; i < count; i++) {
    let fruit;
    if (Math.random() < bombChance) {
      fruit = spawnFruit(true);
    } else if (Math.random() < specialChance) {
      const type = Math.random() < 0.5 ? 'freeze' : 'frenzy';
      fruit = spawnFruit(false, type);
    } else {
      fruit = spawnFruit(false);
    }
    fruit.x += (i - (count - 1) / 2) * 75;
    fruits.push(fruit);
  }
}

export function registerInputPoint(x, y) {
  if (!gameRunning || paused) return;
  
  finger = { x, y };
  handTrail.push({ x, y, t: performance.now() });
  
  if (handTrail.length > 8) {
    handTrail.shift();
  }
  
  // Play subtle swish sound occasionally based on movement speed
  if (handTrail.length >= 2) {
    const p1 = handTrail[handTrail.length - 2];
    const speed = Math.hypot(x - p1.x, y - p1.y);
    if (speed > 45 && Math.random() < 0.35) {
      playSwipe();
    }
  }

  checkSlice();
}

export function clearInputPoint() {
  finger = null;
}

function checkSlice() {
  if (handTrail.length < 2) return;
  const recent = handTrail.slice(-4);

  for (let s = 1; s < recent.length; s++) {
    const ax = recent[s - 1].x;
    const ay = recent[s - 1].y;
    const bx = recent[s].x;
    const by = recent[s].y;
    
    const speed = Math.hypot(bx - ax, by - ay);
    if (speed < 8) continue;

    for (let i = fruits.length - 1; i >= 0; i--) {
      const fruit = fruits[i];
      if (fruit.cut) continue;
      
      const hitRadius = fruit.radius * 1.05;
      if (segmentCircleIntersect(ax, ay, bx, by, fruit.x, fruit.y, hitRadius)) {
        sliceFruit(fruit, i);
        break;
      }
    }
  }
}

function segmentCircleIntersect(ax, ay, bx, by, cx, cy, r) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return Math.hypot(cx - ax, cy - ay) <= r;
  }
  
  let t = ((cx - ax) * dx + (cy - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  
  const closestX = ax + t * dx;
  const closestY = ay + t * dy;
  
  return Math.hypot(cx - closestX, cy - closestY) <= r;
}

function sliceFruit(fruit, index) {
  fruit.cut = true;
  fruits.splice(index, 1);

  if (fruit.type === 'bomb') {
    lives--;
    renderLives();
    score = Math.max(0, score - 15);
    scoreDisplay.textContent = score;
    combo = 0;
    updateComboHud();
    spawnExplosion(fruit.x, fruit.y);
    spawnComboFloat(fruit.x, fruit.y - 50, '-15', '#ff4444', 36);
    showFloatingText('BOOM!');
    triggerScreenShake(20, 24);
    playExplosion();
    
    if (lives <= 0) {
      endGame();
    }
    return;
  }

  // Play crisp slice sound
  playSlice();

  // Trigger fruit halves split animation
  splitFruitPhysics(fruit);

  // Handle Power-Ups
  if (fruit.type === 'freeze') {
    freezeTimeLeft = 6000;
    playPowerup('freeze');
    showFloatingText('FREEZE!');
    spawnComboFloat(fruit.x, fruit.y - 50, 'FREEZE TIME', '#00d9ff', 24);
  } else if (fruit.type === 'frenzy') {
    frenzyTimeLeft = 6000;
    playPowerup('frenzy');
    showFloatingText('FRENZY!');
    spawnComboFloat(fruit.x, fruit.y - 50, 'FRUIT FRENZY', '#ffaa00', 24);
  }

  // Score & Combo Calculations
  combo++;
  clearTimeout(comboTimer);
  comboTimer = setTimeout(() => {
    if (combo >= 3) {
      playCombo(combo);
    }
    combo = 0;
    updateComboHud();
  }, 900);
  
  updateComboHud();

  const points = 1 + (combo > 3 ? (combo - 3) * 2 : 0);
  score += points;
  scoreDisplay.textContent = score;

  spawnJuice(fruit.x, fruit.y, fruit.def.juice);
  spawnComboFloat(fruit.x, fruit.y - 35, '+' + points, '#ccffcc', 26);

  if (combo >= 3) {
    spawnComboFloat(fruit.x, fruit.y - 65, combo + 'x COMBO!', combo >= 5 ? '#ffaa00' : '#ffe600', 28);
  }
}

function splitFruitPhysics(fruit) {
  const r = fruit.radius;
  // Left half
  splitFruits.push({
    x: fruit.x,
    y: fruit.y,
    speedX: fruit.speedX - 3 - Math.random() * 2,
    speedY: fruit.speedY - 2,
    radius: r,
    rotation: fruit.rotation,
    rotSpeed: -5 - Math.random() * 6,
    def: fruit.def,
    isLeft: true,
    life: 1.0
  });

  // Right half
  splitFruits.push({
    x: fruit.x,
    y: fruit.y,
    speedX: fruit.speedX + 3 + Math.random() * 2,
    speedY: fruit.speedY - 2,
    radius: r,
    rotation: fruit.rotation,
    rotSpeed: 5 + Math.random() * 6,
    def: fruit.def,
    isLeft: false,
    life: 1.0
  });
}

function spawnJuice(x, y, color, count = 16) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2.5 + Math.random() * 6.5;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2.5,
      life: 1.0,
      decay: 0.018 + Math.random() * 0.025,
      r: 3 + Math.random() * 6,
      color
    });
  }
}

function spawnExplosion(x, y) {
  for (let i = 0; i < 30; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3.5 + Math.random() * 11;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      life: 1.0,
      decay: 0.015 + Math.random() * 0.02,
      r: 5 + Math.random() * 8,
      color: Math.random() < 0.6 ? '#ff5b00' : '#ffcc00'
    });
  }
}

function spawnComboFloat(x, y, text, color, size = 26) {
  const el = document.createElement('div');
  el.className = 'combo-float';
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.fontSize = size + 'px';
  el.style.color = color;
  document.getElementById('gameWrapper').appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

export function pauseGame(state = null) {
  if (!gameRunning) return;
  paused = (state !== null) ? state : !paused;
  
  pauseScreen.classList.toggle('active', paused);
  pauseBtn.textContent = paused ? '▶ RESUME' : '⏸ PAUSE';
  
  if (!paused) {
    lastTime = performance.now();
  }
}

export function endGame() {
  gameRunning = false;
  pauseBtn.style.display = 'none';
  playGameOver();

  if (score > highScore) {
    highScore = score;
    localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
    goHighscore.textContent = 'NEW HIGH SCORE!';
  } else {
    goHighscore.textContent = 'Best: ' + highScore;
  }
  
  goScore.textContent = score;
  gameOverScreen.classList.add('active');
}

function loop(ts) {
  if (!gameRunning) return;
  if (paused) {
    animationFrameId = requestAnimationFrame(loop);
    return;
  }

  let dt = Math.min(ts - lastTime, 50);
  lastTime = ts;

  // Slow motion math during Freeze mode
  let timeScale = 1.0;
  if (freezeTimeLeft > 0) {
    freezeTimeLeft -= dt;
    timeScale = 0.45; // 55% slowdown
  }
  
  const scaledDt = dt * timeScale;
  gameTime += scaledDt;

  // Frenzy spawn intervals
  if (frenzyTimeLeft > 0) {
    frenzyTimeLeft -= dt;
    frenzySpawnTimer += dt;
    if (frenzySpawnTimer >= 320) {
      frenzySpawnTimer = 0;
      spawnWave();
    }
  } else {
    // Normal spawning mechanics
    spawnInterval = Math.max(650, 1050 - gameTime / 1000 * 6.5);
    spawnTimer += scaledDt;
    if (spawnTimer >= spawnInterval) {
      spawnTimer = 0;
      spawnWave();
    }
  }

  // Physics Updates
  const gravity = GRAVITY * timeScale;

  // Active fruits
  for (const fruit of fruits) {
    fruit.speedY += gravity;
    fruit.x += fruit.speedX * timeScale;
    fruit.y += fruit.speedY * timeScale;
    fruit.rotation += fruit.rotSpeed * timeScale;
    
    // Check if missed fruit falls off-screen
    if (fruit.y > height + 100 && fruit.speedY > 0 && !fruit.cut) {
      // User requested: "dont out when the fruits get own without cut"
      // Missed fruits do not cost lives or trigger game over. Simply shake camera slightly.
      if (fruit.type === 'fruit') {
        triggerScreenShake(3, 4);
      }
      // Remove it
      fruit.y = height + 500; // Trigger filter
    }
  }

  // Fruit halves
  for (const half of splitFruits) {
    half.speedY += gravity;
    half.x += half.speedX * timeScale;
    half.y += half.speedY * timeScale;
    half.rotation += half.rotSpeed * timeScale;
    half.life -= 0.015 * timeScale;
  }

  // Particles
  for (const p of particles) {
    p.vy += gravity * 0.55;
    p.x += p.vx * timeScale;
    p.y += p.vy * timeScale;
    p.vx *= 0.97;
    p.life -= p.decay * timeScale;
  }

  // Filter out dead assets
  fruits = fruits.filter(f => f.y < height + 120);
  splitFruits = splitFruits.filter(h => h.y < height + 120 && h.life > 0);
  particles = particles.filter(p => p.life > 0);
  handTrail = handTrail.filter(pt => performance.now() - pt.t < TRAIL_LIFE);

  drawGame();
  animationFrameId = requestAnimationFrame(loop);
}

function drawGame() {
  ctx.clearRect(0, 0, width, height);
  ctx.save();

  // Screen shake logic
  if (shakeFrames > 0) {
    shakeFrames--;
    ctx.translate((Math.random() - 0.5) * shakeStrength, (Math.random() - 0.5) * shakeStrength);
    shakeStrength *= 0.88;
  }

  // Freeze Vignette
  if (freezeTimeLeft > 0) {
    const freezeOpacity = Math.min(0.4, freezeTimeLeft / 1000);
    const grad = ctx.createRadialGradient(width * 0.5, height * 0.5, Math.min(width, height) * 0.3, width * 0.5, height * 0.5, Math.max(width, height) * 0.75);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, `rgba(0, 200, 255, ${freezeOpacity * 0.85})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  // Frenzy Vignette
  if (frenzyTimeLeft > 0) {
    const frenzyOpacity = Math.min(0.4, frenzyTimeLeft / 1000);
    const grad = ctx.createRadialGradient(width * 0.5, height * 0.5, Math.min(width, height) * 0.3, width * 0.5, height * 0.5, Math.max(width, height) * 0.75);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, `rgba(255, 80, 0, ${frenzyOpacity * 0.85})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  // Draw juice spray (No shadowBlur to ensure 60FPS)
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.restore();
  }

  // Draw active flying fruits
  for (const fruit of fruits) {
    ctx.save();
    ctx.translate(fruit.x, fruit.y);
    ctx.rotate(fruit.rotation * Math.PI / 180);
    if (fruit.type === 'bomb') {
      drawBomb(fruit);
    } else {
      drawFruit(fruit);
    }
    ctx.restore();
  }

  // Draw sliced halves falling
  for (const half of splitFruits) {
    drawSplitFruit(half);
  }

  // Draw neon slice trail
  drawTrail();

  // Draw fingertip indicator (no shadowBlur)
  if (finger && gameRunning) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(finger.x, finger.y, 12, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 220, 100, 0.2)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 220, 100, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(finger.x, finger.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function drawFruit(fruit) {
  const r = fruit.radius;
  
  // Shadow
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.beginPath();
  ctx.ellipse(3, r * 0.75, r * 0.85, r * 0.22, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();

  // Special power-up visual aura (no shadowBlur)
  if (fruit.def.isSpecial) {
    ctx.save();
    ctx.strokeStyle = fruit.def.color;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.12, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Gradient Base
  const grad = ctx.createRadialGradient(-r * 0.28, -r * 0.28, r * 0.08, 0, 0, r);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.42)');
  grad.addColorStop(0.35, fruit.def.color);
  grad.addColorStop(1, shadeColor(fruit.def.color, -45));
  
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Emoji Drawing
  ctx.font = r * 1.1 + 'px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fruit.def.emoji, 0, 0);
}

function drawSplitFruit(half) {
  const r = half.radius;
  ctx.save();
  ctx.translate(half.x, half.y);
  ctx.rotate(half.rotation * Math.PI / 180);
  ctx.globalAlpha = half.life;

  // Semi-circular clipping region
  ctx.beginPath();
  if (half.isLeft) {
    ctx.rect(-r - 10, -r - 10, r + 10, r * 2 + 20);
  } else {
    ctx.rect(0, -r - 10, r + 10, r * 2 + 20);
  }
  ctx.clip();

  // Draw Base Gradient
  const grad = ctx.createRadialGradient(-r * 0.28, -r * 0.28, r * 0.08, 0, 0, r);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.42)');
  grad.addColorStop(0.35, half.def.color);
  grad.addColorStop(1, shadeColor(half.def.color, -45));
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Draw Emoji
  ctx.font = r * 1.1 + 'px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(half.def.emoji, 0, 0);

  // Draw the pulpy inner cut edge details
  ctx.strokeStyle = '#fffae8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(0, r);
  ctx.stroke();

  ctx.restore();
}

function drawBomb(fruit) {
  const r = fruit.radius;
  const pulse = 0.88 + Math.sin(performance.now() / 95) * 0.12;
  
  // Outer red alert ring for bomb (hardware accelerated glow)
  ctx.strokeStyle = '#ff3c3c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, r * pulse * 1.1, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, r * pulse, 0, Math.PI * 2);
  
  const bg = ctx.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.08, 0, 0, r);
  bg.addColorStop(0, '#666');
  bg.addColorStop(0.5, '#222');
  bg.addColorStop(1, '#000');
  
  ctx.fillStyle = bg;
  ctx.fill();
  
  ctx.font = r * 1.1 + 'px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('💣', 0, 0);
}

function drawTrail() {
  if (handTrail.length < 2) return;
  const now = performance.now();
  
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  for (let i = 1; i < handTrail.length; i++) {
    const p0 = handTrail[i - 1];
    const p1 = handTrail[i];
    const age = (now - p1.t) / TRAIL_LIFE;
    if (age >= 1) continue;
    
    const alpha = 1 - age;
    const widthValue = Math.max(1, (1 - age) * 20);
    
    // Draw 3 concentric paths with different widths and opacities (hardware accelerated neon)
    // Stroke 1: Wide warm glowing outer aura
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineWidth = widthValue * 1.5;
    ctx.strokeStyle = `rgba(255, 150, 0, ${alpha * 0.18})`;
    ctx.stroke();

    // Stroke 2: Medium bright glow core
    ctx.lineWidth = widthValue * 0.75;
    ctx.strokeStyle = `rgba(255, 215, 0, ${alpha * 0.55})`;
    ctx.stroke();

    // Stroke 3: Thin white-hot blade center
    ctx.lineWidth = widthValue * 0.25;
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.stroke();
  }
  ctx.restore();
}

function shadeColor(hex, amount) {
  const numeric = parseInt(hex.slice(1), 16);
  const red = Math.max(0, Math.min(255, ((numeric >> 16) & 255) + amount));
  const green = Math.max(0, Math.min(255, ((numeric >> 8) & 255) + amount));
  const blue = Math.max(0, Math.min(255, (numeric & 255) + amount));
  return 'rgb(' + red + ',' + green + ',' + blue + ')';
}

export function cleanGame() {
  gameRunning = false;
  cancelAnimationFrame(animationFrameId);
  window.removeEventListener('resize', resize);
}
