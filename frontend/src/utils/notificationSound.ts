// Notification sounds using Web Audio API — no external dependencies needed

let audioCtx: AudioContext | null = null;
let receivedAudio: HTMLAudioElement | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(frequencies: number[], durations: number[], volume = 0.15, type: OscillatorType = 'sine') {
  try {
    const ctx = getAudioContext();
    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.gain.setValueAtTime(volume, ctx.currentTime);

    let offset = 0;
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + offset);
      osc.connect(noteGain);
      noteGain.connect(masterGain);

      const dur = durations[i] || 0.15;
      // Fade in
      noteGain.gain.setValueAtTime(0, ctx.currentTime + offset);
      noteGain.gain.linearRampToValueAtTime(1, ctx.currentTime + offset + 0.02);
      // Fade out
      noteGain.gain.setValueAtTime(1, ctx.currentTime + offset + dur - 0.04);
      noteGain.gain.linearRampToValueAtTime(0, ctx.currentTime + offset + dur);

      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + dur);

      offset += dur;
    });

    // Cleanup master gain
    masterGain.gain.setValueAtTime(volume, ctx.currentTime + offset);
    masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + offset + 0.05);
  } catch (e) {
    console.log('Sound play failed:', e);
  }
}

/**
 * Received notification tone.
 * Uses a bundled mp3 (public/sounds/iphone_notification.mp3). If autoplay is blocked,
 * falls back to a short WebAudio chime.
 */
export function playNotificationReceived() {
  try {
    if (!receivedAudio) {
      receivedAudio = new Audio('/sounds/iphone_notification.mp3');
      receivedAudio.preload = 'auto';
    }
    receivedAudio.currentTime = 0;
    const p = receivedAudio.play();
    // If browser blocks autoplay, play() rejects — use fallback.
    if (p && typeof (p as Promise<void>).catch === 'function') {
      (p as Promise<void>).catch(() => playTone([880, 1109], [0.09, 0.16], 0.12, 'sine'));
    }
  } catch {
    playTone([880, 1109], [0.09, 0.16], 0.12, 'sine');
  }
}

/**
 * Soft single pop for sent messages/notifications
 * (like iMessage send sound)
 */
export function playNotificationSent() {
  // Quick soft pop at G5
  playTone([784], [0.1], 0.1, 'sine');
}

/**
 * Gentle triple-chime for important/urgent notifications
 */
export function playNotificationUrgent() {
  // E6 → G6 → B6 — ascending triad
  playTone([1319, 1568, 1976], [0.1, 0.1, 0.2], 0.15, 'sine');
}
