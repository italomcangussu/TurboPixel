// Super simple synthesized rev engine using Web Audio API instead of assets to keep it lightweight for now
let audioCtx: AudioContext | null = null;
let oscillator: OscillatorNode | null = null;
let gainNode: GainNode | null = null;

export function initEngineSound() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    oscillator = audioCtx.createOscillator();
    gainNode = audioCtx.createGain();

    oscillator.type = 'sawtooth';
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.frequency.value = 50; // base frequency
    gainNode.gain.value = 0; // start muted
    
    oscillator.start();
  }
}

export function updateEngineSound(rpm: number, isRacing: boolean) {
  if (!audioCtx || !oscillator || !gainNode) return;
  
  if (!isRacing) {
    gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1);
    return;
  }

  // Map RPM roughly to frequency
  const targetFreq = 50 + (rpm / 8000) * 150;
  oscillator.frequency.setTargetAtTime(targetFreq, audioCtx.currentTime, 0.05);
  
  // Quick volume ramp
  gainNode.gain.setTargetAtTime(0.1, audioCtx.currentTime, 0.1);
}

export function stopEngineSound() {
  if (gainNode && audioCtx) {
     gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1);
  }
}

export function playShiftSound(quality: 'perfect' | 'good' | 'miss') {
    if (!audioCtx) return;
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    if (quality === 'perfect') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
    } else if (quality === 'good') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(500, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
    } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    }
}
