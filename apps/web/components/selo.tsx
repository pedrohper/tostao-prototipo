// Selos de ícone do Tostão (T4.5): no lugar dos emojis nativos (⚠️ 🚨 🎯...) nos avisos dos simuladores.
// Emoji muda de cara em cada celular e some em fonte sem suporte; o selo é SVG, usa os tokens e acompanha o tema.
// Decorativo (aria-hidden): quem dá o sentido é o texto em negrito que vem logo depois.

export type SeloTipo =
  | 'alerta'
  | 'perigo'
  | 'meta'
  | 'ok'
  | 'erro'
  | 'dica'
  | 'brilho'
  | 'tempo'
  | 'fogo'
  | 'dados'
  | 'queda'
  | 'alta'
  | 'dinheiro'
  | 'lei';

const TONE: Record<SeloTipo, string> = {
  alerta: 'bg-amarelo text-tinta-fixa',
  perigo: 'bg-rosa-forte text-tinta-fixa',
  meta: 'bg-laranja-claro text-laranja-texto',
  ok: 'bg-menta text-tinta-fixa',
  erro: 'bg-rosa-forte text-tinta-fixa',
  dica: 'bg-amarelo text-tinta-fixa',
  brilho: 'bg-menta-clara text-verde-texto',
  tempo: 'bg-azul text-tinta',
  fogo: 'bg-laranja-claro text-laranja-texto',
  dados: 'bg-azul text-tinta',
  queda: 'bg-rosa text-vermelho-texto',
  alta: 'bg-menta-clara text-verde-texto',
  dinheiro: 'bg-amarelo-claro text-laranja-texto',
  lei: 'bg-azul text-tinta',
};

const PATHS: Record<SeloTipo, React.ReactNode> = {
  alerta: (
    <>
      <path d="M12 3.5l9.5 16.5h-19L12 3.5z" />
      <path d="M12 10v4.5" />
      <path d="M12 17.5h.01" />
    </>
  ),
  perigo: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5" />
      <path d="M12 16h.01" />
    </>
  ),
  meta: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.2" />
    </>
  ),
  ok: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  erro: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  dica: (
    <>
      <path d="M9.5 18h5M10.5 21h3" />
      <path d="M12 3a6 6 0 0 0-3.9 10.5c.7.7 1 1.4 1 2.5h5.8c0-1.1.3-1.8 1-2.5A6 6 0 0 0 12 3z" />
    </>
  ),
  brilho: <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />,
  tempo: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  fogo: (
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  ),
  dados: <path d="M5 20V11M12 20V4M19 20v-6" />,
  queda: (
    <>
      <path d="M3 7l6 6 4-4 8 8" />
      <path d="M15 17h6v-6" />
    </>
  ),
  alta: (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  dinheiro: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 9.5c-.5-1-1.4-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1.1 0-2-.5-2.5-1.5" />
      <path d="M12 6v2M12 16v2" />
    </>
  ),
  lei: (
    <>
      <path d="M12 4v16M7 20h10" />
      <path d="M5 8h14" />
      <path d="M5 8l-2.5 6a3 3 0 0 0 5 0L5 8zM19 8l-2.5 6a3 3 0 0 0 5 0L19 8z" />
    </>
  ),
};

export function Selo({ tipo, className = '' }: { tipo: SeloTipo; className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-selo={tipo}
      className={`mr-1 inline-flex h-[18px] w-[18px] shrink-0 translate-y-[3px] items-center justify-center rounded-full align-baseline ${TONE[tipo]} ${className}`}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {PATHS[tipo]}
      </svg>
    </span>
  );
}
