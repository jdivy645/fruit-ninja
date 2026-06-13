let audioCtx = null;
let enabled = true;

export function initAudio() {
  if (audioCtx) return;
  // Create audio context
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (AudioContextClass) {
    audioCtx = new AudioContextClass();
  }
}

export function toggleAudio() {
  enabled = !enabled;
  if (enabled && audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return enabled;
}

export function isAudioEnabled() {
  return enabled;
}

function getCtx() {
  initAudio();
  if (!enabled || !audioCtx) return null;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Helper to create a noise buffer
let noiseBuffer = null;
function getNoiseBuffer(ctx) {
  if (noiseBuffer) return noiseBuffer;
  const bufferSize = ctx.sampleRate * 2; // 2 seconds of noise
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBuffer = buffer;
  return noiseBuffer;
}

// 1. Swipe Sound: Synthesised woosh
export function playSwipe() {
  const ctx = getCtx();
  if (!ctx) return;

  const now = ctx.currentTime;
  
  // Create noise source
  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);

  // Bandpass filter to sweep the frequency of the woosh
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 3.5;
  filter.frequency.setValueAtTime(800, now);
  filter.frequency.exponentialRampToValueAtTime(180, now + 0.18);

  // Gain node for volume envelope
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.24, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + 0.2);
}

// 2. Slice Sound: Crisp squelch / cut
export function playSlice() {
  const ctx = getCtx();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Sound Component A: A sharp high-passed noise transient
  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);

  const hpFilter = ctx.createBiquadFilter();
  hpFilter.type = 'highpass';
  hpFilter.frequency.setValueAtTime(1800, now);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.25, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  noise.connect(hpFilter);
  hpFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);

  // Sound Component B: Modulated oscillator for splat feel
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.14);

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.4, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

  osc.connect(oscGain);
  oscGain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + 0.1);
  osc.start(now);
  osc.stop(now + 0.15);
}

// 3. Combo Sound: Rewarding arpeggio
export function playCombo(count) {
  const ctx = getCtx();
  if (!ctx) return;

  const now = ctx.currentTime;
  const baseFreqs = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99]; // C major notes: C4, E4, G4, C5, E5, G5
  const notesCount = Math.min(count, 5);

  for (let i = 0; i < notesCount; i++) {
    const delay = i * 0.07;
    const noteTime = now + delay;
    const freq = baseFreqs[Math.min(i, baseFreqs.length - 1)];

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, noteTime);

    // Subtle pitch modulation
    osc.frequency.linearRampToValueAtTime(freq * 1.05, noteTime + 0.15);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, noteTime);
    gain.gain.linearRampToValueAtTime(0.18, noteTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.28);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1500, noteTime);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(noteTime);
    osc.stop(noteTime + 0.35);
  }
}

// 4. Bomb Explosion: Low bass rumble + crackle
export function playExplosion() {
  const ctx = getCtx();
  if (!ctx) return;

  const now = ctx.currentTime;

  // 1. Sub Bass Drop
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(150, now);
  sub.frequency.exponentialRampToValueAtTime(28, now + 0.85);

  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.85, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

  sub.connect(subGain);
  subGain.connect(ctx.destination);

  // 2. White Noise Blast
  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);

  const lpFilter = ctx.createBiquadFilter();
  lpFilter.type = 'lowpass';
  lpFilter.frequency.setValueAtTime(600, now);
  lpFilter.frequency.exponentialRampToValueAtTime(60, now + 0.75);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.7, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

  noise.connect(lpFilter);
  lpFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);

  sub.start(now);
  sub.stop(now + 0.9);
  noise.start(now);
  noise.stop(now + 0.85);
}

// 5. Powerup Activation Sound
export function playPowerup(type) {
  const ctx = getCtx();
  if (!ctx) return;

  const now = ctx.currentTime;

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  
  if (type === 'freeze') {
    // Frosty synth sound: dual chime-like sine waves
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc1.frequency.linearRampToValueAtTime(1046.50, now + 0.5); // C6

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now); // E5
    osc2.frequency.linearRampToValueAtTime(1318.51, now + 0.5); // E6
  } else {
    // Frenzy: ascending, exciting saw sound
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(220, now); // A3
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.55); // A5

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(277.18, now); // C#4
    osc2.frequency.exponentialRampToValueAtTime(1108.73, now + 0.55); // C#6
  }

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.2, now + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(800, now);
  filter.frequency.linearRampToValueAtTime(2500, now + 0.5);

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.6);
  osc2.stop(now + 0.6);
}

// 6. Game Over: Sad descending minor scale
export function playGameOver() {
  const ctx = getCtx();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [311.13, 277.18, 233.08, 196.00]; // Eb4, Db4, Bb3, G3 (Sad mood)

  notes.forEach((freq, idx) => {
    const noteTime = now + idx * 0.22;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, noteTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, noteTime);
    gain.gain.linearRampToValueAtTime(0.14, noteTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.35);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, noteTime);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(noteTime);
    osc.stop(noteTime + 0.4);
  });
}
