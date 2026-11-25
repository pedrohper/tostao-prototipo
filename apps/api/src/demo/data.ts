// Dados FICTÍCIOS do usuário de demonstração (`pnpm shots`): o bastante pra toda tela ter conteúdo.
// Função pura: recebe o "agora" e devolve o que gravar. As datas são relativas a ele, então os prints de qualquer dia
// têm mês corrente preenchido, cobrança chegando, conta a pagar, fatura aberta e lição pela metade.
import type { ActivityKind, FinancialPlan } from '@tostao/contracts';
import { addCivilDays, civilDay, daysInMonth, noonOfCivilDay } from '../lib/tz.js';

export const DEMO_EMAIL = 'demo@tostao.test';
export const DEMO_NAME = 'Duda Demonstração';
export const DEMO_FRIENDS = [
  { key: 'lari', name: 'Lari Souza', email: 'lari.demo@tostao.test', code: 'TOST-DEMO2', streak: 12 },
  { key: 'rafa', name: 'Rafa Lima', email: 'rafa.demo@tostao.test', code: 'TOST-DEMO3', streak: 3 },
  // Bia só mandou o pedido de amizade (aparece como pendente em /amigos).
  { key: 'bia', name: 'Bia Torres', email: 'bia.demo@tostao.test', code: 'TOST-DEMO4', streak: 1 },
] as const;
export const DEMO_EMAILS: readonly string[] = [DEMO_EMAIL, ...DEMO_FRIENDS.map((f) => f.email)];
export const DEMO_INVITE_CODE = 'DEMOSHOTS1';

export type DemoAccountKey = 'nubank' | 'cartao' | 'inter' | 'carteira';
export type DemoPersonKey = 'lari' | 'gui' | 'rafa';

export const DEMO_PEOPLE: Record<DemoPersonKey, string> = { lari: 'Lari', gui: 'Gui', rafa: 'Rafa' };

export type DemoTransaction = {
  account: DemoAccountKey | null;
  description: string;
  amountInCents: number;
  occurredAt: Date;
  categoryId: string | null;
  isInternalTransfer?: boolean;
  person?: DemoPersonKey;
  note?: string;
  /** Anotado à mão (sem id do banco). */
  manual?: boolean;
  /** Ainda não pago/recebido: vai pra "a pagar" ou "a receber". */
  pending?: boolean;
};

const shift = (month: string, delta: number) => {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
};
const pad = (n: number) => String(n).padStart(2, '0');

/** Relógio da demonstração: o "hoje" da pessoa e as contas de data em cima dele. */
export function demoCalendar(now: Date, tz: string) {
  const today = civilDay(now, tz);
  const month = today.slice(0, 7);
  const todayDay = Number(today.slice(8, 10));
  /** Meio-dia do dia `day` do mês `offset` (0 = atual), nunca depois de agora quando é do mês atual e já passou. */
  const at = (offset: number, day: number) => {
    const m = shift(month, offset);
    const noon = noonOfCivilDay(`${m}-${pad(Math.min(day, daysInMonth(m)))}`, tz);
    return offset === 0 && day <= todayDay && noon > now ? new Date(now.getTime() - 60_000) : noon;
  };
  /** Dia do mês (1..28) que fica `days` dias depois (ou antes) de hoje, dando a volta no mês. */
  const dayNear = (days: number) => ((((todayDay - 1 + days) % 28) + 28) % 28) + 1;
  /** Daqui a `days` dias, sem sair do mês atual (conta a pagar e a receber precisam aparecer no mês). */
  const ahead = (days: number) => {
    const target = addCivilDays(today, days);
    const last = `${month}-${pad(daysInMonth(month))}`;
    return noonOfCivilDay(target > last ? last : target, tz);
  };
  return { today, month, todayDay, at, dayNear, ahead };
}

export function buildDemoTransactions(now: Date, tz: string): DemoTransaction[] {
  const { todayDay, at, dayNear, ahead } = demoCalendar(now, tz);
  const out: DemoTransaction[] = [];
  const add = (t: DemoTransaction) => out.push(t);
  /** Gasto do dia a dia: no mês atual, o que "ainda não chegou" cai nos últimos dias (a tela nunca fica vazia). */
  const spread = (offset: number, day: number) =>
    at(offset, offset === 0 && day > todayDay ? Math.max(1, todayDay - (day % 4)) : day);
  /** Já aconteceu? (meses passados sim; no atual, só até hoje). */
  const happened = (offset: number, day: number) => offset < 0 || day <= todayDay;

  for (let offset = -6; offset <= 0; offset++) {
    const wobble = ((offset + 6) * 7) % 5; // varia os valores de um mês pro outro sem sortear nada
    const vary = (cents: number) => Math.round((cents * (100 + (offset === 0 ? 0 : (wobble - 2) * 6))) / 100 / 10) * 10;
    const spend = (
      account: DemoAccountKey,
      description: string,
      cents: number,
      day: number,
      categoryId: string | null,
    ) => add({ account, description, amountInCents: -vary(cents), occurredAt: spread(offset, day), categoryId });
    const fixed = (
      account: DemoAccountKey,
      description: string,
      amountInCents: number,
      day: number,
      categoryId: string | null,
      extra: Partial<DemoTransaction> = {},
    ) => {
      if (happened(offset, day))
        add({ account, description, amountInCents, occurredAt: at(offset, day), categoryId, ...extra });
    };

    // Renda
    fixed('nubank', 'TED RECEBIDA ACME TECNOLOGIA SALARIO', 248000, 5, 'salario');
    if (offset === -4 || offset === -2 || offset === -1 || offset === 0)
      fixed('inter', 'PIX RECEBIDO STUDIO PIXEL FREELA', offset === -2 ? 52000 : 35000, 18, 'freela');

    // Contas fixas (Pix/boleto/pagamento não viram "assinatura")
    fixed('nubank', 'PIX ENVIADO ALUGUEL REPUBLICA', -65000, 8, 'casa');
    fixed('nubank', 'BOLETO FACULDADE HORIZONTE', -28900, 10, 'estudo');
    fixed('nubank', 'PAGTO VIVO FIBRA', -9990, 12, 'casa');

    // Guardar, transferir entre contas próprias e pagar a fatura (as duas últimas não contam como gasto)
    fixed('nubank', 'APLICACAO RDB RESERVA', -20000, 6, 'investimentos');
    fixed('nubank', 'TRANSFERENCIA ENVIADA CONTA INTER', -15000, 6, null, { isInternalTransfer: true });
    fixed('inter', 'TRANSFERENCIA RECEBIDA CONTA NUBANK', 15000, 6, null, { isInternalTransfer: true });
    fixed('nubank', 'PAGAMENTO DE FATURA', -(31000 + wobble * 900), 7, null, { isInternalTransfer: true });
    fixed('cartao', 'PAGAMENTO RECEBIDO', 31000 + wobble * 900, 7, null, { isInternalTransfer: true });

    // Dia a dia
    spend('cartao', 'IFD*BURGER DO ZE', 4290, 3, 'delivery');
    spend('cartao', 'IFD*PIZZARIA BELLA', 5890, 9, 'delivery');
    spend('cartao', 'RAPPI*SUSHI DA VILA', 6470, 16, 'delivery');
    spend('cartao', 'IFD*ACAI POINT', 2890, 22, 'delivery');
    spend('nubank', 'ASSAI ATACADISTA', 14230, 2, 'mercado');
    spend('nubank', 'SUPERMERCADO BOM PRECO', 8760, 13, 'mercado');
    spend('nubank', 'HORTIFRUTI DA ESQUINA', 3120, 19, 'mercado');
    spend('inter', 'BILHETE UNICO RECARGA', 8000, 6, 'transporte');
    spend('inter', 'UBER *TRIP', 1890, 4, 'transporte');
    spend('inter', 'UBER *TRIP', 2340, 11, 'transporte');
    spend('inter', '99APP *CORRIDA', 1620, 23, 'transporte');
    spend('cartao', 'BAR DO TONINHO', 7600, 14, 'role');
    spend('cartao', 'CINEMARK CENTRO', 4400, 21, 'role');
    spend('inter', 'PADARIA PAO QUENTE', 1450, 1, 'comer-fora');
    spend('inter', 'PADARIA PAO QUENTE', 1780, 15, 'comer-fora');
    spend('inter', 'LANCHONETE DO CAMPUS', 2150, 17, 'comer-fora');
    spend('nubank', 'DROGASIL CENTRO', 3890, 18, 'saude');

    // Compra parcelada no cartão (entra na previsão como parcela que falta)
    if (offset >= -2)
      add({
        account: 'cartao',
        description: `SHOPEE *FONE BLUETOOTH ${offset + 3}/6`,
        amountInCents: -4990,
        occurredAt: spread(offset, 5),
        categoryId: 'compras',
      });
  }

  // Assinaturas: uma cobrança por mês, no mesmo dia, com os dias escolhidos em volta de hoje pra sempre ter uma chegando.
  const subscriptions = [
    { description: 'NETFLIX.COM', day: dayNear(-3), cents: 4490, latest: 5590, categoryId: 'assinaturas' }, // subiu
    { description: 'SPOTIFY BR', day: dayNear(-9), cents: 2190, latest: 2190, categoryId: 'assinaturas' },
    { description: 'SMARTFIT UNIDADE CENTRO', day: dayNear(-14), cents: 11990, latest: 11990, categoryId: 'saude' },
    { description: 'APPLE.COM/BILL', day: dayNear(4), cents: 1490, latest: 1490, categoryId: 'assinaturas' },
    { description: 'AMAZONPRIME BR', day: dayNear(1), cents: 1990, latest: 1990, categoryId: 'assinaturas' },
  ];
  for (const s of subscriptions) {
    const offsets = [-6, -5, -4, -3, -2, -1, 0].filter((o) => happened(o, s.day));
    offsets.forEach((offset, i) =>
      add({
        account: 'cartao',
        description: s.description,
        amountInCents: -(i === offsets.length - 1 ? s.latest : s.cents),
        occurredAt: at(offset, s.day),
        categoryId: s.categoryId,
      }),
    );
  }

  // Mês atual: sem categoria (o Caramelo avisa) e um Pix com cara de racha (o olheiro de acertos avisa).
  const recent = (daysAgo: number) => at(0, Math.max(1, todayDay - daysAgo));
  add({
    account: 'nubank',
    description: 'PAG*JOSEMARIADASILVA',
    amountInCents: -2300,
    occurredAt: recent(1),
    categoryId: null,
  });
  add({
    account: 'cartao',
    description: 'MP*LOJINHA2211',
    amountInCents: -3590,
    occurredAt: recent(2),
    categoryId: null,
  });
  add({
    account: 'inter',
    description: 'PIX ENVIADO CARLOS A SILVA',
    amountInCents: -1500,
    occurredAt: recent(4),
    categoryId: null,
  });
  add({
    account: 'inter',
    description: 'PIX RECEBIDO RACHA DO CHURRASCO',
    amountInCents: 4000,
    occurredAt: recent(3),
    categoryId: 'reembolso',
  });
  add({
    account: 'carteira',
    description: 'Feira de sábado',
    amountInCents: -2500,
    occurredAt: recent(2),
    categoryId: 'mercado',
    manual: true,
  });

  // A pagar e a receber (anotados à mão, ainda pendentes)
  add({
    account: null,
    description: 'Conta de luz (minha parte)',
    amountInCents: -8600,
    occurredAt: ahead(2),
    categoryId: 'casa',
    manual: true,
    pending: true,
  });
  add({
    account: null,
    description: 'Curso de inglês',
    amountInCents: -12000,
    occurredAt: ahead(4),
    categoryId: 'estudo',
    manual: true,
    pending: true,
  });
  add({
    account: null,
    description: 'Freela da landing page',
    amountInCents: 25000,
    occurredAt: ahead(3),
    categoryId: 'freela',
    manual: true,
    pending: true,
  });

  // Acertos: Lari e Gui devem pra você; você deve pro Rafa. Não contam como gasto nem renda.
  const split = (t: Omit<DemoTransaction, 'categoryId' | 'isInternalTransfer'>) =>
    add({ ...t, categoryId: null, isInternalTransfer: true });
  split({
    account: 'nubank',
    description: 'PIX ENVIADO LARISSA M',
    amountInCents: -12000,
    occurredAt: at(-1, 20),
    person: 'lari',
    note: 'Emprestei pro conserto do celular',
  });
  split({
    account: 'nubank',
    description: 'PIX RECEBIDO LARISSA M',
    amountInCents: 3500,
    occurredAt: recent(10),
    person: 'lari',
    note: 'Pagou uma parte',
  });
  split({
    account: 'cartao',
    description: 'INGRESSO DO SHOW (GUI)',
    amountInCents: -23000,
    occurredAt: recent(7),
    person: 'gui',
    note: 'Comprei no meu cartão, ele paga dia 10',
  });
  split({
    account: 'inter',
    description: 'PIX RECEBIDO RAFAEL C',
    amountInCents: 4000,
    occurredAt: recent(5),
    person: 'rafa',
  });

  return out.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
}

export function buildDemoAccounts(now: Date, tz: string) {
  const { today } = demoCalendar(now, tz);
  const inFiveDays = noonOfCivilDay(addCivilDays(today, 5), tz);
  return [
    { key: 'nubank', connection: 'nubank', name: 'Nubank', type: 'BANK', balanceInCents: 184350 },
    {
      key: 'cartao',
      connection: 'nubank',
      name: 'Nubank Mastercard',
      type: 'CREDIT',
      balanceInCents: -61240,
      creditLimitInCents: 200000,
      dueDate: inFiveDays,
      fingerprint: 'CREDIT:MASTERCARD:4821',
    },
    { key: 'inter', connection: 'inter', name: 'Inter', type: 'BANK', balanceInCents: 52015 },
    { key: 'carteira', connection: 'manual', name: 'Dinheiro na carteira', type: 'BANK', balanceInCents: 6000 },
  ] satisfies {
    key: DemoAccountKey;
    connection: 'nubank' | 'inter' | 'manual';
    name: string;
    type: 'BANK' | 'CREDIT';
    balanceInCents: number;
    creditLimitInCents?: number;
    dueDate?: Date;
    fingerprint?: string;
  }[];
}

export function buildDemoPlan(now: Date, tz: string): FinancialPlan {
  const { month, dayNear } = demoCalendar(now, tz);
  const goals = [
    {
      id: 'default',
      kind: 'reserva' as const,
      label: 'Reserva de emergência',
      amountInCents: 600000,
      deadline: shift(month, 11),
      savedInCents: 215000,
    },
    {
      id: 'viagem',
      kind: 'viagem' as const,
      label: 'Viagem pro Nordeste',
      amountInCents: 180000,
      deadline: shift(month, 8),
      savedInCents: 54000,
    },
  ];
  return {
    salary: {
      amountInCents: 248000,
      payday: 5,
      varies: false,
      bank: 'Nubank',
      advance: null,
      pattern: 'ACME TECNOLOGIA SALARIO',
    },
    otherIncomes: [{ name: 'Freela de design', amountInCents: 35000, day: 18, countsAsIncome: true, pattern: null }],
    fixedExpenses: [
      { name: 'Aluguel da república', amountInCents: 65000, day: 8 },
      { name: 'Faculdade', amountInCents: 28900, day: 10 },
      { name: 'Internet', amountInCents: 9990, day: 12 },
      { name: 'Conta de luz (minha parte)', amountInCents: 8600, day: dayNear(2) },
    ],
    benefits: [{ kind: 'VR', amountInCents: 52800, day: 1 }],
    goal: goals[0]!,
    goals,
  };
}

export const DEMO_BUDGETS = [
  { categoryId: 'delivery', limitInCents: 22000 },
  { categoryId: 'mercado', limitInCents: 40000 },
  { categoryId: 'role', limitInCents: 14000 },
];

/** Módulo 1 inteiro e 2 de 5 do módulo 2: tem "lição em andamento". `daysAgo` espalha a ofensiva. */
export const DEMO_LESSONS = [
  { lessonId: 'm1-l1', daysAgo: 12 },
  { lessonId: 'm1-l2', daysAgo: 10 },
  { lessonId: 'm1-l3', daysAgo: 8 },
  { lessonId: 'm1-l4', daysAgo: 6 },
  { lessonId: 'm1-l5', daysAgo: 4 },
  { lessonId: 'm2-l1', daysAgo: 2 },
  { lessonId: 'm2-l2', daysAgo: 1 },
];

/** Atividades dos últimos dias (a ofensiva e o placar saem daqui). Hoje já tem uma, as outras missões ficam abertas. */
export function buildDemoActivities(now: Date, tz: string): { day: string; kind: ActivityKind }[] {
  const { today } = demoCalendar(now, tz);
  const plan: [number, ActivityKind[]][] = [
    [0, ['anotar']],
    [1, ['licao', 'categorizar']],
    [2, ['licao', 'anotar', 'visita:previsao']],
    [3, ['categorizar']],
    [4, ['licao', 'anotar']],
    [5, ['visita:assinaturas', 'anotar']],
  ];
  return plan.flatMap(([ago, kinds]) => kinds.map((kind) => ({ day: addCivilDays(today, -ago), kind })));
}

export const DEMO_CHAT: { role: 'user' | 'assistant'; content: string }[] = [
  { role: 'user', content: 'Quanto eu gastei com delivery esse mês?' },
  {
    role: 'assistant',
    content:
      'Foram 4 pedidos, perto de R$ 195. Seu limite é R$ 220, então ainda dá, mas já tá no finalzinho. Quer ver quanto sobra se pular o próximo?',
  },
  { role: 'user', content: 'Quero. E a minha reserva, como tá?' },
  {
    role: 'assistant',
    content:
      'Você já guardou R$ 2.150 de R$ 6.000. Pulando um pedido de uns R$ 50 por semana, são mais ou menos R$ 200 a mais por mês pra reserva. Sem pressão: de tostão em tostão.',
  },
];
