// Web Audio API & Speech Synthesis Engine for Orbit Family 360

let audioCtx: AudioContext | null = null;
let sirenOscillator: OscillatorNode | null = null;
let sirenGain: GainNode | null = null;
let sirenInterval: NodeJS.Timeout | null = null;

export function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Early audio unlocker on user gesture
 */
export function unlockAudioContext(): void {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  } catch (err) {
    console.warn('Unlock audio context error:', err);
  }
}

/**
 * Start loud emergency SOS siren
 */
export function startEmergencySiren() {
  try {
    const ctx = getAudioContext();
    if (sirenOscillator) {
      stopEmergencySiren();
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(650, ctx.currentTime);

    // Initial siren sweep
    gain.gain.setValueAtTime(0.8, ctx.currentTime);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();

    sirenOscillator = osc;
    sirenGain = gain;

    let high = true;
    sirenInterval = setInterval(() => {
      if (!sirenOscillator || !audioCtx) return;
      const targetFreq = high ? 1150 : 650;
      sirenOscillator.frequency.setTargetAtTime(targetFreq, audioCtx.currentTime, 0.12);
      high = !high;
    }, 350);
  } catch (err) {
    console.warn('Unable to play emergency siren:', err);
  }
}

/**
 * Stop emergency siren
 */
export function stopEmergencySiren() {
  if (sirenInterval) {
    clearInterval(sirenInterval);
    sirenInterval = null;
  }
  if (sirenOscillator) {
    try {
      sirenOscillator.stop();
      sirenOscillator.disconnect();
    } catch {
      // ignore
    }
    sirenOscillator = null;
  }
  if (sirenGain) {
    try {
      sirenGain.disconnect();
    } catch {
      // ignore
    }
    sirenGain = null;
  }
}

/**
 * Play a pleasant chime for geofence arrival or safe check-in
 */
export function playGeofenceChime(isArrival = true) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const baseFreq = isArrival ? 587.33 : 440; // D5 or A4
    const nextFreq = isArrival ? 880 : 392; // A5 or G4

    osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
    osc.frequency.setValueAtTime(nextFreq, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch (err) {
    console.warn('Audio chime unavailable:', err);
  }
}

/**
 * Play incoming chat message notification sound
 */
export function playChatMessageSound() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
    osc.frequency.setValueAtTime(880.0, ctx.currentTime + 0.1); // A5

    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);

    if ('vibrate' in navigator) {
      navigator.vibrate([150, 80, 150]);
    }
  } catch (err) {
    console.warn('Chat message sound unavailable:', err);
  }
}

/**
 * Play warning beep for speeding
 */
export function playSpeedWarningBeep() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(850, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (err) {
    console.warn('Speed warning beep unavailable:', err);
  }
}

/**
 * Speak text out loud using native Web SpeechSynthesis
 */
export function speakVoiceAlert(text: string, priority = false): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      console.log('[TTS not supported]:', text);
      return resolve();
    }

    if (priority) {
      window.speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.05;
    utterance.volume = 1.0;

    // Pick a natural English voice if available
    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(
      (v) =>
        v.lang.startsWith('en') &&
        (v.name.includes('Natural') ||
          v.name.includes('Google') ||
          v.name.includes('Samantha') ||
          v.name.includes('Siri'))
    );
    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();

    window.speechSynthesis.speak(utterance);
  });
}

// Lost Phone Piercing Siren state
let lostAlarmOsc1: OscillatorNode | null = null;
let lostAlarmOsc2: OscillatorNode | null = null;
let lostAlarmGain: GainNode | null = null;
let lostAlarmTimer: NodeJS.Timeout | null = null;
let lostVoiceTimer: NodeJS.Timeout | null = null;
let lostAudioElement: HTMLAudioElement | null = null;

/**
 * Generate a loud synthesized 16-bit PCM WAV siren audio data URI
 * to guarantee audible playback across all mobile and desktop web browsers
 */
function createSirenAudioElement(): HTMLAudioElement {
  const audio = new Audio();
  try {
    const sampleRate = 22050;
    const duration = 1.0;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };

    // Standard RIFF/WAVE header (44 bytes)
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, numSamples * 2, true);

    // Alternating high pitch piercing square wave at absolute maximum amplitude (32000)
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const freq = t % 0.25 < 0.125 ? 1500 : 950;
      const sample = Math.sin(2 * Math.PI * freq * t) >= 0 ? 32000 : -32000;
      view.setInt16(44 + i * 2, sample, true);
    }

    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    audio.src = 'data:audio/wav;base64,' + btoa(binary);
  } catch (e) {
    console.warn('WAV generation error:', e);
  }

  audio.loop = true;
  audio.volume = 1.0;
  return audio;
}

/**
 * Start maximum-volume piercing alarm designed to locate lost or misplaced phone
 * Operates at absolute peak gain, triggers dual oscillators, audio elements, and hardware vibration
 */
export function startLostPhonePiercingAlarm(targetMemberName = 'This device') {
  try {
    const ctx = getAudioContext();
    if (lostAlarmOsc1) {
      stopLostPhonePiercingAlarm();
    }

    // Force resume audio context
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // Hardware vibration at full cycle
    if ('vibrate' in navigator) {
      navigator.vibrate([1000, 200, 1000, 200, 1500, 300, 1000]);
    }

    // Dual-tone high pitch piercing acoustic siren with booster gain
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'square';

    osc1.frequency.setValueAtTime(950, ctx.currentTime);
    osc2.frequency.setValueAtTime(1450, ctx.currentTime);

    // Peak volume booster (1.4 max)
    gain.gain.setValueAtTime(1.2, ctx.currentTime);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();

    lostAlarmOsc1 = osc1;
    lostAlarmOsc2 = osc2;
    lostAlarmGain = gain;

    let toggle = true;
    lostAlarmTimer = setInterval(() => {
      if (!lostAlarmOsc1 || !lostAlarmOsc2 || !audioCtx) return;
      const f1 = toggle ? 1450 : 880;
      const f2 = toggle ? 1750 : 1150;
      lostAlarmOsc1.frequency.setTargetAtTime(f1, audioCtx.currentTime, 0.06);
      lostAlarmOsc2.frequency.setTargetAtTime(f2, audioCtx.currentTime, 0.06);
      toggle = !toggle;

      // Repeat vibration every cycle
      if ('vibrate' in navigator) {
        navigator.vibrate([600, 150, 600]);
      }
    }, 240);

    // Try HTML5 audio playback fallback as well
    try {
      if (!lostAudioElement) {
        lostAudioElement = createSirenAudioElement();
      }
      lostAudioElement.currentTime = 0;
      const playPromise = lostAudioElement.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // If browser blocked autoplay without user gesture, attach immediate touch / interaction listener
          const unlockHandler = () => {
            unlockAudioContext();
            lostAudioElement?.play().catch(() => {});
            window.removeEventListener('pointerdown', unlockHandler);
            window.removeEventListener('touchstart', unlockHandler);
            window.removeEventListener('click', unlockHandler);
          };
          window.addEventListener('pointerdown', unlockHandler, { once: true });
          window.addEventListener('touchstart', unlockHandler, { once: true });
          window.addEventListener('click', unlockHandler, { once: true });
        });
      }
    } catch {
      // ignore
    }

    // Urgent repeated speech alert at volume 1.0
    speakVoiceAlert(
      `Attention! Lost phone alarm triggered for ${targetMemberName}! I am here! Check this device!`,
      true
    );

    lostVoiceTimer = setInterval(() => {
      speakVoiceAlert(`Lost phone alarm! Check this device!`, false);
    }, 6000);
  } catch (err) {
    console.warn('Lost phone piercing alarm could not start:', err);
  }
}

/**
 * Stop lost phone piercing alarm
 */
export function stopLostPhonePiercingAlarm() {
  if (lostAlarmTimer) {
    clearInterval(lostAlarmTimer);
    lostAlarmTimer = null;
  }
  if (lostVoiceTimer) {
    clearInterval(lostVoiceTimer);
    lostVoiceTimer = null;
  }

  if (lostAudioElement) {
    try {
      lostAudioElement.pause();
      lostAudioElement.currentTime = 0;
    } catch {}
    lostAudioElement = null;
  }

  if (lostAlarmOsc1) {
    try {
      lostAlarmOsc1.stop();
      lostAlarmOsc1.disconnect();
    } catch {}
    lostAlarmOsc1 = null;
  }
  if (lostAlarmOsc2) {
    try {
      lostAlarmOsc2.stop();
      lostAlarmOsc2.disconnect();
    } catch {}
    lostAlarmOsc2 = null;
  }
  if (lostAlarmGain) {
    try {
      lostAlarmGain.disconnect();
    } catch {}
    lostAlarmGain = null;
  }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  if ('vibrate' in navigator) {
    navigator.vibrate(0);
  }
}
