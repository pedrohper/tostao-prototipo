// Galeria de simuladores (T4.5): os principais, abertos a qualquer hora sem passar por uma lição. Cada entrada aponta
// pro simulador que já existe na lição de mesmo id (são 45 no total; aqui entram os de uso mais prático no dia a dia).

export const SIMULATOR_GROUPS = ['Dia a dia', 'Dívidas', 'Reserva e renda', 'Investir e se proteger'] as const;
export type SimulatorGroup = (typeof SIMULATOR_GROUPS)[number];

export type SimulatorEntry = {
  id: string;
  title: string;
  /** O que o simulador faz. */
  blurb: string;
  /** "Você vai entender": o que a pessoa leva dali, em 1 ou 2 linhas (T6.14). */
  aprende: string;
  group: SimulatorGroup;
};

export const SIMULATOR_CATALOG: readonly SimulatorEntry[] = [
  {
    id: 'm1-l1',
    title: 'Ralo do cafezinho',
    blurb: 'Quanto os gastinhos do dia a dia viram em 3 meses e em 1 ano.',
    aprende: 'Como um gastinho repetido vira uma bolada em um ano.',
    group: 'Dia a dia',
  },
  {
    id: 'm1-l2',
    title: 'Sua renda em fatias (50/30/20)',
    blurb: 'Divida a renda entre o básico, o lazer e o seu futuro.',
    aprende: 'Como dividir a renda entre básico, lazer e futuro, mesmo quando o básico aperta.',
    group: 'Dia a dia',
  },
  {
    id: 'm1-l3',
    title: 'Assinaturas no ano',
    blurb: 'Marque o que toparia cortar e veja o que sobra em 12 meses.',
    aprende: 'Por que cortar um gasto fixo uma vez só alivia todos os meses seguintes.',
    group: 'Dia a dia',
  },
  {
    id: 'm2-l3',
    title: 'Parcelado vs à vista',
    blurb: 'Compare o preço parcelado com o desconto no Pix.',
    aprende: 'Quando o "sem juros" sai mais caro que pagar à vista com desconto.',
    group: 'Dia a dia',
  },
  {
    id: 'm2-l2',
    title: 'Bola de neve do mínimo',
    blurb: 'Pagar só o mínimo da fatura: quanto a dívida cresce e por quanto tempo.',
    aprende: 'Por que pagar só o mínimo pode fazer a fatura custar até o dobro.',
    group: 'Dívidas',
  },
  {
    id: 'm3-l2',
    title: 'Avalanche vs bola de neve',
    blurb: 'Qual dívida pagar primeiro pra gastar menos juros.',
    aprende: 'Qual dívida atacar primeiro, a de juro mais alto ou a menor, e o que cada uma custa.',
    group: 'Dívidas',
  },
  {
    id: 'm4-l5',
    title: 'Reserva de emergência',
    blurb: 'Quantos meses o seu saldo guardado sustenta o seu custo básico.',
    aprende: 'Quantos meses você aguenta com o que tem guardado, sem depender do próximo salário.',
    group: 'Reserva e renda',
  },
  {
    id: 'm5-l1',
    title: 'Juros compostos: aportes vs renda',
    blurb: 'O efeito do tempo e do aporte mensal no patrimônio.',
    aprende: 'Por que aumentar a renda pode pesar mais que começar guardando pouco.',
    group: 'Reserva e renda',
  },
  {
    id: 'm5-l3',
    title: 'Balanço do estágio',
    blurb: 'Bolsa menos curso, transporte e comida: o estágio se paga?',
    aprende: 'Quanto sobra (ou falta) do estágio depois do curso, do transporte e da comida.',
    group: 'Reserva e renda',
  },
  {
    id: 'm5-l4',
    title: 'Preço do freela',
    blurb: 'Quanto cobrar contando horas, custos e revisões.',
    aprende: 'Como cobrar contando custos e revisões, pra não pagar pra trabalhar.',
    group: 'Reserva e renda',
  },
  {
    id: 'm6-l1',
    title: 'Holerite real',
    blurb: 'Do salário bruto ao líquido: INSS, IR e o que sobra.',
    aprende: 'Pra onde vai a diferença entre o salário da vaga e o que cai na conta.',
    group: 'Reserva e renda',
  },
  {
    id: 'm6-l5',
    title: 'CLT vs PJ',
    blurb: 'A equivalência entre duas propostas de trabalho.',
    aprende: 'O que some no PJ (13º, férias, FGTS) e quanto ele precisa pagar pra empatar.',
    group: 'Reserva e renda',
  },
  {
    id: 'm7-l1',
    title: 'Quanto rende no CDI',
    blurb: 'Compare o rendimento de R$ 1.000 em 1 ano.',
    aprende: 'O que é emprestar dinheiro pro banco (CDB) e quanto rende perto da poupança.',
    group: 'Investir e se proteger',
  },
  {
    id: 'm7-l5',
    title: 'Ganho real contra a inflação',
    blurb: 'Descubra se o seu dinheiro está rendendo de verdade.',
    aprende: 'Por que o saldo pode subir e mesmo assim comprar menos, por causa da inflação.',
    group: 'Investir e se proteger',
  },
  {
    id: 'm9-l2',
    title: 'A vantagem da banca (bets)',
    blurb: 'Mil jogadas virtuais pra ver pra quem a conta fecha.',
    aprende: 'Por que a banca ganha no longo prazo, mesmo quando você acerta algumas.',
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
