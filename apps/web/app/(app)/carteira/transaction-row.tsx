import Link from 'next/link';
import type { TransactionDTO } from '@tostao/contracts';
import { money, shortDate } from '@/lib/format';

/** Barra de busca da Carteira. Formulário comum (GET), funciona até sem JavaScript. */
export function SearchBar({ q = '', autoFocus = false, hidden = {} }: { q?: string; autoFocus?: boolean; hidden?: Record<string, string> }) {
  return (
    <form action="/carteira/busca" role="search" className="flex h-11 items-center gap-2 rounded-full border border-linha bg-cartao px-4">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="shrink-0 text-tinta-suave"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
      <input name="q" type="search" defaultValue={q} autoFocus={autoFocus} placeholder="Buscar loja, pessoa, categoria…" aria-label="Buscar transações"
        className="min-w-0 flex-1 bg-transparent text-[15px] text-tinta outline-none placeholder:text-tinta-suave" />
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
    </form>
  );
}

export function Chevron({ d }: { d: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

export function Row({ t, back, showDate = false }: { t: TransactionDTO; back: string; showDate?: boolean }) {
  const pending = !t.categoryId && !t.isInternalTransfer;
  const sub = t.categoryId === 'nao-conta' ? `Não conta · ${t.accountName ?? 'anotado na mão'}`
    : t.isInternalTransfer ? 'Entre suas contas · não conta como gasto'
    : pending ? 'Sem categoria · toque pra categorizar'
      : [t.categoryName, t.accountName ?? 'Anotado na mão'].filter(Boolean).join(' · ');
  const line = showDate ? `${shortDate(t.occurredAt)} · ${sub}` : sub;
  const icon = pending ? '?' : t.isInternalTransfer ? '⇄' : t.categoryEmoji ?? (t.amountInCents > 0 ? '↓' : '↑');
  const bg = pending ? undefined : t.isInternalTransfer ? undefined : t.categoryColor ?? undefined;
  return (
    <Link href={`/carteira/${t.id}?voltar=${encodeURIComponent(back)}`}
      className={`flex min-h-[58px] items-center gap-3 border-b border-linha py-2 text-tinta no-underline last:border-b-0 ${t.isInternalTransfer ? 'opacity-60' : ''}`}>
      <div className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl text-lg font-bold text-[#1E1B18] ${pending ? 'bg-rosa' : bg ? '' : 'bg-papel-2'}`} style={bg ? { background: bg } : undefined} aria-hidden="true">
        {icon}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-semibold">{t.description}</span>
        <span className={`truncate text-xs ${pending ? 'font-semibold text-laranja-texto' : 'text-tinta-suave'}`}>{line}</span>
      </div>
      <span className={`shrink-0 text-[15px] tabular-nums ${t.amountInCents > 0 ? 'font-bold text-verde-texto' : 'font-semibold'}`}>
        {t.amountInCents > 0 ? '+ ' : ''}{money(Math.abs(t.amountInCents))}
      </span>
    </Link>
  );
}
