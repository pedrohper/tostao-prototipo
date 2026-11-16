// One-shot CSS confetti burst (goal reached, lesson completed). Disabled under prefers-reduced-motion.
import { SoundOnMount } from './sons';

const CONFETTI_COLORS = [
  'var(--color-laranja)',
  'var(--color-amarelo)',
  'var(--color-menta)',
  'var(--color-azul)',
  'var(--color-rosa)',
];

export function Confetti({ count = 28, n }: { count?: number; n?: number }) {
  const total = n ?? count;
  return (
    <div className="confete" aria-hidden="true">
      <SoundOnMount som="festa" />
      {Array.from({ length: total }, (_, i) => {
        // Deterministic positions so server and client render identically.
        const left = (i * 37) % 100;
        const dx = ((i * 53) % 120) - 60;
        const rot = ((i * 97) % 720) - 360;
        return (
          <i
            key={i}
            style={{
              left: `${left}%`,
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              animationDelay: `${(i % 7) * 0.06}s`,
              ['--dx' as string]: `${dx}px`,
              ['--rot' as string]: `${rot}deg`,
            }}
          />
        );
      })}
    </div>
  );
}
