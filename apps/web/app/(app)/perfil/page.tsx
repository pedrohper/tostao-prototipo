import Link from 'next/link';
import type { LessonProgressResponse, ProfileResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { Mascote } from '@/components/mascote';
import { BankIcon, CardIcon, Eyebrow } from '@/components/ui';
import { money } from '@/lib/format';
import { HideAccountButton } from '../carteira/hide-account-button';
import { xpFrom } from '@/lib/xp';

const atalhos = [
  { href: '/categorias', label: 'Minhas categorias' },
  { href: '/limites', label: 'Limites do mês' },
  { href: '/fechamento', label: 'Fechamento do mês' },
  { href: '/assinaturas', label: 'Minhas assinaturas' },
  { href: '/importar', label: 'Importar extrato' },
  { href: '/convites', label: 'Convidar alguém' },
];

function synced(iso: string | null) {
  if (!iso) return 'ainda não atualizou';
  const d = new Date(iso);
  const tz = { timeZone: 'America/Sao_Paulo' } as const;
  const dia = d.toLocaleDateString('pt-BR', tz) === new Date().toLocaleDateString('pt-BR', tz)
    ? 'hoje'
    : d.toLocaleDateString('pt-BR', { ...tz, day: 'numeric', month: 'short' }).replace('.', '');
  return `atualizado ${dia}, ${d.toLocaleTimeString('pt-BR', { ...tz, hour: '2-digit', minute: '2-digit' })}`;
}

export default async function PerfilPage() {
  const [me, { done }] = await Promise.all([
    api<ProfileResponse>('/me'),
    api<LessonProgressResponse>('/progress').catch(() => ({ done: [] as string[] })),
  ]);
  const { xp, level } = xpFrom(done.length);
  const rows = 'flex min-h-12 items-center justify-between border-b border-linha text-tinta no-underline';

  return (
    <div className="flex flex-col gap-3.5">
      <h1 className="font-display text-[34px] leading-[38px] font-extrabold">Perfil</h1>
      <div className="flex items-center gap-3.5">
        <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-laranja font-display text-2xl font-extrabold text-[#1E1B18]">
          {me.name.trim().charAt(0).toUpperCase()}
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[17px] font-bold">{me.name}</span>
          <span className="text-[13px] text-tinta-suave">Nível {level} · {xp} XP · {done.length} {done.length === 1 ? 'lição feita' : 'lições feitas'}</span>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <Eyebrow>Contas conectadas</Eyebrow>
        <p className="-mt-1 text-[13px] text-tinta-suave">Conta oculta sai do saldo e das telas, mas continua atualizando.</p>
        <div className="flex flex-col rounded-2xl border border-linha bg-cartao px-3.5">
          {me.connections.map((c) => {
            const imported = c.itemId.startsWith('import:');
            return (
              <div key={c.id} className="flex flex-col border-b border-linha py-1">
                <Link href="/conectar" className="flex min-h-11 items-center justify-between gap-3 text-tinta no-underline">
                  <span className="truncate text-[15px] font-semibold">{c.displayName}</span>
                  <span className={`shrink-0 text-xs ${c.status === 'ERROR' && !imported ? 'font-semibold text-vermelho-texto' : 'text-tinta-suave'}`}>
                    {imported ? 'extrato importado' : c.status === 'ERROR' ? 'parou de atualizar' : synced(c.lastSyncedAt)}
                  </span>
                </Link>
                {c.accounts.map((a) => (
                  <div key={a.id} className={`flex min-h-9 items-center gap-2 pb-1 text-[13px] ${a.hidden ? 'text-tinta-suave' : ''}`}>
                    {a.type === 'CREDIT' ? <CardIcon className="shrink-0 text-laranja-texto" /> : <BankIcon className="shrink-0 text-tinta-suave" />}
                    <span className={`min-w-0 grow truncate ${a.hidden ? 'line-through' : ''}`}>{a.name}</span>
                    <span className="shrink-0 tabular-nums">{money(a.type === 'CREDIT' ? Math.max(0, -a.balanceInCents) : a.balanceInCents)}</span>
                    <HideAccountButton accountId={a.id} hidden={a.hidden} />
                  </div>
                ))}
              </div>
            );
          })}
          <Link href="/conectar" className="flex min-h-[46px] items-center gap-2 text-[15px] font-semibold text-laranja-texto no-underline">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            {me.connections.length ? 'Conectar outro banco' : 'Conectar meu banco'}
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <Eyebrow>Atalhos</Eyebrow>
        <div className="flex flex-col rounded-2xl border border-linha bg-cartao px-3.5 [&>a:last-child]:border-b-0">
          {atalhos.map((a) => (
            <Link key={a.href} href={a.href} className={rows}>
              <span className="text-[15px] font-semibold">{a.label}</span>
              <span className="text-tinta-suave" aria-hidden="true">›</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3 rounded-2xl bg-amarelo-claro px-3.5 py-3">
        <Mascote pose="caramelo-moeda" size={56} alt="Caramelo com uma moeda" />
        <p className="text-[13px] leading-[19px]">Isso aqui é um protótipo. Achou algo estranho? Anota e conta pro Pedro.</p>
      </div>

      <div className="flex justify-between">
        <Link href="/conectar" className="flex h-11 items-center text-sm font-semibold text-vermelho-texto no-underline">Desconectar bancos</Link>
        <a href="/sair" className="flex h-11 items-center text-sm font-semibold text-tinta-suave no-underline">Sair da conta</a>
      </div>
    </div>
  );
}
