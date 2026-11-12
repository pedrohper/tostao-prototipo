import Link from 'next/link';
import type { ConnectTokenResponse, ProfileResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { Mascote } from '@/components/mascote';
import { Card } from '@/components/ui';
import { ConnectPanel, DisconnectButton, SyncButton } from './forms';

export default async function ConectarPage({ searchParams }: { searchParams: Promise<{ novo?: string }> }) {
  const { novo } = await searchParams;
  const [me, mode] = await Promise.all([
    api<ProfileResponse>('/me'),
    // Só pra saber se a API fala com o Pluggy de verdade (token != null) ou com o banco de exemplo.
    // Se falhar (Pluggy fora do ar, trial vencido), a gente avisa e oferece importar extrato.
    api<ConnectTokenResponse>('/connections/connect-token', { method: 'POST', body: {} }).then((r) => ({ ...r, down: false })).catch(() => ({ connectToken: null, down: true })),
  ]);
  const widget = mode.connectToken !== null;
  const pontos = [
    { bg: 'bg-menta-clara', icon: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>, b: 'Só leitura.', t: 'Eu vejo os gastos, mas não consigo mexer no seu dinheiro.' },
    { bg: 'bg-azul', icon: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />, b: 'Open Finance.', t: 'O sistema oficial do Banco Central. Sua senha fica no app do banco.' },
    { bg: 'bg-amarelo-claro', icon: <><path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><path d="M12 2v10" /></>, b: 'Você manda.', t: 'Desconecta quando quiser, em um toque.' },
  ];
  return (
    <div className="flex flex-col gap-5">
      {novo && (
        <div className="h-2 overflow-hidden rounded-full border border-linha bg-papel-2" role="img" aria-label="Passo 2 de 2">
          <div className="h-full w-3/4 rounded-full bg-tinta" />
        </div>
      )}
      <div className="flex justify-center"><Mascote pose="conectando" size={176} alt="Tostão ligando dois cabos" /></div>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[28px] leading-[33px] font-extrabold">Conecte seu banco em 1 minuto</h1>
        <p className="text-[15px] leading-[22px] text-tinta-suave">É assim que eu descubro pra onde a sua grana vai, sem você digitar nada.</p>
      </div>

      <div className="flex flex-col gap-3.5">
        {pontos.map((p) => (
          <div key={p.b} className="flex items-start gap-3">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${p.bg}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p.icon}</svg>
            </div>
            <p className="text-[15px] leading-[21px]"><b>{p.b}</b> {p.t}</p>
          </div>
        ))}
      </div>

      {mode.down && (
        <div role="alert" className="flex items-center gap-3 rounded-[20px] bg-amarelo-claro p-3">
          <Mascote pose="preocupado" size={64} alt="" />
          <p className="text-[15px]">A conexão automática com os bancos tá fora do ar agora. Enquanto isso, dá pra <Link href="/importar" className="font-semibold underline">importar o extrato</Link> do app do banco.</p>
        </div>
      )}

      <div className="flex flex-col gap-2.5 rounded-2xl bg-papel-2 p-4">
        {mode.down ? (
          <>
            <h2 className="font-display text-lg font-extrabold">Sem conexão automática por enquanto</h2>
            <p className="text-[14px] leading-relaxed">Os bancos que já estão aqui continuam com o que foi puxado até agora.</p>
          </>
        ) : widget ? (
          <>
            <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">Como funciona</span>
            <ol className="list-decimal space-y-1 pl-5 text-[14px] leading-relaxed">
              <li>Toque em “Conectar meu banco”. Abre a janelinha do Pluggy.</li>
              <li>Procure <b>MeuPluggy</b> e autorize o banco que você já ligou em <a href="https://meu.pluggy.ai" target="_blank" rel="noreferrer" className="font-semibold underline">meu.pluggy.ai</a>. Uma vez por banco.</li>
              <li>Pronto. Eu puxo contas e transações na hora.</li>
            </ol>
          </>
        ) : (
          <>
            <h2 className="font-display text-lg font-extrabold">Banco de exemplo</h2>
            <p className="text-[14px] leading-relaxed">A API tá rodando com <code>BANK_GATEWAY=fake</code>. Digite qualquer texto e entram dados de exemplo.</p>
          </>
        )}
      </div>

      {!mode.down && <ConnectPanel widget={widget} />}

      <Link href="/importar" className="flex items-center justify-between rounded-2xl border border-linha bg-cartao p-4 text-tinta no-underline">
        <span><b>Importar extrato</b><span className="block text-[13px] text-tinta-suave">OFX ou CSV baixado do app do banco. Funciona com qualquer banco.</span></span>
        <span className="text-tinta-suave">›</span>
      </Link>

      {me.connections.length > 0 && (
        <section className="flex flex-col gap-2">
          <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">Bancos conectados</span>
          {me.connections.map((c) => {
            const imported = c.itemId.startsWith('import:');
            return (
            <Card key={c.id} className="flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="font-semibold">{c.displayName}</span>
                <span className={`text-xs font-bold ${imported ? 'text-tinta-suave' : c.status === 'ACTIVE' ? 'text-verde-texto' : 'text-vermelho-texto'}`}>{imported ? 'Extrato importado' : c.status === 'ACTIVE' ? 'Ativo' : 'Parou de atualizar'}</span>
              </div>
              <span className="text-xs text-tinta-suave">{imported ? 'Último arquivo' : 'Última sincronização'}: {c.lastSyncedAt ? new Date(c.lastSyncedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'nunca'}</span>
              {!imported && c.status === 'ERROR' && <p className="text-[13px] text-vermelho-texto">Não consegui atualizar esse banco. Tenta sincronizar de novo; se continuar, desconecta e conecta outra vez, ou importa o extrato.</p>}
              <div className="flex flex-wrap items-center justify-between gap-2">
                {imported ? <Link href={`/importar?conta=${encodeURIComponent(c.institution ?? '')}`} className="text-sm font-semibold underline">Importar mais</Link> : <SyncButton id={c.id} />}
                <DisconnectButton id={c.id} name={c.displayName} />
              </div>
            </Card>
            );
          })}
        </section>
      )}

      {novo && (
        <div className="flex items-center justify-end">
          <Link href="/inicio" className="flex h-11 items-center text-sm font-semibold text-tinta-suave no-underline">Agora não, só explorar</Link>
        </div>
      )}
    </div>
  );
}
