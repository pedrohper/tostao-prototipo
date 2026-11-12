'use client';
import { useActionState, useState } from 'react';
import Link from 'next/link';
import type { FinancialPlan, IncomeSuggestion } from '@tostao/contracts';
import { Mascote } from '@/components/mascote';
import { ErrorNote, Eyebrow } from '@/components/ui';
import { pill } from '@/components/sheet';
import { money, parseMoney } from '@/lib/format';
import { savePlan, type PlanState } from './actions';

const field = 'h-12 min-w-0 rounded-xl border-[1.5px] border-linha bg-cartao px-4 text-base text-tinta outline-none focus:border-tinta';
const seg = (on: boolean) => `flex h-[38px] items-center justify-center rounded-full px-2 text-sm font-semibold ${on ? 'bg-tinta text-papel' : 'text-tinta'}`;
const toMoney = (c: number) => (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: 'numeric', month: 'short' }).replace('.', '');
const GOALS = [['reserva', 'Montar reserva'], ['viagem', 'Viajar'], ['sair-do-vermelho', 'Sair do vermelho'], ['outro', 'Outro']] as const;

type Other = { name: string; amount: string; day: string; mode: 'renda' | 'repasse' | 'ignorar'; pattern: string | null };
type Fixed = { name: string; amount: string; day: string };

function Steps({ n }: { n: number }) {
  return (
    <div className="flex grow gap-1.5" role="img" aria-label={`Passo ${n} de 2`}>
      {[1, 2].map((i) => <i key={i} className={`h-1.5 grow rounded-full ${i <= n ? 'bg-tinta' : 'bg-linha'}`} />)}
    </div>
  );
}
const Back = ({ onClick, href }: { onClick?: () => void; href?: string }) => {
  const icon = <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>;
  const cls = '-ml-2.5 flex h-11 w-11 shrink-0 items-center justify-center text-tinta';
  return href ? <Link href={href} aria-label="Voltar" className={cls}>{icon}</Link> : <button type="button" onClick={onClick} aria-label="Voltar" className={cls}>{icon}</button>;
};

export function RendaForm({ plan, suggestions, banks }: { plan: FinancialPlan | null; suggestions: IncomeSuggestion[]; banks: string[] }) {
  const [state, action, pending] = useActionState<PlanState, FormData>(savePlan, {});
  const [step, setStep] = useState(1);
  const firstSalary = plan?.salary?.pattern ?? suggestions.find((s) => /SAL|FOLHA|PROVENTO/.test(s.pattern))?.pattern ?? null;
  const [salaryPattern, setSalaryPattern] = useState<string | null>(firstSalary);
  const guess = suggestions.find((s) => s.pattern === firstSalary);
  const [amount, setAmount] = useState(plan?.salary ? toMoney(plan.salary.amountInCents) : guess ? toMoney(guess.monthlyAvgInCents) : '');
  const [payday, setPayday] = useState(String(plan?.salary?.payday ?? (guess ? new Date(guess.hits[guess.hits.length - 1]!.date).getUTCDate() : 5)));
  const [varies, setVaries] = useState(plan?.salary?.varies ?? (guess ? guess.hits.length > guess.months : false));
  const [advanceOn, setAdvanceOn] = useState(!!plan?.salary?.advance);
  const [advanceDay, setAdvanceDay] = useState(String(plan?.salary?.advance?.day ?? 15));
  const [advanceAmount, setAdvanceAmount] = useState(plan?.salary?.advance ? toMoney(plan.salary.advance.amountInCents) : '');
  const [vr, setVr] = useState(() => { const b = plan?.benefits?.find((x) => x.kind === 'VR'); return { amount: b ? toMoney(b.amountInCents) : '', day: String(b?.day ?? 1) }; });
  const [va, setVa] = useState(() => { const b = plan?.benefits?.find((x) => x.kind === 'VA'); return { amount: b ? toMoney(b.amountInCents) : '', day: String(b?.day ?? 1) }; });
  const [bank, setBank] = useState<string | null>(plan?.salary?.bank ?? guess?.bank?.replace(/\s*\(.*\)$/, '') ?? banks[0] ?? null);

  const initialOthers: Other[] = plan
    ? plan.otherIncomes.map((i) => ({ name: i.name, amount: toMoney(i.amountInCents), day: i.day ? String(i.day) : '', mode: i.countsAsIncome ? 'renda' : 'repasse', pattern: i.pattern }))
    : suggestions.filter((s) => s.pattern !== firstSalary).slice(0, 3).map((s) => ({ name: s.sample.slice(0, 40), amount: toMoney(s.monthlyAvgInCents), day: String(new Date(s.hits[0]!.date).getUTCDate()), mode: !s.countsAsIncome ? 'repasse' : /^PIX RECEBIDO/.test(s.pattern) ? 'ignorar' : 'renda', pattern: s.pattern }));
  const [others, setOthers] = useState<Other[]>(initialOthers);
  const [fixed, setFixed] = useState<Fixed[]>(plan?.fixedExpenses.map((f) => ({ name: f.name, amount: toMoney(f.amountInCents), day: String(f.day) })) ?? []);
  const [goal, setGoal] = useState<string | null>(plan?.goal?.kind ?? null);
  const [goalAmount, setGoalAmount] = useState(plan?.goal?.amountInCents ? toMoney(plan.goal.amountInCents) : '');
  const [goalDate, setGoalDate] = useState(plan?.goal?.deadline ?? '');

  const pickSalary = (s: IncomeSuggestion) => {
    const on = salaryPattern === s.pattern;
    setSalaryPattern(on ? null : s.pattern);
    if (!on) {
      setAmount(toMoney(s.monthlyAvgInCents));
      setVaries(s.hits.length > s.months);
      if (s.bank) setBank(s.bank.replace(/\s*\(.*\)$/, ''));
      setOthers((o) => o.filter((x) => x.pattern !== s.pattern));
    }
  };
  const updOther = (i: number, patch: Partial<Other>) => setOthers((o) => o.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const updFixed = (i: number, patch: Partial<Fixed>) => setFixed((o) => o.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const dayNum = (d: string) => Math.min(31, Math.max(1, Number(d) || 1));

  const salaryCents = parseMoney(amount);
  const payload: FinancialPlan = {
    salary: salaryCents ? {
      amountInCents: salaryCents, payday: dayNum(payday), varies, bank, pattern: salaryPattern,
      advance: advanceOn ? { day: dayNum(advanceDay), amountInCents: Math.min(salaryCents, parseMoney(advanceAmount) ?? Math.round(salaryCents / 2)) } : null,
    } : null,
    otherIncomes: others.filter((o) => o.mode !== 'ignorar' && o.name.trim() && parseMoney(o.amount)).map((o) => ({ name: o.name.trim(), amountInCents: parseMoney(o.amount)!, day: o.day ? dayNum(o.day) : null, countsAsIncome: o.mode === 'renda', pattern: o.pattern })),
    benefits: ([['VR', vr], ['VA', va]] as const).filter(([, b]) => parseMoney(b.amount)).map(([kind, b]) => ({ kind, amountInCents: parseMoney(b.amount)!, day: dayNum(b.day) })),
    fixedExpenses: fixed.filter((f) => f.name.trim() && parseMoney(f.amount)).map((f) => ({ name: f.name.trim(), amountInCents: parseMoney(f.amount)!, day: dayNum(f.day) })),
    goal: goal ? { kind: goal as 'reserva', label: GOALS.find(([k]) => k === goal)?.[1] ?? null, amountInCents: parseMoney(goalAmount), deadline: /^\d{4}-\d{2}$/.test(goalDate) ? goalDate : null } : null,
  };

  if (step === 1) {
    return (
      <div className="flex flex-col gap-3.5">
        <div className="flex items-center gap-2"><Back href="/perfil" /><Steps n={1} /></div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-[28px] leading-8 font-extrabold">Quanto entra por mês?</h1>
            <p className="text-sm leading-5 text-tinta-suave">Com isso eu consigo prever os próximos meses e o chat para de chutar.</p>
          </div>
          <Mascote pose="acenando" size={80} alt="Tostão acenando" />
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold">Salário líquido</span>
          <span className="flex items-baseline gap-1.5 border-b-2 border-tinta pb-1">
            <span className="font-display text-[26px] font-extrabold">R$</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00" className="min-w-0 grow bg-transparent font-display text-[38px] leading-[42px] font-extrabold text-tinta outline-none placeholder:text-linha" />
          </span>
        </label>
        <div className="grid grid-cols-[110px_minmax(0,1fr)] items-end gap-2.5">
          <label className="flex flex-col gap-[5px]">
            <span className="text-[13px] font-semibold">Dia do salário</span>
            <input type="number" min={1} max={31} value={payday} onChange={(e) => setPayday(e.target.value)} className={field} />
          </label>
          <div className="flex flex-col gap-[5px]">
            <span className="text-[13px] font-semibold">O valor</span>
            <div className="grid grid-cols-2 gap-1 rounded-full bg-papel-2 p-1">
              <button type="button" onClick={() => setVaries(false)} aria-pressed={!varies} className={seg(!varies)}>É fixo</button>
              <button type="button" onClick={() => setVaries(true)} aria-pressed={varies} className={seg(varies)}>Varia</button>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2.5 rounded-2xl bg-papel-2 px-3.5 py-3">
          <label className="flex min-h-8 cursor-pointer items-center gap-2.5">
            <input type="checkbox" checked={advanceOn} onChange={(e) => { setAdvanceOn(e.target.checked); if (e.target.checked && !advanceAmount && salaryCents) setAdvanceAmount(toMoney(Math.round(salaryCents / 2))); }} className="h-5 w-5 shrink-0 accent-[#1E1B18]" />
            <span className="text-[15px] font-semibold">Recebo adiantamento</span>
          </label>
          {advanceOn && (
            <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2.5">
              <label className="flex flex-col gap-[5px]">
                <span className="text-[13px] font-semibold">Dia do adiantamento</span>
                <input type="number" min={1} max={31} value={advanceDay} onChange={(e) => setAdvanceDay(e.target.value)} className={field} />
              </label>
              <label className="flex flex-col gap-[5px]">
                <span className="text-[13px] font-semibold">Quanto vem</span>
                <input value={advanceAmount} onChange={(e) => setAdvanceAmount(e.target.value)} inputMode="decimal" placeholder="metade" className={field} />
              </label>
            </div>
          )}
          {advanceOn && <span className="text-xs leading-[17px] text-tinta-suave">O valor lá em cima é o total do mês: o adiantamento mais o que cai no dia do salário.</span>}
        </div>
        <div className="flex flex-col gap-2 rounded-2xl border border-linha bg-cartao px-3.5 py-3">
          <span className="text-[15px] font-semibold">VR e VA <span className="font-normal text-tinta-suave">(se tiver)</span></span>
          <span className="-mt-1 text-xs leading-[17px] text-tinta-suave">Não passam pelo Open Finance. Ficam separados: só pra comida, fora do dinheiro da conta.</span>
          {([['VR', vr, setVr], ['VA', va, setVa]] as const).map(([k, b, set]) => (
            <div key={k} className="grid grid-cols-[44px_minmax(0,1fr)_88px] items-center gap-2">
              <span className="text-sm font-bold">{k}</span>
              <input aria-label={`Valor do ${k}`} value={b.amount} onChange={(e) => set({ ...b, amount: e.target.value })} inputMode="decimal" placeholder="R$ por mês" className={field} />
              <input aria-label={`Dia que cai o ${k}`} value={b.day} onChange={(e) => set({ ...b, day: e.target.value })} inputMode="numeric" placeholder="dia" className={`${field} px-3`} />
            </div>
          ))}
        </div>
        {banks.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold">Por onde chega?</span>
            <div className="flex flex-wrap gap-2">
              {banks.map((b) => <button key={b} type="button" aria-pressed={bank === b} onClick={() => setBank(bank === b ? null : b)} className={pill(bank === b)}>{b}</button>)}
            </div>
          </div>
        )}
        {suggestions.length > 0 && (
          <div className="flex flex-col gap-0.5 rounded-2xl border border-linha bg-cartao px-3.5 py-3">
            <span className="text-sm font-bold">Achei essas entradas no extrato. Qual é o salário?</span>
            <span className="text-xs leading-[17px] text-tinta-suave">Confirmando, daqui pra frente eu marco sozinho. Pode vir em partes, tudo bem.</span>
            {suggestions.map((s) => (
              <label key={s.pattern} className="flex min-h-12 cursor-pointer items-center gap-2.5">
                <input type="checkbox" checked={salaryPattern === s.pattern} onChange={() => pickSalary(s)} className="h-5 w-5 shrink-0 accent-[#1E1B18]" />
                <span className="flex min-w-0 grow flex-col">
                  <span className="truncate font-mono text-[13px] font-semibold">{s.sample}</span>
                  <span className="text-xs text-tinta-suave">{s.hits.slice(0, 3).map((h) => day(h.date)).join(', ')}{s.bank ? ` · ${s.bank}` : ''}</span>
                </span>
                <span className="shrink-0 text-right text-sm font-bold text-verde-texto tabular-nums">{money(s.monthlyAvgInCents)}<span className="block text-[11px] font-medium text-tinta-suave">por mês</span></span>
              </label>
            ))}
          </div>
        )}
        <button type="button" onClick={() => setStep(2)} disabled={!salaryCents} className="flex h-[54px] shrink-0 items-center justify-center rounded-full bg-tinta text-base font-semibold text-papel disabled:opacity-50">Continuar</button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3.5">
      <input type="hidden" name="plan" value={JSON.stringify(payload)} />
      <div className="flex items-center gap-2"><Back onClick={() => setStep(1)} /><Steps n={2} /></div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[28px] leading-8 font-extrabold">O resto que se repete</h1>
          <p className="text-sm leading-5 text-tinta-suave">Outras entradas, contas que não passam no cartão e um objetivo.</p>
        </div>
        <Mascote pose="professor" size={80} alt="Tostão professor" />
      </div>

      <section className="flex flex-col gap-2">
        <Eyebrow>Outras entradas</Eyebrow>
        {others.map((o, i) => (
          <div key={i} className="flex flex-col gap-2.5 rounded-2xl border border-linha bg-cartao p-3.5">
            <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-2">
              <input aria-label="Nome da entrada" value={o.name} onChange={(e) => updOther(i, { name: e.target.value })} placeholder="Mesada, freela…" className={field} />
              <input aria-label="Valor por mês" value={o.amount} onChange={(e) => updOther(i, { amount: e.target.value })} inputMode="decimal" placeholder="R$" className={field} />
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-full bg-papel-2 p-1">
              {([['renda', 'É renda'], ['repasse', 'Só repasso'], ['ignorar', 'Não se repete']] as const).map(([k, l]) => (
                <button key={k} type="button" aria-pressed={o.mode === k} onClick={() => updOther(i, { mode: k })} className={seg(o.mode === k)}>{l}</button>
              ))}
            </div>
            {o.mode === 'repasse' && <span className="text-xs leading-[17px] text-tinta-suave">&quot;Só repasso&quot; tira da renda e do gasto, igual a categoria Não conta.</span>}
          </div>
        ))}
        <button type="button" onClick={() => setOthers((o) => [...o, { name: '', amount: '', day: '', mode: 'renda', pattern: null }])} className="flex min-h-11 items-center gap-2 text-[15px] font-semibold text-laranja-texto">
          <Plus />Adicionar mesada, freela, bolsa
        </button>
      </section>

      <section className="flex flex-col gap-2">
        <Eyebrow>Contas fixas fora do cartão</Eyebrow>
        <p className="-mt-1 text-[13px] text-tinta-suave">Aluguel, faculdade, celular… o que sai todo mês por Pix ou boleto.</p>
        {fixed.map((f, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_96px_64px_40px] items-center gap-1.5">
            <input aria-label="Nome da conta" value={f.name} onChange={(e) => updFixed(i, { name: e.target.value })} placeholder="Aluguel" className={field} />
            <input aria-label="Valor" value={f.amount} onChange={(e) => updFixed(i, { amount: e.target.value })} inputMode="decimal" placeholder="R$" className={`${field} px-3`} />
            <input aria-label="Dia" value={f.day} onChange={(e) => updFixed(i, { day: e.target.value })} inputMode="numeric" placeholder="dia" className={`${field} px-3`} />
            <button type="button" aria-label={`Tirar ${f.name || 'conta'}`} onClick={() => setFixed((x) => x.filter((_, k) => k !== i))} className="flex h-10 w-10 items-center justify-center text-tinta-suave">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setFixed((x) => [...x, { name: '', amount: '', day: '10' }])} className="flex min-h-11 items-center gap-2 text-[15px] font-semibold text-laranja-texto">
          <Plus />Adicionar conta fixa
        </button>
      </section>

      <section className="flex flex-col gap-2">
        <Eyebrow>Seu objetivo</Eyebrow>
        <div className="flex flex-wrap gap-2">
          {GOALS.map(([k, l]) => <button key={k} type="button" aria-pressed={goal === k} onClick={() => setGoal(goal === k ? null : k)} className={pill(goal === k)}>{l}</button>)}
        </div>
        {goal && (
          <div className="grid grid-cols-[minmax(0,1fr)_140px] gap-2">
            <input aria-label="Quanto" value={goalAmount} onChange={(e) => setGoalAmount(e.target.value)} inputMode="decimal" placeholder="R$ quanto?" className={field} />
            <input aria-label="Até quando" type="month" value={goalDate} onChange={(e) => setGoalDate(e.target.value)} className={`${field} px-2.5`} />
          </div>
        )}
      </section>

      <ErrorNote message={state.error} />
      <button type="submit" disabled={pending} className="flex h-[54px] shrink-0 items-center justify-center rounded-full bg-tinta text-base font-semibold text-papel disabled:opacity-50">
        {pending ? 'Salvando…' : 'Ver minha previsão'}
      </button>
    </form>
  );
}

function Plus() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;
}
