import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { PersonDetailResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { erroDe } from '@/lib/erros';
import { isSafePathSegment, safePathSegment } from '@/lib/safe-redirect';
import { money, monthName, resolveBackHref, shortDate } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';
import { BackLink, Eyebrow, PageFrame } from '@/components/ui';
import { EntryForm } from '../entry-form';
import { apagarPessoa, renomearPessoa } from '../actions';

export default async function PessoaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; voltar?: string }>;
}) {
  const [{ id }, { erro, voltar }, { locale, t: dict }] = await Promise.all([params, searchParams, getI18n()]);
  if (!isSafePathSegment(id)) notFound();
  const ac = dict.pages.acertos;
  const pr = ac.person;
  const { person: p, transactions } = await api<PersonDetailResponse>(`/people/${safePathSegment(id)}`);
  const deve = p.balanceInCents > 0;
  const voce = p.balanceInCents < 0;
  const backHref = resolveBackHref(voltar, '/acertos');
  // Resumo pronto pro WhatsApp, sem climão.
  const linhas = transactions
    .slice(0, 15)
    .map(
      (tx) =>
        `• ${shortDate(tx.occurredAt, locale)} ${tx.description}: ${tx.amountInCents < 0 ? '' : '−'}${money(Math.abs(tx.amountInCents))}`,
    );
  const texto = deve
    ? pr.waOwedText(p.name, linhas.join('\n'), money(p.balanceInCents))
    : voce
      ? pr.waOweText(p.name, money(-p.balanceInCents))
      : '';
  const back = voltar ? `/acertos/${p.id}?voltar=${encodeURIComponent(backHref)}` : `/acertos/${p.id}`;

  return (
    <PageFrame size="analytics" className="pb-24 md:pb-0">
      <BackLink href={backHref} label={pr.backLabel} />
      {erroDe(erro) && (
        <p role="alert" className="rounded-xl bg-rosa px-3 py-2 text-sm font-medium">
          {erroDe(erro)}
        </p>
      )}

      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2.5 [&::-webkit-details-marker]:hidden">
          <h1 className="min-w-0 font-display text-[30px] leading-[34px] font-extrabold break-words">{p.name}</h1>
          <span className="shrink-0 rounded-full border border-linha px-2.5 py-1 text-xs font-semibold text-tinta-suave group-open:hidden">
            {pr.editName}
          </span>
        </summary>
        <form action={renomearPessoa} className="mt-2 flex max-w-[440px] gap-2">
          <input type="hidden" name="personId" value={p.id} />
          <input
            name="name"
            defaultValue={p.name}
            maxLength={40}
            required
            aria-label={pr.newNameAria}
            className="h-11 min-w-0 grow rounded-xl border-[1.5px] border-linha bg-cartao px-3 text-base text-tinta outline-none focus:border-tinta"
          />
          <button type="submit" className="h-11 shrink-0 rounded-full bg-tinta px-4 text-sm font-semibold text-papel">
            {dict.common.save}
          </button>
        </form>
      </details>

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[1.12fr_0.88fr] lg:items-start lg:gap-6">
        <div className="flex min-w-0 flex-col gap-4">
          <div
            className={`flex flex-col gap-0.5 rounded-2xl p-4 ${deve ? 'bg-menta-clara' : voce ? 'bg-rosa' : 'bg-papel-2'}`}
          >
            <span className="text-xs font-semibold text-tinta-suave">
              {deve ? pr.owesYou(p.name) : voce ? pr.youOwePerson(p.name) : pr.allSettled}
            </span>
            <span className="font-display text-[28px] leading-8 font-extrabold tabular-nums">
              {money(Math.abs(p.balanceInCents))}
            </span>
          </div>

          {texto && (
            <a
              href={`https://wa.me/?text=${encodeURIComponent(texto)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-[50px] items-center justify-center rounded-full border-[1.5px] border-tinta text-[15px] font-semibold text-tinta no-underline"
            >
              {deve ? pr.waSendSummary : pr.waNotify}
            </a>
          )}

          <section className="flex flex-col gap-2">
            <Eyebrow>{pr.historyTitle}</Eyebrow>
            <ul className="flex flex-col rounded-2xl border border-linha bg-cartao px-3.5">
              {transactions.map((tx) => (
                <li key={tx.id} className="border-b border-linha last:border-b-0">
                  <Link
                    href={`/carteira/${tx.id}?voltar=${encodeURIComponent(back)}`}
                    className="flex min-h-[54px] items-center gap-3 text-tinta no-underline"
                  >
                    <span className="flex min-w-0 grow flex-col">
                      <span className="truncate text-[15px] font-semibold">{tx.description}</span>
                      <span className="text-xs text-tinta-suave">
                        {shortDate(tx.occurredAt, locale)} · {tx.accountName ?? pr.notedTag} ·{' '}
                        {tx.amountInCents < 0 ? (tx.accountName ? pr.leftYou : pr.lentPaid) : pr.cameIn}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 text-[15px] font-semibold tabular-nums ${tx.amountInCents > 0 ? 'text-verde-texto' : ''}`}
                    >
                      {tx.amountInCents > 0 ? '+ ' : ''}
                      {money(Math.abs(tx.amountInCents))}
                    </span>
                  </Link>
                </li>
              ))}
              {transactions.length === 0 && (
                <li className="py-4 text-sm text-tinta-suave">{pr.emptyHistory(p.name)}</li>
              )}
            </ul>
            <p className="text-xs leading-[18px] text-tinta-suave">
              {pr.footerExplain(p.name, monthName(new Date().toISOString().slice(0, 7), locale))}
            </p>
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <section className="flex flex-col gap-2.5 rounded-2xl border border-linha bg-cartao p-4">
            <Eyebrow>{pr.formTitle(p.name)}</Eyebrow>
            <EntryForm personId={p.id} t={ac.entryForm} />
          </section>

          <form action={apagarPessoa} className="self-center">
            <input type="hidden" name="personId" value={p.id} />
            <button type="submit" className="min-h-11 text-[13px] font-semibold text-vermelho-texto">
              {pr.deletePerson(p.name)}
            </button>
          </form>
        </div>
      </div>
    </PageFrame>
  );
}
