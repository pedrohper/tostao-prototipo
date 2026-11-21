// Cartões inline do chat (T4.5). Tudo aqui é só markup sobre dados que o SERVIDOR montou a partir do resultado das
// ferramentas: o texto da IA nunca vira cartão, link ou botão. `href` é sempre caminho interno (vem do servidor).
import Link from 'next/link';
import type { ChatCardDTO, PendingActionDTO } from '@tostao/contracts';
import { BudgetProgressBar } from '@/components/graficos';
import { money, monthName } from '@/lib/format';
import { getDictionary, type Locale } from '@/lib/i18n';

/** Só caminhos internos: mesmo que o servidor mande algo estranho, nunca vira link externo. */
function safeHref(href: string): string {
  return href.startsWith('/') && !href.startsWith('//') ? href : '/';
}

/** "2027-07" -> "julho/2027" (nome do mês pelo dicionário). */
export function monthYearLabel(month: string, locale: Locale): string {
  return `${monthName(month, locale)}/${month.slice(0, 4)}`;
}

/** "2026-11-19" -> "19/11/2026" (sem passar por Date: não existe fuso pra errar o dia). */
export function dayMonthYear(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

const CARD = 'flex flex-col gap-2 rounded-2xl border border-linha bg-cartao p-3.5';
const CTA = 'self-start text-[13px] font-semibold text-laranja-texto underline underline-offset-2';

export function ChatCards({ cards, locale = 'pt-BR' }: { cards: readonly ChatCardDTO[]; locale?: Locale }) {
  const t = getDictionary(locale).growth.chat;
  if (cards.length === 0) return null;
  return (
    <div className="flex max-w-[92%] min-w-0 flex-col gap-2 self-start" data-chat-cards>
      {cards.map((c) => {
        if (c.kind === 'categoria')
          return (
            <section
              key={`c-${c.categoryId}-${c.month}`}
              className={CARD}
              aria-label={t.categoryTitle(c.categoryName, monthName(c.month, locale))}
            >
              <span className="text-xs font-semibold tracking-[0.06em] text-tinta-suave uppercase">
                {t.categoryTitle(c.categoryName, monthName(c.month, locale))}
              </span>
              <span className="font-display text-[26px] leading-[30px] font-extrabold tabular-nums">
                {money(c.totalInCents)}
              </span>
              <span className="text-[13px] text-tinta-suave">{t.categoryCount(c.count)}</span>
              <Link href={safeHref(c.href)} className={CTA}>
                {t.cardOpenTransactions}
              </Link>
            </section>
          );
        if (c.kind === 'limite') {
          const over = c.spentInCents - c.limitInCents;
          return (
            <section key={`l-${c.categoryId}-${c.month}`} className={CARD} aria-label={t.limitTitle(c.categoryName)}>
              <span className="text-xs font-semibold tracking-[0.06em] text-tinta-suave uppercase">
                {t.limitTitle(c.categoryName)}
              </span>
              <span className="text-[15px] font-bold tabular-nums">
                {t.limitUsed(money(c.spentInCents), money(c.limitInCents))}
              </span>
              <BudgetProgressBar usado={c.spentInCents} limite={c.limitInCents} locale={locale} />
              {over > 0 && (
                <span className="text-[13px] font-semibold text-vermelho-texto">{t.limitOver(money(over))}</span>
              )}
              <Link href={safeHref(c.href)} className={CTA}>
                {t.cardOpenLimits}
              </Link>
            </section>
          );
        }
        const pct =
          c.amountInCents && c.amountInCents > 0
            ? Math.min(100, Math.round((c.savedInCents / c.amountInCents) * 100))
            : null;
        return (
          <section key="meta" className={CARD} aria-label={t.goalTitle}>
            <span className="text-xs font-semibold tracking-[0.06em] text-tinta-suave uppercase">
              {`${t.goalTitle}: ${c.label}`}
            </span>
            <span className="text-[15px] font-bold tabular-nums">
              {t.goalSaved(money(c.savedInCents), c.amountInCents !== null ? money(c.amountInCents) : null)}
            </span>
            {pct !== null && (
              <div
                className="h-2.5 overflow-hidden rounded-full bg-papel-2"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t.goalTitle}
              >
                <div className="h-full rounded-full bg-menta" style={{ width: `${pct}%` }} />
              </div>
            )}
            <div className="flex flex-col gap-0.5 text-[13px] text-tinta-suave">
              {c.deadline && <span>{t.goalDeadline(monthYearLabel(c.deadline, locale))}</span>}
              {c.monthlyNeededInCents !== null && !c.reached && (
                <span>{t.goalMonthly(money(c.monthlyNeededInCents))}</span>
              )}
              {c.reached ? (
                <span className="font-semibold text-verde-texto">{t.goalReached}</span>
              ) : (
                c.fits !== null && (
                  <span className={`font-semibold ${c.fits ? 'text-verde-texto' : 'text-vermelho-texto'}`}>
                    {c.fits ? t.goalFits : t.goalNotFits}
                  </span>
                )
              )}
            </div>
            <Link href={safeHref(c.href)} className={CTA}>
              {t.cardOpenGoal}
            </Link>
          </section>
        );
      })}
    </div>
  );
}

/**
 * Confirmação do que o Tostão PROPÔS anotar: valor, descrição, categoria e data bem separados. Só leitura (corrigir
 * = cancelar e pedir de novo): editar aqui mudaria o que a pessoa aprova, e a confirmação vale pra proposta exata.
 */
export function ProposalCard({
  proposal,
  onConfirm,
  onCancel,
  busy = false,
  locale = 'pt-BR',
}: {
  proposal: PendingActionDTO;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  locale?: Locale;
}) {
  const t = getDictionary(locale).growth.chat;
  const rows: [string, string][] = [
    [t.proposalValue, `${proposal.type === 'saida' ? '−' : '+'}${money(proposal.amountInCents)}`],
    [t.proposalDescription, proposal.description],
    [t.proposalCategory, proposal.categoryName ?? t.proposalCategoryAuto],
    [t.proposalDate, dayMonthYear(proposal.date)],
  ];
  return (
    <div
      role="group"
      aria-label={t.proposalTitle}
      className="flex flex-col gap-2.5 rounded-2xl border-[1.5px] border-tinta bg-amarelo-claro p-3.5"
    >
      <div className="flex items-center justify-between gap-2">
        <strong className="text-[14px] text-tinta">{t.proposalTitle}</strong>
        <span className="rounded-full bg-cartao px-2.5 py-0.5 text-[11px] font-bold text-tinta">
          {proposal.type === 'saida' ? t.proposalOut : t.proposalIn}
        </span>
      </div>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[14px] leading-[20px]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-tinta-suave">{label}</dt>
            <dd className="m-0 min-w-0 font-semibold break-words text-tinta tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="m-0 text-[12px] leading-[17px] text-tinta-suave">{t.proposalNote}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="rounded-full bg-tinta px-4 py-2 text-[13px] font-semibold text-papel disabled:opacity-60"
        >
          {t.confirm}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-full border border-linha bg-cartao px-4 py-2 text-[13px] font-semibold text-tinta disabled:opacity-60"
        >
          {t.cancel}
        </button>
      </div>
    </div>
  );
}
