import { SwipeSheet } from './sheet-swipe';

/** Folha que sobe de baixo (Categorizar): fundo escurecido que fecha ao tocar, e fecha arrastando a alça pra baixo. */
export function Sheet({ back, top = 112, children }: { back: string; top?: number; children: React.ReactNode }) {
  return <SwipeSheet back={back} top={top}>{children}</SwipeSheet>;
}

export const pill = (on: boolean) =>
  `flex h-10 min-w-0 items-center justify-center gap-1 rounded-full border-[1.5px] px-3 text-sm font-semibold ${on ? 'border-tinta bg-tinta text-papel' : 'border-linha bg-cartao text-tinta'}`;
