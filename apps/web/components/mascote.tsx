// Tostão, Caramelo, and villain character poses. Assets live in public/elenco.
export type MascotPose =
  | 'acenando'
  | 'avatar'
  | 'chocado'
  | 'comemorando'
  | 'conectando'
  | 'dormindo'
  | 'investigando'
  | 'orgulhoso'
  | 'pensando'
  | 'preocupado'
  | 'professor'
  | 'sem-graca'
  | 'triste'
  | 'caramelo'
  | 'caramelo-acenando'
  | 'caramelo-bravo'
  | 'caramelo-dormindo'
  | 'caramelo-farejando'
  | 'caramelo-feliz'
  | 'caramelo-moeda'
  | 'tigrinho'
  | 'urubu'
  | 'urubu-pix'
  | 'urubu-fugindo'
  | 'dupla';

const CELEBRATION_POSES: MascotPose[] = ['comemorando', 'orgulhoso', 'caramelo-feliz', 'dupla'];

/** By default the character gently breathes. Set `still` for static avatars. */
export function Mascot({
  pose,
  size = 120,
  alt = '',
  className = '',
  still = false,
  eager = false,
}: {
  pose: MascotPose;
  size?: number;
  alt?: string;
  className?: string;
  still?: boolean;
  /** Acima da dobra (ex.: herói): carrega já. O padrão é preguiçoso, pra não competir com o conteúdo principal. */
  eager?: boolean;
}) {
  const motionClass = still || size < 48 ? '' : CELEBRATION_POSES.includes(pose) ? 'mascote-pula' : 'mascote';
  return (
    <img
      src={`/elenco/${pose}.webp`}
      alt={alt}
      width={size}
      height={size}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={`shrink-0 select-none ${motionClass} ${className}`}
      draggable={false}
    />
  );
}
