import Link from 'next/link';
import type { SpendingBase } from '@tostao/contracts';
import { money, monthName } from '@/lib/format';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const mes = (m: string) => cap(monthName(m).slice(0, 3));

/**
 * Como o "dia a dia" foi calculado: mediana dos últimos 3 meses, sem o que foi pago com dinheiro extra.
 * Diz também se o gasto acima da renda foi exceção (acerto, 13º) ou se é aperto de verdade.
 */
export function BaseDiaADia({ base, dailyInCents }: { base: SpendingBase; dailyInCents: number }) {
  if (!base.months.length) return null;
  const pagoExtra = base.months.filter((m) => m.paidWithExtraInCents > 0);
  const tom = base.status === 'aperto' ? 'bg-rosa' : base.status === 'excecao' ? 'bg-amarelo-claro' : 'bg-menta-clara';
  return (
    <section className="flex flex-col gap-2.5 rounded-2xl border border-linha bg-cartao p-3.5">
      <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">De onde vem o dia a dia</span>
      <p className={`rounded-xl px-3 py-2.5 text-[14px] leading-5 ${tom}`}>
        {base.status === 'aperto' ? (
          <><b>Tá saindo mais do que entra.</b> Em {base.months.filter((m) => m.baseInCents > Math.max(base.normalIncomeInCents, m.incomeInCents - m.extraIncomeInCents) * 1.1).length} dos últimos {base.months.length} meses o gasto passou da sua renda sem dinheiro extra pra cobrir. <Link href="/carteira?filtro=saidas#lista" className="font-semibold text-tinta">Bora ver onde</Link>.</>
        ) : base.status === 'excecao' ? (
          <><b>Foi exceção, não hábito.</b> Em {pagoExtra.map((m) => monthName(m.month)).join(' e ')} você gastou mais que a renda, mas com um dinheiro extra que entrou (acerto, 13º ou parecido). Essa parte ({money(pagoExtra.reduce((s, m) => s + m.paidWithExtraInCents, 0))}) ficou fora da conta.</>
        ) : (
          <><b>Gasto dentro da renda.</b> Nos últimos meses saiu menos do que entrou.</>
        )}
      </p>
      <div className="flex flex-col text-[14px]">
        <div className="flex justify-between border-b border-linha pb-1.5 text-xs font-semibold text-tinta-suave"><span>Mês</span><span>Saiu → conta como normal</span></div>
        {base.months.map((m) => (
          <Link key={m.month} href={`/carteira?mes=${m.month}&filtro=saidas#lista`} className="flex items-center justify-between border-b border-linha py-1.5 text-tinta no-underline">
            <span className="font-semibold">{mes(m.month)} ›</span>
            <span className="tabular-nums">
              {m.paidWithExtraInCents > 0 && <span className="text-tinta-suave line-through">{money(m.outcomeInCents)}</span>}{m.paidWithExtraInCents > 0 ? ' ' : ''}{money(m.baseInCents)}
            </span>
          </Link>
        ))}
        <div className="flex justify-between pt-2 text-[14px]">
          <span className="text-tinta-suave">Seu normal (mediana)</span>
          <span className="font-semibold tabular-nums">{money(base.typicalInCents)}</span>
        </div>
        <div className="flex justify-between pt-1 text-[14px]">
          <span className="text-tinta-suave">Tirando contas, assinaturas e parcelas</span>
          <span className="font-bold tabular-nums">{money(dailyInCents)}</span>
        </div>
      </div>
    </section>
  );
}
