// Galeria de simuladores (T4.5): os principais, abertos a qualquer hora sem passar por uma lição. Cada entrada aponta
// pro simulador que já existe na lição de mesmo id (são 45 no total; aqui entram os de uso mais prático no dia a dia).

export const SIMULATOR_GROUPS = ['Dia a dia', 'Dívidas', 'Reserva e renda', 'Investir e se proteger'] as const;
export type SimulatorGroup = (typeof SIMULATOR_GROUPS)[number];

export type SimulatorEntry = { id: string; title: string; blurb: string; group: SimulatorGroup };

export const SIMULATOR_CATALOG: readonly SimulatorEntry[] = [
  {
    id: 'm1-l1',
    title: 'Ralo do cafezinho',
    blurb: 'Quanto os gastinhos do dia a dia viram em 3 meses e em 1 ano.',
    group: 'Dia a dia',
  },
  {
    id: 'm1-l2',
    title: 'Sua renda em fatias (50/30/20)',
    blurb: 'Divida a renda entre o básico, o lazer e o seu futuro.',
    group: 'Dia a dia',
  },
  {
    id: 'm1-l3',
    title: 'Assinaturas no ano',
    blurb: 'Marque o que toparia cortar e veja o que sobra em 12 meses.',
    group: 'Dia a dia',
  },
  {
    id: 'm2-l3',
    title: 'Parcelado vs à vista',
    blurb: 'Compare o preço parcelado com o desconto no Pix.',
    group: 'Dia a dia',
  },
  {
    id: 'm2-l2',
    title: 'Bola de neve do mínimo',
    blurb: 'Pagar só o mínimo da fatura: quanto a dívida cresce e por quanto tempo.',
    group: 'Dívidas',
  },
  {
    id: 'm3-l2',
    title: 'Avalanche vs bola de neve',
    blurb: 'Qual dívida pagar primeiro pra gastar menos juros.',
    group: 'Dívidas',
  },
  {
    id: 'm4-l5',
    title: 'Reserva de emergência',
    blurb: 'Quantos meses o seu saldo guardado sustenta o seu custo básico.',
    group: 'Reserva e renda',
  },
  {
    id: 'm5-l1',
    title: 'Juros compostos: aportes vs renda',
    blurb: 'O efeito do tempo e do aporte mensal no patrimônio.',
    group: 'Reserva e renda',
  },
  {
    id: 'm6-l1',
    title: 'Holerite real',
    blurb: 'Do salário bruto ao líquido: INSS, IR e o que sobra.',
    group: 'Reserva e renda',
  },
  {
    id: 'm6-l5',
    title: 'CLT vs PJ',
    blurb: 'A equivalência entre duas propostas de trabalho.',
    group: 'Reserva e renda',
  },
  {
    id: 'm7-l1',
    title: 'Quanto rende no CDI',
    blurb: 'Compare o rendimento de R$ 1.000 em 1 ano.',
    group: 'Investir e se proteger',
  },
  {
    id: 'm7-l5',
    title: 'Ganho real contra a inflação',
    blurb: 'Descubra se o seu dinheiro está rendendo de verdade.',
    group: 'Investir e se proteger',
  },
  {
    id: 'm9-l2',
    title: 'A vantagem da banca (bets)',
    blurb: 'Mil jogadas virtuais pra ver pra quem a conta fecha.',
    group: 'Investir e se proteger',
  },
];

export function findSimulator(id: string): SimulatorEntry | null {
  return SIMULATOR_CATALOG.find((s) => s.id === id) ?? null;
}

export function simulatorsByGroup(): { group: SimulatorGroup; items: SimulatorEntry[] }[] {
  return SIMULATOR_GROUPS.map((group) => ({ group, items: SIMULATOR_CATALOG.filter((s) => s.group === group) })).filter(
    (g) => g.items.length > 0,
  );
}
