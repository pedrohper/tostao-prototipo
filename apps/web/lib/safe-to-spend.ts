// T6.17 · o que o cartão "quanto posso gastar hoje" escreve, a partir da conta que vem pronta da API.
import type { ThisMonthForecast } from '@tostao/contracts';
import type { Dictionary } from './i18n';

type Texts = Dictionary['home']['safeToSpend'];

/** `null` = a API ainda não manda essa conta (web publicada antes dela). */
export function safeToSpendView(month: ThisMonthForecast, texts: Texts, money: (cents: number) => string) {
  const { safeToSpend: math, safeToSpendTodayInCents: perDay } = month;
  if (!math || perDay === undefined) return null;
  const short = math.availableInCents < 0;

  // Só cita o que de fato foi descontado.
  const taken = (['spent', 'fixed', 'subscriptions', 'scheduled', 'goal'] as const).filter(
    (key) => (key === 'spent' ? month.spentInCents : math[`${key}InCents`]) > 0,
  );
  const names = taken.map((key) => texts.parts[key]);
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')}${texts.and}${names.at(-1)}` : (names[0] ?? '');

  const line = (key: (typeof taken)[number]) => ({
    label: texts.rows[key],
    value: money(key === 'spent' ? month.spentInCents : math[`${key}InCents`]),
    minus: true,
  });

  return {
    title: texts.title,
    // Faltando dinheiro, o número grande é o total que falta (um "por dia" negativo não diz nada).
    amount: money(short ? math.availableInCents : perDay),
    short,
    caption: short
      ? texts.shortfall
      : math.availableInCents === 0
        ? texts.nothingLeft
        : math.daysIncludingToday === 1
          ? texts.lastDay
          : texts.perDay(math.daysIncludingToday),
    explanation: list ? texts.alreadyOut(list) : '',
    detailsLabel: texts.details,
    rows: [
      { label: texts.rows.income, value: money(month.incomeInCents) },
      ...taken.map(line),
      {
        label: short ? texts.rows.missing : texts.rows.available(math.daysIncludingToday),
        value: money(Math.abs(math.availableInCents)),
        total: true,
      },
    ],
    note: texts.note,
  };
}
