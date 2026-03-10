import type { CarSpec } from '../types';

interface EngineToneProfile {
  id: string;
  lowWave: OscillatorType;
  midWave: OscillatorType;
  topWave: OscillatorType;
  idleHz: number;
  revRangeHz: number;
  filterBaseHz: number;
  filterSweepHz: number;
  filterQ: number;
  baseGain: number;
  loadGain: number;
  redlineRef: number;
  shiftSweepHz: number;
  shiftClunkHz: number;
}

const DEFAULT_PROFILE: EngineToneProfile = {
  id: 'default',
  lowWave: 'sawtooth',
  midWave: 'triangle',
  topWave: 'square',
  idleHz: 46,
  revRangeHz: 172,
  filterBaseHz: 720,
  filterSweepHz: 900,
  filterQ: 1.2,
  baseGain: 0.028,
  loadGain: 0.084,
  redlineRef: 8000,
  shiftSweepHz: 860,
  shiftClunkHz: 220,
};

let audioCtx: AudioContext | null = null;
let oscLow: OscillatorNode | null = null;
let oscMid: OscillatorNode | null = null;
let oscTop: OscillatorNode | null = null;
let gainLow: GainNode | null = null;
let gainMid: GainNode | null = null;
let gainTop: GainNode | null = null;
let filterNode: BiquadFilterNode | null = null;
let masterGain: GainNode | null = null;

let activeProfile: EngineToneProfile = DEFAULT_PROFILE;
let shiftDipUntil = 0;
let shiftRecoveryUntil = 0;
let noiseBuffer: AudioBuffer | null = null;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hashSpriteKey(key: string): number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickWave(index: number): OscillatorType {
  const waves: OscillatorType[] = ['sawtooth', 'triangle', 'square', 'sine'];
  return waves[index % waves.length];
}

function buildProfile(car?: CarSpec): EngineToneProfile {
  if (!car) {
    return DEFAULT_PROFILE;
  }

  const hash = hashSpriteKey(car.spriteKey);
  const torqueNorm = clamp((car.baseTorque - 1400) / 1200, 0, 1);
  const revNorm = clamp((car.redlineRpm - 6400) / 2800, 0, 1);
  const tractionNorm = clamp((car.tractionBias - 1) / 0.28, 0, 1);
  const dragNorm = clamp((car.dragCoef - 0.28) / 0.1, 0, 1);

  const idleHz = 42 + torqueNorm * 18 + (hash % 7) * 0.65;
  const revRangeHz = 128 + revNorm * 122 + (hash % 11) * 2.1;
  const filterBaseHz = 540 + torqueNorm * 220 + revNorm * 260;
  const filterSweepHz = 620 + revNorm * 1100 + dragNorm * 80;

  return {
    id: car.id,
    lowWave: pickWave(hash + Math.round(torqueNorm * 3)),
    midWave: pickWave((hash >> 3) + Math.round(revNorm * 5)),
    topWave: pickWave((hash >> 5) + Math.round(tractionNorm * 7)),
    idleHz,
    revRangeHz,
    filterBaseHz,
    filterSweepHz,
    filterQ: 1 + tractionNorm * 0.9 + revNorm * 0.5,
    baseGain: 0.022 + torqueNorm * 0.014,
    loadGain: 0.068 + revNorm * 0.05 + tractionNorm * 0.014,
    redlineRef: car.redlineRpm,
    shiftSweepHz: 620 + revNorm * 420 + (hash % 40),
    shiftClunkHz: 124 + torqueNorm * 124,
  };
}

function applyProfileToNodes(): void {
  if (!oscLow || !oscMid || !oscTop || !filterNode || !audioCtx) {
    return;
  }

  oscLow.type = activeProfile.lowWave;
  oscMid.type = activeProfile.midWave;
  oscTop.type = activeProfile.topWave;
  filterNode.type = 'lowpass';
  filterNode.frequency.setValueAtTime(activeProfile.filterBaseHz, audioCtx.currentTime);
  filterNode.Q.setValueAtTime(activeProfile.filterQ, audioCtx.currentTime);
}

function getNoiseBuffer(): AudioBuffer | null {
  if (!audioCtx) {
    return null;
  }
  if (noiseBuffer) {
    return noiseBuffer;
  }

  const length = audioCtx.sampleRate;
  const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBuffer = buffer;
  return buffer;
}

function playNoiseBurst(params: {
  when: number;
  duration: number;
  gainStart: number;
  gainEnd: number;
  filterType: BiquadFilterType;
  filterFrequency: number;
  q?: number;
}): void {
  if (!audioCtx) {
    return;
  }
  const buffer = getNoiseBuffer();
  if (!buffer) {
    return;
  }

  const noise = audioCtx.createBufferSource();
  const filter = audioCtx.createBiquadFilter();
  const gain = audioCtx.createGain();
  noise.buffer = buffer;
  filter.type = params.filterType;
  filter.frequency.setValueAtTime(params.filterFrequency, params.when);
  filter.Q.setValueAtTime(params.q ?? 1, params.when);
  gain.gain.setValueAtTime(params.gainStart, params.when);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, params.gainEnd), params.when + params.duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  noise.start(params.when);
  noise.stop(params.when + params.duration);
}

function ensureAudioGraph(): boolean {
  if (!audioCtx) {
    const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioCtor();
  }

  if (!oscLow || !oscMid || !oscTop || !gainLow || !gainMid || !gainTop || !filterNode || !masterGain) {
    oscLow = audioCtx.createOscillator();
    oscMid = audioCtx.createOscillator();
    oscTop = audioCtx.createOscillator();
    gainLow = audioCtx.createGain();
    gainMid = audioCtx.createGain();
    gainTop = audioCtx.createGain();
    filterNode = audioCtx.createBiquadFilter();
    masterGain = audioCtx.createGain();

    gainLow.gain.value = 0;
    gainMid.gain.value = 0;
    gainTop.gain.value = 0;
    masterGain.gain.value = 0;

    oscLow.connect(gainLow);
    oscMid.connect(gainMid);
    oscTop.connect(gainTop);
    gainLow.connect(filterNode);
    gainMid.connect(filterNode);
    gainTop.connect(filterNode);
    filterNode.connect(masterGain);
    masterGain.connect(audioCtx.destination);

    applyProfileToNodes();

    oscLow.frequency.value = activeProfile.idleHz * 0.48;
    oscMid.frequency.value = activeProfile.idleHz;
    oscTop.frequency.value = activeProfile.idleHz * 1.7;

    oscLow.start();
    oscMid.start();
    oscTop.start();
  }

  return true;
}

export function initEngineSound(car?: CarSpec): void {
  activeProfile = buildProfile(car);
  if (!ensureAudioGraph()) {
    return;
  }
  applyProfileToNodes();
}

export function updateEngineSound(rpm: number, isRacing: boolean, gear = 1, speedMps = 0): void {
  if (!audioCtx || !oscLow || !oscMid || !oscTop || !gainLow || !gainMid || !gainTop || !filterNode || !masterGain) {
    return;
  }

  const now = audioCtx.currentTime;
  if (!isRacing) {
    gainLow.gain.setTargetAtTime(0, now, 0.08);
    gainMid.gain.setTargetAtTime(0, now, 0.08);
    gainTop.gain.setTargetAtTime(0, now, 0.08);
    masterGain.gain.setTargetAtTime(0, now, 0.12);
    return;
  }

  const rpmNorm = clamp(rpm / Math.max(4500, activeProfile.redlineRef), 0, 1.15);
  const speedNorm = clamp(speedMps / 96, 0, 1);
  const gearNorm = clamp((gear - 1) / 5, 0, 1);

  let harmonicBase = activeProfile.idleHz + rpmNorm * activeProfile.revRangeHz;
  if (now < shiftDipUntil) {
    harmonicBase *= 0.72;
  } else if (now < shiftRecoveryUntil) {
    harmonicBase *= 1.06;
  }

  const lowHz = harmonicBase * (0.44 + gearNorm * 0.08);
  const midHz = harmonicBase * (0.98 + gearNorm * 0.06);
  const topHz = harmonicBase * (1.62 + speedNorm * 0.24);

  oscLow.frequency.setTargetAtTime(lowHz, now, 0.045);
  oscMid.frequency.setTargetAtTime(midHz, now, 0.04);
  oscTop.frequency.setTargetAtTime(topHz, now, 0.03);

  const loudness = activeProfile.baseGain + rpmNorm * activeProfile.loadGain;
  const lowGainTarget = loudness * (0.84 + 0.12 * (1 - speedNorm));
  const midGainTarget = loudness * (0.62 + 0.26 * speedNorm);
  const topGainTarget = loudness * (0.2 + 0.48 * rpmNorm);

  gainLow.gain.setTargetAtTime(lowGainTarget, now, 0.06);
  gainMid.gain.setTargetAtTime(midGainTarget, now, 0.06);
  gainTop.gain.setTargetAtTime(topGainTarget, now, 0.05);

  const filterCutoff = activeProfile.filterBaseHz + rpmNorm * activeProfile.filterSweepHz + speedNorm * 200;
  filterNode.frequency.setTargetAtTime(filterCutoff, now, 0.05);
  filterNode.Q.setTargetAtTime(activeProfile.filterQ + rpmNorm * 0.38, now, 0.07);

  const masterTarget = clamp(0.07 + rpmNorm * 0.1 + speedNorm * 0.04, 0.06, 0.22);
  masterGain.gain.setTargetAtTime(masterTarget, now, 0.07);
}

export function stopEngineSound(): void {
  if (!audioCtx || !gainLow || !gainMid || !gainTop || !masterGain) {
    return;
  }
  const now = audioCtx.currentTime;
  gainLow.gain.setTargetAtTime(0, now, 0.08);
  gainMid.gain.setTargetAtTime(0, now, 0.08);
  gainTop.gain.setTargetAtTime(0, now, 0.08);
  masterGain.gain.setTargetAtTime(0, now, 0.1);
}

export function playLaunchSound(car?: CarSpec, isFalseStart = false): void {
  initEngineSound(car);
  if (!audioCtx) {
    return;
  }

  const now = audioCtx.currentTime;
  const torqueFactor = clamp((activeProfile.shiftClunkHz - 124) / 124, 0, 1);
  const launchSweep = audioCtx.createOscillator();
  const launchGain = audioCtx.createGain();
  const lowThump = audioCtx.createOscillator();
  const lowThumpGain = audioCtx.createGain();

  launchSweep.connect(launchGain);
  lowThump.connect(lowThumpGain);
  launchGain.connect(audioCtx.destination);
  lowThumpGain.connect(audioCtx.destination);

  launchSweep.type = isFalseStart ? 'square' : 'sawtooth';
  launchSweep.frequency.setValueAtTime(activeProfile.idleHz * (isFalseStart ? 1.3 : 1.05), now);
  launchSweep.frequency.exponentialRampToValueAtTime(activeProfile.idleHz * (isFalseStart ? 2.1 : 2.8), now + 0.19);
  launchGain.gain.setValueAtTime(isFalseStart ? 0.06 : 0.09 + torqueFactor * 0.04, now);
  launchGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

  lowThump.type = 'sine';
  lowThump.frequency.setValueAtTime(58 + torqueFactor * 20, now);
  lowThump.frequency.exponentialRampToValueAtTime(36, now + 0.22);
  lowThumpGain.gain.setValueAtTime(isFalseStart ? 0.02 : 0.045, now);
  lowThumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

  playNoiseBurst({
    when: now,
    duration: isFalseStart ? 0.08 : 0.13,
    gainStart: isFalseStart ? 0.03 : 0.09,
    gainEnd: 0.0001,
    filterType: 'bandpass',
    filterFrequency: isFalseStart ? 980 : 1450,
    q: 0.9,
  });

  launchSweep.start(now);
  lowThump.start(now);
  launchSweep.stop(now + 0.26);
  lowThump.stop(now + 0.28);

  shiftDipUntil = now + 0.13;
  shiftRecoveryUntil = now + 0.22;
}

export function playShiftSound(quality: 'perfect' | 'good' | 'miss', car?: CarSpec, gearAfterShift = 1): void {
  initEngineSound(car);
  if (!audioCtx) {
    return;
  }

  const now = audioCtx.currentTime;
  const gearFactor = clamp((gearAfterShift - 1) / 5, 0, 1);
  const baseSweep = activeProfile.shiftSweepHz * (1 + gearFactor * 0.08);
  const baseClunk = activeProfile.shiftClunkHz * (1 - gearFactor * 0.06);

  const chirp = audioCtx.createOscillator();
  const chirpGain = audioCtx.createGain();
  const clunk = audioCtx.createOscillator();
  const clunkGain = audioCtx.createGain();
  const ignitionCut = audioCtx.createOscillator();
  const ignitionGain = audioCtx.createGain();

  chirp.connect(chirpGain);
  clunk.connect(clunkGain);
  ignitionCut.connect(ignitionGain);
  chirpGain.connect(audioCtx.destination);
  clunkGain.connect(audioCtx.destination);
  ignitionGain.connect(audioCtx.destination);

  if (quality === 'perfect') {
    chirp.type = 'triangle';
    chirp.frequency.setValueAtTime(baseSweep, now);
    chirp.frequency.exponentialRampToValueAtTime(baseSweep * 1.34, now + 0.09);
    chirpGain.gain.setValueAtTime(0.16, now);
    chirpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    clunk.type = 'sine';
    clunk.frequency.setValueAtTime(baseClunk * 1.35, now);
    clunk.frequency.exponentialRampToValueAtTime(baseClunk * 0.7, now + 0.11);
    clunkGain.gain.setValueAtTime(0.07, now);
    clunkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    ignitionCut.type = 'sine';
    ignitionCut.frequency.setValueAtTime(baseClunk * 2.5, now);
    ignitionCut.frequency.exponentialRampToValueAtTime(baseClunk * 1.3, now + 0.08);
    ignitionGain.gain.setValueAtTime(0.025, now);
    ignitionGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    playNoiseBurst({
      when: now + 0.006,
      duration: 0.065,
      gainStart: 0.04,
      gainEnd: 0.0001,
      filterType: 'highpass',
      filterFrequency: 1700,
      q: 0.8,
    });

    shiftDipUntil = now + 0.09;
    shiftRecoveryUntil = now + 0.18;
  } else if (quality === 'good') {
    chirp.type = 'square';
    chirp.frequency.setValueAtTime(baseSweep * 0.86, now);
    chirp.frequency.exponentialRampToValueAtTime(baseSweep * 1.05, now + 0.08);
    chirpGain.gain.setValueAtTime(0.1, now);
    chirpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    clunk.type = 'triangle';
    clunk.frequency.setValueAtTime(baseClunk * 1.1, now);
    clunk.frequency.exponentialRampToValueAtTime(baseClunk * 0.74, now + 0.11);
    clunkGain.gain.setValueAtTime(0.08, now);
    clunkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    ignitionCut.type = 'triangle';
    ignitionCut.frequency.setValueAtTime(baseClunk * 2.1, now);
    ignitionCut.frequency.exponentialRampToValueAtTime(baseClunk * 1.2, now + 0.1);
    ignitionGain.gain.setValueAtTime(0.02, now);
    ignitionGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

    playNoiseBurst({
      when: now + 0.01,
      duration: 0.08,
      gainStart: 0.03,
      gainEnd: 0.0001,
      filterType: 'bandpass',
      filterFrequency: 1200,
      q: 0.7,
    });

    shiftDipUntil = now + 0.1;
    shiftRecoveryUntil = now + 0.16;
  } else {
    chirp.type = 'sawtooth';
    chirp.frequency.setValueAtTime(baseSweep * 0.58, now);
    chirp.frequency.linearRampToValueAtTime(baseSweep * 0.38, now + 0.16);
    chirpGain.gain.setValueAtTime(0.12, now);
    chirpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    clunk.type = 'square';
    clunk.frequency.setValueAtTime(baseClunk * 0.94, now);
    clunk.frequency.linearRampToValueAtTime(baseClunk * 0.55, now + 0.17);
    clunkGain.gain.setValueAtTime(0.11, now);
    clunkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    ignitionCut.type = 'square';
    ignitionCut.frequency.setValueAtTime(baseClunk * 1.5, now);
    ignitionCut.frequency.exponentialRampToValueAtTime(baseClunk * 0.88, now + 0.15);
    ignitionGain.gain.setValueAtTime(0.03, now);
    ignitionGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    playNoiseBurst({
      when: now + 0.005,
      duration: 0.11,
      gainStart: 0.05,
      gainEnd: 0.0001,
      filterType: 'lowpass',
      filterFrequency: 900,
      q: 1.1,
    });

    shiftDipUntil = now + 0.14;
    shiftRecoveryUntil = now + 0.24;
  }

  chirp.start(now);
  clunk.start(now);
  ignitionCut.start(now);
  chirp.stop(now + 0.24);
  clunk.stop(now + 0.26);
  ignitionCut.stop(now + 0.2);
}
