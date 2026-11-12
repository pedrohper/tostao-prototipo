// Poses do Tostão, Caramelo e vilões. Arquivos em public/elenco.
export type Pose =
  | 'acenando' | 'avatar' | 'chocado' | 'comemorando' | 'conectando' | 'dormindo' | 'investigando'
  | 'orgulhoso' | 'pensando' | 'preocupado' | 'professor' | 'sem-graca' | 'triste'
  | 'caramelo' | 'caramelo-acenando' | 'caramelo-bravo' | 'caramelo-dormindo' | 'caramelo-farejando' | 'caramelo-feliz' | 'caramelo-moeda'
  | 'tigrinho' | 'urubu' | 'urubu-pix' | 'urubu-fugindo';

const FESTA: Pose[] = ['comemorando', 'orgulhoso', 'caramelo-feliz'];

/** Por padrão o personagem "respira" (bem leve). still = parado (ex.: avatar pequeno). */
export function Mascote({ pose, size = 120, alt = '', className = '', still = false }: { pose: Pose; size?: number; alt?: string; className?: string; still?: boolean }) {
  const motion = still || size < 48 ? '' : FESTA.includes(pose) ? 'mascote-pula' : 'mascote';
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/elenco/${pose}.webp`} alt={alt} width={size} height={size} className={`shrink-0 select-none ${motion} ${className}`} draggable={false} />;
}
