import Link from 'next/link';
import type { PeopleResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { money, shortDate } from '@/lib/format';
import { BackLink } from '@/components/ui';
import { Mascote } from '@/components/mascote';
import { EntryForm } from './entry-form';

/** Caderninho de acertos: quem te deve e pra quem você deve. */
export default async function AcertosPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const r = await api<PeopleResponse>('/people').catch((): PeopleResponse => ({ people: [], owedToYouInCents: 0, youOweInCents: 0 }));
  const abertos = r.people.filter((p) => p.balanceInCents !== 0);
  const quitados = r.people.filter((p) => p.balanceInCents === 0);
  return (
    <div className="flex flex-col gap-4 pb-24 md:pb-0">
      <BackLink href="/inicio" />
      <h1 className="font-display text-[30px] leading-[34px] font-extrabold">Acertos</h1>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-0.5 rounded-2xl bg-menta-clara p-3.5">
          <span className="text-xs font-semibold text-tinta-suave">Te devem</span>
          <span className="font-display text-[24px] leading-7 font-extrabold tabular-nums">{money(r.owedToYouInCents)}</span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-2xl bg-rosa p-3.5">
          <span className="text-xs font-semibold text-tinta-suave">Você deve</span>
          <span className="font-display text-[24px] leading-7 font-extrabold tabular-nums">{money(r.youOweInCents)}</span>
        </div>
      </div>

      {r.people.length === 0 ? (
        <div className="flex items-center gap-2 rounded-2xl bg-amarelo-claro py-3 pr-3.5 pl-1.5">
          <Mascote pose="pensando" size={72} alt="" />
          <p className="text-[15px] leading-[21px]">Emprestou o cartão ou uma grana? Abre o lançamento na Carteira e toca em <b>“Não é minha”</b>, ou anota aqui embaixo. Isso sai dos seus gastos e eu fico de olho em quem te deve.</p>
        </div>
      ) : (
        <ul className="flex flex-col rounded-2xl border border-linha bg-cartao px-3.5">
          {[...abertos, ...quitados].map((p) => (
            <li key={p.id} className="border-b border-linha last:border-b-0">
              <Link href={`/acertos/${p.id}`} className="flex min-h-[58px] items-center gap-3 text-tinta no-underline">
                <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-papel-2 font-display text-[15px] font-extrabold">{p.name.charAt(0).toUpperCase()}</span>
                <span className="flex min-w-0 grow flex-col">
                  <span className="truncate text-[15px] font-semibold">{p.name}</span>
                  <span className="text-xs text-tinta-suave">{p.balanceInCents > 0 ? 'te deve' : p.balanceInCents < 0 ? 'você deve' : 'tudo certo'} · {p.count} {p.count === 1 ? 'lançamento' : 'lançamentos'}{p.lastAt ? ` · ${shortDate(p.lastAt)}` : ''}</span>
                </span>
                <span className={`shrink-0 text-[15px] font-bold tabular-nums ${p.balanceInCents > 0 ? 'text-verde-texto' : p.balanceInCents < 0 ? 'text-vermelho-texto' : 'text-tinta-suave'}`}>{money(Math.abs(p.balanceInCents))} ›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="flex flex-col gap-2.5 rounded-2xl border border-linha bg-cartao p-3.5">
        <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">Anotar acerto</span>
        {erro && <p role="alert" className="rounded-xl bg-rosa px-3 py-2 text-sm font-medium">{erro}</p>}
        <EntryForm people={r.people.map((p) => p.name)} />
        <p className="text-xs text-tinta-suave">Pix e compras no cartão você marca direto no lançamento, na Carteira. Aqui é pro que foi em dinheiro vivo ou de boca.</p>
      </section>
    </div>
  );
}
