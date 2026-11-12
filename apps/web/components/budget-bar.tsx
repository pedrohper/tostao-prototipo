import { CatIcon } from '@/components/icone';
import type { BudgetDTO } from '@tostao/contracts';
import { money } from '@/lib/format';

/** Barra de quanto do limite já foi: menta até 80%, amarelo até 100%, laranja quando passa. */
export function BudgetBar({ budget: b }: { budget: BudgetDTO }) {
  const ratio = b.spentInCents / b.limitInCents;
  const color = ratio > 1 ? 'bg-laranja' : ratio >= 0.8 ? 'bg-amarelo' : 'bg-menta';
  const left = b.limitInCents - b.spentInCents;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between gap-2 text-[15px]">
        <span className="flex items-center gap-1.5 font-semibold"><CatIcon id={b.categoryId} emoji={b.emoji} size={20} /> {b.name}</span>
        <span className="font-bold">{money(b.spentInCents)} <span className="font-normal text-tinta-suave">de {money(b.limitInCents)}</span></span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-papel-2" role="progressbar" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${b.name}: ${Math.round(ratio * 100)}% do limite`}>
        <div className={`bar-fill h-full rounded-full ${color}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </div>
      <span className={`text-[13px] ${ratio > 1 ? 'font-semibold text-vermelho-texto' : 'text-tinta-suave'}`}>
        {ratio > 1 ? `Passou ${money(-left)} do limite` : `Ainda dá ${money(left)}`}
      </span>
    </div>
  );
}
