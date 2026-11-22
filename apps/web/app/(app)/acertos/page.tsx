import Link from 'next/link';
import type { PeopleResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { erroDe } from '@/lib/erros';
import { money, resolveBackHref, shortDate } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';
import { BackLink, Eyebrow, PageFrame } from '@/components/ui';
import { Mascot } from '@/components/mascote';
import { EntryForm } from './entry-form';
import { NewSplitButton } from './split-sheet';

/** Caderninho de acertos: quem te deve e pra quem você deve. */
export default async function AcertosPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; voltar?: string }>;
}) {
  const [{ erro, voltar }, r, { locale, t }] = await Promise.all([
    searchParams,
    api<PeopleResponse>('/people').catch((): PeopleResponse => ({ people: [], owedToYouInCents: 0, youOweInCents: 0 })),
    getI18n(),
  ]);
  const p = t.pages.acertos;
  const abertos = r.people.filter((x) => x.balanceInCents !== 0);
  const quitados = r.people.filter((x) => x.balanceInCents === 0);
  const backHref = resolveBackHref(voltar, '/carteira?aba=planejar');
  const selfBack = voltar ? `/acertos?voltar=${encodeURIComponent(backHref)}` : '/acertos';
  const createLabel = locale === 'en' ? 'New split' : locale === 'es' ? 'Nuevo ajuste' : 'Criar acerto';
  const openSectionLabel = locale === 'en' ? 'Open balances' : locale === 'es' ? 'En aberto' : 'Em aberto';
  const settledSectionLabel =
    locale === 'en'
      ? `Settled (${quitados.length})`
      : locale === 'es'
        ? `Saldados (${quitados.length})`
        : `Quitados (${quitados.length})`;
  const errMsg = erroDe(erro);

  const renderPersonRow = (x: PeopleResponse['people'][number]) => (
    <li key={x.id} className="border-b border-linha last:border-b-0">
      <Link
        href={voltar ? `/acertos/${x.id}?voltar=${encodeURIComponent(selfBack)}` : `/acertos/${x.id}`}
        className="flex min-h-[62px] items-center gap-3 py-1.5 text-tinta no-underline"
      >
        <span
          aria-hidden="true"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-[15px] font-extrabold ${
            x.balanceInCents > 0
              ? 'bg-menta-clara text-verde-texto'
              : x.balanceInCents < 0
                ? 'bg-rosa text-vermelho-texto'
                : 'bg-papel-2 text-tinta-suave'
          }`}
        >
          {x.name.charAt(0).toUpperCase()}
        </span>
        <span className="flex min-w-0 grow flex-col gap-0.5">
          <span className="truncate text-[15px] font-bold">{x.name}</span>
          <span className="text-xs text-tinta-suave">
            {x.balanceInCents > 0 ? p.statusOwed : x.balanceInCents < 0 ? p.statusYouOwe : p.statusSettled} ·{' '}
            {p.entryCount(x.count)}
            {x.lastAt ? ` · ${shortDate(x.lastAt, locale)}` : ''}
          </span>
        </span>
        <span
          className={`shrink-0 text-[15px] font-bold tabular-nums ${
            x.balanceInCents > 0
              ? 'text-verde-texto'
              : x.balanceInCents < 0
                ? 'text-vermelho-texto'
                : 'text-tinta-suave'
          }`}
        >
          {money(Math.abs(x.balanceInCents))} ›
        </span>
      </Link>
    </li>
  );

  return (
    <PageFrame size="analytics" className="pb-24 md:pb-0">
      <BackLink href={backHref} label={t.common.back} />
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[28px] leading-[32px] font-extrabold lg:text-[30px] lg:leading-[34px]">
          {p.title}
        </h1>
        <NewSplitButton
          people={r.people.map((x) => x.name)}
          label={createLabel}
          title={p.formTitle}
          cashNote={p.cashNote}
          errorMessage={errMsg}
          t={p.entryForm}
        />
      </div>

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[1.08fr_0.92fr] lg:items-start lg:gap-6">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-0.5 rounded-2xl bg-menta-clara p-3.5">
              <span className="text-xs font-semibold text-tinta-suave">{p.owedToYou}</span>
              <span className="font-display text-[24px] leading-7 font-extrabold text-verde-texto tabular-nums">
                {money(r.owedToYouInCents)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-2xl bg-rosa p-3.5">
              <span className="text-xs font-semibold text-tinta-suave">{p.youOwe}</span>
              <span className="font-display text-[24px] leading-7 font-extrabold text-vermelho-texto tabular-nums">
                {money(r.youOweInCents)}
              </span>
            </div>
          </div>

          {r.people.length === 0 ? (
            <div className="flex items-center gap-2 rounded-2xl bg-amarelo-claro py-3 pr-3.5 pl-1.5">
              <Mascot pose="pensando" size={72} alt="" />
              <p className="text-[15px] leading-[21px]">
                {p.emptyIntroBefore}
                <b>{p.emptyIntroBold}</b>
                {p.emptyIntroAfter}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {abertos.length > 0 && (
                <div className="flex flex-col gap-2">
                  <Eyebrow>{openSectionLabel}</Eyebrow>
                  <ul className="flex flex-col rounded-2xl border border-linha bg-cartao px-3.5">
                    {abertos.map(renderPersonRow)}
                  </ul>
                </div>
              )}

              {quitados.length > 0 &&
                (abertos.length > 0 ? (
                  <details className="group rounded-2xl border border-linha bg-cartao px-3.5 py-2.5">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold tracking-[0.06em] text-tinta-suave uppercase [&::-webkit-details-marker]:hidden">
                      <span>{settledSectionLabel}</span>
                      <span className="transition-transform group-open:rotate-90" aria-hidden="true">
                        ›
                      </span>
                    </summary>
                    <ul className="mt-2 flex flex-col border-t border-linha pt-1">{quitados.map(renderPersonRow)}</ul>
                  </details>
                ) : (
                  <ul className="flex flex-col rounded-2xl border border-linha bg-cartao px-3.5">
                    {quitados.map(renderPersonRow)}
                  </ul>
                ))}
            </div>
          )}
        </div>

        {/* No desktop a coluna lateral continua visível; no mobile o formulário abre pelo botão "+ Criar acerto". */}
        <section className="hidden min-w-0 flex-col gap-2.5 rounded-2xl border border-linha bg-cartao p-4 lg:flex">
          <Eyebrow>{p.formTitle}</Eyebrow>
          {errMsg && (
            <p role="alert" className="rounded-xl bg-rosa px-3 py-2 text-sm font-medium">
              {errMsg}
            </p>
          )}
          <EntryForm people={r.people.map((x) => x.name)} t={p.entryForm} />
          <p className="text-xs leading-[18px] text-tinta-suave">{p.cashNote}</p>
        </section>
      </div>
    </PageFrame>
  );
}
