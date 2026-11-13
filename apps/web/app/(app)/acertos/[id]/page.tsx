import Link from 'next/link';
import type { PersonDetailResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { money, monthName, shortDate } from '@/lib/format';
import { BackLink } from '@/components/ui';
import { EntryForm } from '../entry-form';
import { apagarPessoa } from '../actions';

export default async function PessoaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string }> }) {
  const { id } = await params;
  const { erro } = await searchParams;
  const { person: p, transactions } = await api<PersonDetailResponse>(`/people/${encodeURIComponent(id)}`);
  const deve = p.balanceInCents > 0;
  const voce = p.balanceInCents < 0;
  // Resumo pronto pro WhatsApp, sem climão.
  const linhas = transactions.slice(0, 15).map((t) => `• ${shortDate(t.occurredAt)} ${t.description}: ${t.amountInCents < 0 ? '' : '−'}${money(Math.abs(t.amountInCents))}`);
  const texto = deve
    ? `Oi, ${p.name}! Fiz as contas do que tá no meu nome:\n${linhas.join('\n')}\nTotal: ${money(p.balanceInCents)}. Me manda quando der? 🙏`
    : voce ? `Oi, ${p.name}! Anotei aqui que te devo ${money(-p.balanceInCents)}. Já já te acerto.` : '';
  const back = `/acertos/${p.id}`;
  return (
    <div className="flex flex-col gap-4 pb-24 md:pb-0">
      <BackLink href="/acertos" label="Acertos" />
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[30px] leading-[34px] font-extrabold">{p.name}</h1>
        <div className={`flex flex-col gap-0.5 rounded-2xl p-3.5 ${deve ? 'bg-menta-clara' : voce ? 'bg-rosa' : 'bg-papel-2'}`}>
          <span className="text-xs font-semibold text-tinta-suave">{deve ? `${p.name} te deve` : voce ? `Você deve pra ${p.name}` : 'Tudo acertado'}</span>
          <span className="font-display text-[28px] leading-8 font-extrabold tabular-nums">{money(Math.abs(p.balanceInCents))}</span>
        </div>
      </div>

      {texto && (
        <a href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener noreferrer"
          className="flex h-[50px] items-center justify-center rounded-full border-[1.5px] border-tinta text-[15px] font-semibold text-tinta no-underline">
          {deve ? 'Mandar resumo no WhatsApp' : 'Avisar no WhatsApp'}
        </a>
      )}

      <section className="flex flex-col gap-2">
        <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">Histórico</span>
        <ul className="flex flex-col rounded-2xl border border-linha bg-cartao px-3.5">
          {transactions.map((t) => (
            <li key={t.id} className="border-b border-linha last:border-b-0">
              <Link href={`/carteira/${t.id}?voltar=${encodeURIComponent(back)}`} className="flex min-h-[54px] items-center gap-3 text-tinta no-underline">
                <span className="flex min-w-0 grow flex-col">
                  <span className="truncate text-[15px] font-semibold">{t.description}</span>
                  <span className="text-xs text-tinta-suave">{shortDate(t.occurredAt)} · {t.accountName ?? 'Anotado'} · {t.amountInCents < 0 ? (t.accountName ? 'saiu de você' : 'emprestei/paguei') : 'entrou pra você'}</span>
                </span>
                <span className={`shrink-0 text-[15px] font-semibold tabular-nums ${t.amountInCents > 0 ? 'text-verde-texto' : ''}`}>{t.amountInCents > 0 ? '+ ' : ''}{money(Math.abs(t.amountInCents))}</span>
              </Link>
            </li>
          ))}
          {transactions.length === 0 && <li className="py-4 text-sm text-tinta-suave">Nada anotado com {p.name} ainda.</li>}
        </ul>
        <p className="text-xs text-tinta-suave">Saiu de você (compra no seu cartão, Pix que você mandou) aumenta o que {p.name} te deve. Entrou (Pix de {p.name}) abate. Nada disso conta como seu gasto ou renda de {monthName(new Date().toISOString().slice(0, 7))}.</p>
      </section>

      <section className="flex flex-col gap-2.5 rounded-2xl border border-linha bg-cartao p-3.5">
        <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">Anotar acerto com {p.name}</span>
        {erro && <p role="alert" className="rounded-xl bg-rosa px-3 py-2 text-sm font-medium">{erro}</p>}
        <EntryForm personId={p.id} />
      </section>

      <form action={apagarPessoa} className="self-center">
        <input type="hidden" name="personId" value={p.id} />
        <button type="submit" className="min-h-11 text-[13px] font-semibold text-vermelho-texto">Apagar {p.name} dos acertos</button>
      </form>
    </div>
  );
}
