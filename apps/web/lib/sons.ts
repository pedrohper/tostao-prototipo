'use client';
// Synthesized Web Audio sound effects (no external audio files or copyright issues).
// Short and subtle; users can toggle them in Profile and they respect device media volume.

export type SoundEffect = 'toque' | 'moeda' | 'missao' | 'ofensiva' | 'festa' | 'erro';

const STORAGE_KEY = 'tostao-sons';

export function areSoundsEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

const SOUND_CHANGE_EVENT = 'tostao-sons-change';

export function subscribeSounds(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(SOUND_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(SOUND_CHANGE_EVENT, onStoreChange);
  };
}

export function setSoundsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
    window.dispatchEvent(new Event(SOUND_CHANGE_EVENT));
  } catch {
    // Ignore storage errors in private browsing
  }
}

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  sharedAudioCtx ??= new AudioCtx();
  if (sharedAudioCtx.state === 'suspended') void sharedAudioCtx.resume().catch(() => {});
  return sharedAudioCtx;
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startOffsetSec: number,
  durationSec: number,
  volume = 0.12,
  waveform: OscillatorType = 'triangle',
  glideToFreq?: number,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = waveform;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffsetSec);
  if (glideToFreq) osc.frequency.exponentialRampToValueAtTime(glideToFreq, ctx.currentTime + startOffsetSec + durationSec);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime + startOffsetSec);
  gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + startOffsetSec + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startOffsetSec + durationSec);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime + startOffsetSec);
  osc.stop(ctx.currentTime + startOffsetSec + durationSec + 0.02);
}

export function playSound(effect: SoundEffect): void {
  if (!areSoundsEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    switch (effect) {
      case 'toque':
        playTone(ctx, 520, 0, 0.05, 0.05, 'sine', 380);
        break;
      case 'moeda':
        playTone(ctx, 988, 0, 0.08, 0.1, 'square');
        playTone(ctx, 1319, 0.07, 0.22, 0.08, 'square');
        break;
      case 'missao':
        [659, 784, 1047].forEach((f, i) => playTone(ctx, f, i * 0.08, 0.18, 0.1));
        break;
      case 'ofensiva':
        playTone(ctx, 220, 0, 0.35, 0.06, 'sawtooth', 660);
        [784, 1047, 1319].forEach((f, i) => playTone(ctx, f, 0.18 + i * 0.09, 0.22, 0.1));
        break;
      case 'festa':
        [523, 659, 784, 1047, 784, 1047].forEach((f, i) => playTone(ctx, f, i * 0.09, i === 5 ? 0.45 : 0.14, 0.1));
        break;
      case 'erro':
        playTone(ctx, 330, 0, 0.12, 0.08, 'square', 247);
        playTone(ctx, 247, 0.12, 0.2, 0.07, 'square', 196);
        break;
    }
  } catch {
    // Audio unavailable; fail silently
  }
}

