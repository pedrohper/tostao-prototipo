import Link from 'next/link';
import type { ForecastResponse, GoalStatus } from '@tostao/contracts';
import { Confetti } from '@/components/confete';
import { Icon } from '@/components/icone';
import { Mascot } from '@/components/mascote';
import { BackLink, PageFrame } from '@/components/ui';
import { api } from '@/lib/api';
import { money, monthName, resolveBackHref } from '@/lib/format';
import type { Locale } from '@/lib/i18n';
import { ConfirmSubmitButton } from '@/components/confirm-dialog';
import { getI18n } from '@/lib/i18n-server';
import { deleteGoal } from './actions';
import { DepositForm, GoalForm } from './forms';

const prazo = (m: string, locale: Locale) => `${monthName(m, locale).slice(0, 3)}/${m.slice(2, 4)}`;

function metaUrl(params: { id?: string; editar?: boolean; novo?: boolean; voltar?: string }) {
  const qs = new URLSearchParams();
  if (params.id) qs.set('id', params.id);
  if (params.editar) qs.set('editar', '1');
  if (params.novo) qs.set('novo', '1');
  if (params.voltar) qs.set('voltar', params.voltar);
  const str = qs.toString();
  return str ? `/meta?${str}` : '/meta';
}

function findSelectedGoal(goals: GoalStatus[], id?: string): GoalStatus | null {
  if (!id) return null;
  const byId = goals.find((item) => item.id === id);
  if (byId) return byId;
  if (/^\d+$/.test(id)) return goals[Number(id)] ?? null;
  return null;
}

export default async function MetaPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; editar?: string; novo?: string; voltar?: string }>;
}) {
  const [{ id, editar, novo, voltar }, f, { locale, t }] = await Promise.all([
    searchParams,
    api<ForecastResponse>('/forecast').catch((): ForecastResponse => ({
      hasPlan: false,
      months: [],
      goal: null,
      goals: [],
      thisMonth: null,
    })),
    getI18n(),
  ]);
  const p = t.pages.meta;
  const goals = f.goals && f.goals.length > 0 ? f.goals : f.goal ? [f.goal] : [];
  const selected = findSelectedGoal(goals, id);

  const backHref = resolveBackHref(voltar, '/carteira?aba=planejar');
  const voltarParam = voltar ? backHref : undefined;
  const listHref = metaUrl({ voltar: voltarParam });

  const myGoalsTitle = locale === 'en' ? 'My goals' : locale === 'es' ? 'Mis metas' : 'Minhas metas';
  const newGoalBtnLabel = locale === 'en' ? 'New goal' : locale === 'es' ? 'Nueva meta' : 'Nova meta';
  const openGoalLabel =
    locale === 'en' ? 'View & edit goal ›' : locale === 'es' ? 'Ver y editar meta ›' : 'Abrir e editar meta ›';
  const totalSavedLabel =
    locale === 'en'
      ? 'Total saved across goals'
      : locale === 'es'
        ? 'Total ahorrado en metas'
        : 'Total guardado nas metas';

  // 1) Sem metas ainda ou clicou em "+ Nova meta": formulário de criação.
  if (goals.length === 0 || novo === '1') {
    return (
      <PageFrame size="analytics">
        <BackLink href={goals.length > 0 ? listHref : backHref} label={t.common.back} />
        <h1 className="font-display text-[24px] leading-[30px] font-extrabold lg:text-[28px] lg:leading-[34px]">
          {p.newTitle}
        </h1>
        <div className="flex max-w-[560px] flex-col gap-4">
          {goals.length === 0 && (
            <div className="flex items-center gap-1.5 rounded-2xl bg-amarelo-claro py-3 pr-3.5 pl-1.5 text-tinta">
              <Mascot pose="professor" size={72} alt="" />
              <p className="text-[15px] leading-[21px]">{p.emptyTip}</p>
            </div>
          )}
          <GoalForm goal={null} voltar={voltarParam} t={p.form} locale={locale} showPresets={goals.length === 0} />
        </div>
      </PageFrame>
    );
  }

  // 2) Lista geral de metas (/meta sem ?id=...): clicar em qualquer meta abre a tela separada dela (/meta?id=...).
  if (!selected) {
    const totalSaved = goals.reduce((acc, g) => acc + g.savedInCents, 0);
    const totalTarget = goals.reduce((acc, g) => acc + (g.amountInCents ?? 0), 0);
    return (
      <PageFrame size="analytics" className="pb-24 md:pb-0">
        <BackLink href={backHref} label={t.common.back} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-[26px] leading-[30px] font-extrabold lg:text-[30px] lg:leading-[34px]">
            {myGoalsTitle}
          </h1>
          {goals.length < 10 && (
            <Link
              href={metaUrl({ novo: true, voltar: voltarParam })}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-laranja px-4 text-sm font-bold text-tinta-fixa no-underline transition hover:opacity-95"
            >
              <span aria-hidden="true">+</span>
              <span>{newGoalBtnLabel}</span>
            </Link>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-linha bg-cartao p-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-tinta-suave">{totalSavedLabel}</span>
            <span className="font-display text-[24px] leading-7 font-extrabold tabular-nums">
              {money(totalSaved)}
              {totalTarget > 0 && (
                <span className="ml-1.5 font-sans text-sm font-semibold text-tinta-suave">/ {money(totalTarget)}</span>
              )}
            </span>
          </div>
          <span className="rounded-full bg-papel-2 px-3 py-1 text-xs font-bold text-tinta tabular-nums">
            {goals.length} {goals.length === 1 ? 'meta' : 'metas'}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {goals.map((item, idx) => {
            const goalKey = item.id ?? String(idx);
            const itemPct = item.amountInCents
              ? Math.min(100, Math.round((item.savedInCents / item.amountInCents) * 100))
              : 0;
            const itemLeft = item.amountInCents ? Math.max(0, item.amountInCents - item.savedInCents) : 0;
            return (
              <Link
                key={goalKey}
                href={metaUrl({ id: goalKey, voltar: voltarParam })}
                className="flex min-w-0 flex-col gap-3 rounded-[22px] border border-linha bg-cartao p-4 text-tinta no-underline transition-colors hover:bg-papel-2/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-menta-clara text-tinta"
                    >
                      <Icon src={`meta/${item.kind || 'outro'}`} size={28} />
                    </span>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-[16px] font-bold">{item.label}</span>
                      <span className="text-xs text-tinta-suave tabular-nums">
                        {money(item.savedInCents)}
                        {item.amountInCents ? ` ${p.ofTarget(money(item.amountInCents))}` : ''}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-papel-2 px-2.5 py-1 text-xs font-bold tabular-nums">
                    {itemPct}%
                  </span>
                </div>

                <div className="h-2.5 overflow-hidden rounded-full bg-papel-2">
                  <div className="h-full rounded-full bg-menta" style={{ width: `${itemPct}%` }} />
                </div>

                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-tinta-suave">
                    {item.reached
                      ? p.reachedBold
                      : item.deadline
                        ? `${prazo(item.deadline, locale)}${item.monthlyNeededInCents ? ` · ${money(item.monthlyNeededInCents)}/mês` : ''}`
                        : itemLeft > 0
                          ? `Faltam ${money(itemLeft)}`
                          : ''}
                  </span>
                  <span className="shrink-0 font-semibold text-laranja-texto">{openGoalLabel}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </PageFrame>
    );
  }

  // 3) Tela separada de UMA meta específica (/meta?id=...).
  const active = selected;
  const selfHref = metaUrl({ id: active.id ?? id, voltar: voltarParam });

  if (editar === '1') {
    return (
      <PageFrame size="analytics">
        <BackLink href={selfHref} label={t.common.back} />
        <h1 className="font-display text-[24px] leading-[30px] font-extrabold lg:text-[28px] lg:leading-[34px]">
          {p.editTitle}
        </h1>
        <div className="flex max-w-[560px] flex-col gap-4">
          <GoalForm
            goal={active}
            goalId={active.id}
            voltar={voltarParam}
            kind={active.kind}
            t={p.form}
            locale={locale}
          />
          <form action={deleteGoal}>
            {active.id && <input type="hidden" name="id" value={active.id} />}
            {voltarParam && <input type="hidden" name="voltar" value={voltarParam} />}
            <ConfirmSubmitButton
              title={t.system.deleteGoalTitle}
              description={`${t.system.deleteGoalBody} ${t.system.confirmIrreversible}`}
              confirmLabel={p.deleteGoal}
              cancelLabel={t.common.cancel}
              className="w-full py-2 text-sm font-semibold text-vermelho-texto underline"
            >
              {p.deleteGoal}
            </ConfirmSubmitButton>
          </form>
        </div>
      </PageFrame>
    );
  }

  const pct = active.amountInCents ? Math.min(100, Math.round((active.savedInCents / active.amountInCents) * 100)) : 0;
  const falta = active.amountInCents ? Math.max(0, active.amountInCents - active.savedInCents) : 0;

  return (
    <PageFrame size="analytics" className="pb-24 md:pb-0">
      <BackLink href={listHref} label={myGoalsTitle} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-menta-clara text-tinta"
          >
            <Icon src={`meta/${active.kind || 'outro'}`} size={28} />
          </span>
          <h1 className="min-w-0 truncate font-display text-[24px] leading-[30px] font-extrabold lg:text-[28px] lg:leading-[34px]">
            {active.label}
          </h1>
        </div>
        <Link
          href={metaUrl({ id: active.id ?? id, editar: true, voltar: voltarParam })}
          className="inline-flex h-10 items-center gap-1.5 rounded-full border border-linha bg-cartao px-4 text-sm font-semibold text-tinta no-underline transition hover:bg-papel-2"
        >
          {t.common.edit}
        </Link>
      </div>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-6">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-[20px] border border-linha bg-cartao p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-display text-[28px] font-extrabold tabular-nums">{money(active.savedInCents)}</span>
              {active.amountInCents && (
                <span className="text-sm text-tinta-suave tabular-nums">{p.ofTarget(money(active.amountInCents))}</span>
              )}
            </div>
            <div
              className="h-3 overflow-hidden rounded-full bg-papel-2"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={p.progressAria(pct)}
            >
              <div className="bar-fill h-full rounded-full bg-menta" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[13px] font-semibold text-tinta-suave">
              {pct}%{active.deadline ? p.deadlinePrefix(prazo(active.deadline, locale)) : ''}
            </span>
          </div>

          {active.reached ? (
            <div className="flex items-center gap-1.5 rounded-2xl bg-menta-clara py-3 pr-3.5 pl-1.5 text-tinta">
              <Confetti />
              <Mascot pose="comemorando" size={76} alt="Tostão" />
              <p className="text-[15px] leading-[21px]">
                <b>{p.reachedBold}</b> {p.reachedBody(money(active.savedInCents))}
              </p>
            </div>
          ) : (
            active.monthlyNeededInCents !== null && (
              <div
                className={`flex items-center gap-1.5 rounded-2xl py-3 pr-3.5 pl-1.5 text-tinta ${active.fits === false ? 'bg-rosa' : 'bg-amarelo-claro'}`}
              >
                <Mascot pose={active.fits === false ? 'preocupado' : 'professor'} size={72} alt="" />
                <p className="text-[15px] leading-[21px]">
                  {p.leftSummary(money(falta), money(active.monthlyNeededInCents), monthName(active.deadline!, locale))}
                  {active.fits === true && p.fitsTrue}
                  {active.fits === false && p.fitsFalse}
                  {active.fits === null && (
                    <>
                      {' '}
                      <Link
                        href={`/renda?voltar=${encodeURIComponent(selfHref)}`}
                        className="font-semibold text-laranja-texto"
                      >
                        {p.fitsNullCta}
                      </Link>
                      {p.fitsNullAfter}
                    </>
                  )}
                </p>
              </div>
            )
          )}

          {/* Edição e exclusão direto na tela da meta, sem precisar caçar botão. */}
          <details className="group rounded-2xl border border-linha bg-cartao p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between text-[15px] font-bold text-tinta [&::-webkit-details-marker]:hidden">
              <span>{p.editTitle}</span>
              <span className="text-sm font-semibold text-laranja-texto group-open:hidden">{t.common.edit} ›</span>
            </summary>
            <div className="mt-4 flex flex-col gap-4 border-t border-linha pt-4">
              <GoalForm
                goal={active}
                goalId={active.id}
                voltar={voltarParam}
                kind={active.kind}
                t={p.form}
                locale={locale}
              />
              <form action={deleteGoal}>
                {active.id && <input type="hidden" name="id" value={active.id} />}
                {voltarParam && <input type="hidden" name="voltar" value={voltarParam} />}
                <ConfirmSubmitButton
                  title={t.system.deleteGoalTitle}
                  description={`${t.system.deleteGoalBody} ${t.system.confirmIrreversible}`}
                  confirmLabel={p.deleteGoal}
                  cancelLabel={t.common.cancel}
                  className="w-full py-2 text-sm font-semibold text-vermelho-texto underline"
                >
                  {p.deleteGoal}
                </ConfirmSubmitButton>
              </form>
            </div>
          </details>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <DepositForm goalId={active.id} t={p.form} locale={locale} />
          <Link
            href={`/investir?de=meta&voltar=${encodeURIComponent(selfHref)}${falta ? `&centavos=${Math.min(falta, active.monthlyNeededInCents ?? falta)}` : ''}`}
            className="flex items-center gap-3 rounded-2xl border border-linha bg-cartao p-3.5 text-tinta no-underline"
          >
            <Icon src="meta/reserva" size={40} />
            <span className="flex min-w-0 grow flex-col">
              <span className="text-[15px] font-bold">{p.whereToKeepTitle}</span>
              <span className="text-xs text-tinta-suave">{p.whereToKeepSub}</span>
            </span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="shrink-0 text-tinta-suave"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
          <p className="text-xs leading-[18px] text-tinta-suave">{p.disclaimer}</p>
        </div>
      </div>
    </PageFrame>
  );
}
