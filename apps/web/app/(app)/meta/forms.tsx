'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import { playSound } from '@/lib/sons';
import { useToast } from '@/components/toast';
import { useFormStatus } from 'react-dom';
import type { GoalStatus } from '@tostao/contracts';
import { money, parseMoney } from '@/lib/format';
import { getDictionary, type Dictionary, type Locale } from '@/lib/i18n';
import {
  GOAL_PRESETS,
  MONTHLY_CHIPS_IN_CENTS,
  monthlyNeeded,
  monthsToReach,
  projectedMonth,
  projectionLabel,
} from '@/lib/meta-simulation';
import { deposit, saveGoal, type GoalState } from './actions';

const field =
  'h-12 min-w-0 rounded-xl border-[1.5px] border-linha bg-cartao px-4 text-base text-tinta outline-none focus:border-tinta';
const pill = (on: boolean) =>
  `rounded-full px-3.5 py-2 text-sm font-semibold ${on ? 'bg-tinta text-papel' : 'bg-papel-2 text-tinta'}`;
const toMoney = (c: number) =>
  (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Submit({ children, className }: { children: React.ReactNode; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-60`}>
      {pending ? '…' : children}
    </button>
  );
}

/** Criar ou editar uma meta. Criando, mostra a simulação ao vivo (e, no estado vazio, os presets). */
export function GoalForm({
  goal,
  goalId,
  voltar,
  kind: initialKind,
  t,
  locale = 'pt-BR',
  showPresets = false,
}: {
  goal: GoalStatus | null;
  goalId?: string;
  voltar?: string;
  kind?: string;
  t?: Dictionary['pages']['meta']['form'];
  locale?: Locale;
  /** Estado vazio (primeira meta): atalhos clicáveis que já preenchem tipo, nome, valor e quanto guardar. */
  showPresets?: boolean;
}) {
  const dict = getDictionary(locale);
  const labels = t ?? dict.pages.meta.form;
  const g = dict.growth.goal;
  const KINDS = [
    ['reserva', labels.kinds.reserva],
    ['viagem', labels.kinds.viagem],
    ['sair-do-vermelho', labels.kinds['sair-do-vermelho']],
    ['outro', labels.kinds.outro],
  ] as const;
  const [state, action] = useActionState<GoalState, FormData>(saveGoal, {});
  const [kind, setKind] = useState(initialKind ?? goal?.kind ?? 'viagem');
  const [name, setName] = useState(goal?.label ?? '');
  const [amount, setAmount] = useState(goal?.amountInCents ? toMoney(goal.amountInCents) : '');
  const [deadline, setDeadline] = useState(goal?.deadline ?? '');
  const [monthly, setMonthly] = useState('');
  const [presetId, setPresetId] = useState<string | null>(null);

  const simulate = goal === null;
  const targetCents = parseMoney(amount) ?? 0;
  const monthlyCents = parseMoney(monthly) ?? 0;
  const months = simulate ? monthsToReach({ targetCents, monthlyCents }) : null;
  const now = new Date();
  const reachMonth = months && months > 0 ? projectedMonth(now, months) : null;
  const needed = simulate && deadline ? monthlyNeeded({ targetCents, deadline, now }) : null;
  const coveredIn12 = targetCents > 0 ? Math.min(100, Math.round(((monthlyCents * 12) / targetCents) * 100)) : 0;

  function applyPreset(id: (typeof GOAL_PRESETS)[number]['id']) {
    const preset = GOAL_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setKind(preset.kind);
    setName(g.presets[id].name);
    setAmount(toMoney(preset.amountInCents));
    setMonthly(toMoney(preset.monthlyInCents));
    setDeadline('');
  }

  return (
    <form action={action} className="flex flex-col gap-3.5">
      {goalId && <input type="hidden" name="id" value={goalId} />}
      {voltar && <input type="hidden" name="voltar" value={voltar} />}
      <input type="hidden" name="kind" value={kind} />
      {showPresets && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">{g.presetsTitle}</legend>
          <div className="grid grid-cols-2 gap-2">
            {GOAL_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                aria-pressed={presetId === preset.id}
                onClick={() => applyPreset(preset.id)}
                className={`flex min-h-[52px] flex-col items-start justify-center gap-0.5 rounded-2xl border-[1.5px] px-3.5 py-2 text-left ${
                  presetId === preset.id ? 'border-tinta bg-amarelo-claro' : 'border-linha bg-cartao'
                }`}
              >
                <span className="text-sm font-bold">{g.presets[preset.id].label}</span>
                <span className="text-xs text-tinta-suave tabular-nums">{money(preset.amountInCents)}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-tinta-suave">{g.presetNote}</p>
        </fieldset>
      )}
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-2 text-sm font-semibold">{labels.purposeLegend}</legend>
        {KINDS.map(([k, l]) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={pill(kind === k)}
          >
            {l}
          </button>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        {labels.nameLabel}
        <input
          name="label"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder={labels.namePlaceholder}
          className={field}
        />
      </label>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {labels.amountLabel}
          <input
            name="amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="R$ 0,00"
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {labels.deadlineLabel}
          <input
            name="deadline"
            type="month"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className={`${field} px-2.5`}
          />
        </label>
      </div>

      {simulate && (
        <section aria-label={g.liveAria} className="flex flex-col gap-2.5 rounded-2xl bg-menta-clara p-3.5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="meta-monthly" className="text-sm font-semibold">
              {g.monthlyLabel}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="meta-monthly"
                inputMode="decimal"
                value={monthly}
                onChange={(e) => setMonthly(e.target.value)}
                placeholder="R$ 0,00"
                className={`${field} h-11 w-32 shrink-0`}
              />
              {MONTHLY_CHIPS_IN_CENTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setMonthly(toMoney(c))}
                  className={pill(monthlyCents === c)}
                >
                  {money(c)}
                </button>
              ))}
            </div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-cartao" aria-hidden="true">
            <div className="h-full rounded-full bg-tinta transition-all" style={{ width: `${coveredIn12}%` }} />
          </div>
          <p aria-live="polite" className="text-[15px] leading-[21px] font-semibold">
            {months === 0
              ? g.reachedNow
              : months && reachMonth
                ? g.projection(money(monthlyCents), projectionLabel(reachMonth, dict.months))
                : g.projectionNone}
          </p>
          {reachMonth && (
            <button
              type="button"
              onClick={() => setDeadline(reachMonth)}
              className="self-start text-[13px] font-semibold underline"
            >
              {g.useDeadline}
            </button>
          )}
          {needed !== null && needed > 0 && (
            <p className="text-[13px] text-tinta-suave tabular-nums">{g.neededForDeadline(money(needed))}</p>
          )}
        </section>
      )}

      {state.error && (
        <p role="alert" className="text-sm font-semibold text-vermelho-texto">
          {state.error}
        </p>
      )}
      <Submit className="h-[50px] rounded-full bg-tinta text-[15px] font-semibold text-papel">
        {goal ? labels.saveGoal : labels.createGoal}
      </Submit>
    </form>
  );
}

/** "Guardei" (ou "Tirei") um valor da meta selecionada. */
export function DepositForm({
  goalId,
  t,
  locale = 'pt-BR',
}: {
  goalId?: string;
  t?: Dictionary['pages']['meta']['form'];
  locale?: Locale;
}) {
  const labels = t ?? getDictionary(locale).pages.meta.form;
  const [state, action] = useActionState<GoalState, FormData>(deposit, {});
  const [dir, setDir] = useState<'guardei' | 'tirei'>('guardei');
  const [amount, setAmount] = useState('');
  const toast = useToast();
  const toastT = getDictionary(locale).growth.toast;
  // O que foi enviado por último: o "Desfazer" faz o movimento contrário com o mesmo valor.
  const last = useRef<{ dir: 'guardei' | 'tirei'; amount: string } | null>(null);
  useEffect(() => {
    if (state.message) {
      playSound('moeda');
      const sent = last.current;
      toast.success(state.message, {
        ...(sent
          ? {
              actionLabel: toastT.undo,
              onAction: async () => {
                const fd = new FormData();
                if (goalId) fd.set('goalId', goalId);
                fd.set('dir', sent.dir === 'guardei' ? 'tirei' : 'guardei');
                fd.set('amount', sent.amount);
                const res = await deposit({}, fd);
                if (res.error) toast.error(res.error);
                else toast.info(toastT.undone);
              },
            }
          : {}),
      });
    } else if (state.error) {
      playSound('erro');
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage a um novo resultado da ação
  }, [state]);
  return (
    <form
      action={async (f) => {
        last.current = { dir: f.get('dir') === 'tirei' ? 'tirei' : 'guardei', amount: String(f.get('amount') ?? '') };
        await action(f);
        setAmount('');
      }}
      className="flex flex-col gap-2.5 rounded-2xl border border-linha bg-cartao p-3.5"
    >
      {goalId && <input type="hidden" name="goalId" value={goalId} />}
      <input type="hidden" name="dir" value={dir} />
      <div className="grid grid-cols-2 gap-1 rounded-full bg-papel-2 p-1">
        {(['guardei', 'tirei'] as const).map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={dir === d}
            onClick={() => setDir(d)}
            className={`h-[38px] rounded-full text-sm font-semibold ${dir === d ? 'bg-tinta text-papel' : 'text-tinta'}`}
          >
            {d === 'guardei' ? labels.savedBtn : labels.withdrewBtn}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        {[20, 50, 100].map((v) => (
          <button key={v} type="button" onClick={() => setAmount(`${v},00`)} className={pill(amount === `${v},00`)}>
            R$ {v}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          name="amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={labels.otherAmountPlaceholder}
          aria-label={labels.amountAria}
          className={`${field} grow`}
        />
        <Submit className="h-12 shrink-0 rounded-xl bg-tinta px-5 text-[15px] font-semibold text-papel">
          {labels.logBtn}
        </Submit>
      </div>
      {state.error && (
        <p role="status" className="text-sm font-semibold text-vermelho-texto">
          {state.error}
        </p>
      )}
    </form>
  );
}
