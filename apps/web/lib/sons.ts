'use client';
// Sons do Tostão, sintetizados na hora (Web Audio): nada de arquivo, nada de direito autoral.
// Curtos e baixinhos. A pessoa desliga no Perfil; seguem o volume de mídia do celular.

export type Som = 'toque' | 'moeda' | 'missao' | 'ofensiva' | 'festa' | 'erro';
const KEY = 'tostao-sons';

export function sonsLigados() {
  try { return localStorage.getItem(KEY) !== '0'; } catch { return true; }
}
export function setSons(on: boolean) {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* modo anônimo */ }
}

let ctx: AudioContext | null = null;
function audio() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  return ctx;
}

/** Uma nota: frequência, começo (s), duração (s), volume, forma da onda. */
function nota(ac: AudioContext, f: number, t0: number, dur: number, vol = 0.12, tipo: OscillatorType = 'triangle', glide?: number) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(f, ac.currentTime + t0);
  if (glide) o.frequency.exponentialRampToValueAtTime(glide, ac.currentTime + t0 + dur);
  g.gain.setValueAtTime(0.0001, ac.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(vol, ac.currentTime + t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t0 + dur);
  o.connect(g).connect(ac.destination);
  o.start(ac.currentTime + t0);
  o.stop(ac.currentTime + t0 + dur + 0.02);
}

export function tocar(som: Som) {
  if (!sonsLigados()) return;
  const ac = audio();
  if (!ac) return;
  try {
    switch (som) {
      case 'toque': nota(ac, 520, 0, 0.05, 0.05, 'sine', 380); break;
      case 'moeda': nota(ac, 988, 0, 0.08, 0.1, 'square'); nota(ac, 1319, 0.07, 0.22, 0.08, 'square'); break;
      case 'missao': [659, 784, 1047].forEach((f, i) => nota(ac, f, i * 0.08, 0.18, 0.1)); break;
      case 'ofensiva': nota(ac, 220, 0, 0.35, 0.06, 'sawtooth', 660); [784, 1047, 1319].forEach((f, i) => nota(ac, f, 0.18 + i * 0.09, 0.22, 0.1)); break;
      case 'festa': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => nota(ac, f, i * 0.09, i === 5 ? 0.45 : 0.14, 0.1)); break;
      case 'erro': nota(ac, 330, 0, 0.12, 0.08, 'square', 247); nota(ac, 247, 0.12, 0.2, 0.07, 'square', 196); break;
    }
  } catch { /* áudio indisponível: segue sem som */ }
}
