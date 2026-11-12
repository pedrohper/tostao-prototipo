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
  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-center"><Mascote pose="conectando" size={170} alt="Tostão ligando dois cabos" /></div>
      <div className="text-center">
        <h1 className="font-display text-[28px] leading-tight font-extrabold">Conecte seu banco em 1 minuto</h1>
        <p className="mt-1 text-[15px] text-tinta-suave">É assim que eu descubro pra onde a sua grana vai, sem você digitar nada.</p>
      </div>

      <div className="flex flex-col gap-2.5">
        {[
          ['Só leitura.', 'Eu vejo os gastos, mas não consigo mexer no seu dinheiro.'],
          ['Open Finance.', 'O sistema oficial do Banco Central. Sua senha fica no app do banco.'],
          ['Você manda.', 'Desconecta quando quiser, aqui embaixo ou no Meu Pluggy.'],
        ].map(([b, t]) => (
          <div key={b} className="flex gap-3 rounded-2xl bg-cartao p-3"><span className="text-verde-texto">✓</span><p className="text-[15px]"><b>{b}</b> {t}</p></div>
        ))}
      </div>

      {mode.down && (
        <div role="alert" className="flex items-center gap-3 rounded-[20px] bg-amarelo-claro p-3">
          <Mascote pose="preocupado" size={64} alt="" />
          <p className="text-[15px]">A conexão automática com os bancos tá fora do ar agora. Enquanto isso, dá pra <Link href="/importar" className="font-semibold underline">importar o extrato</Link> do app do banco.</p>
        </div>
      )}

      <Card className="flex flex-col gap-3 bg-azul">
        {mode.down ? (
          <>
            <h2 className="font-display text-lg font-extrabold">Sem conexão automática por enquanto</h2>
            <p className="text-[14px] leading-relaxed">Os bancos que já estão aqui continuam com o que foi puxado até agora.</p>
          </>
        ) : widget ? (
          <>
            <h2 className="font-display text-lg font-extrabold">Como funciona</h2>
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
      </Card>

      {!mode.down && <ConnectPanel widget={widget} />}

      <Link href="/importar" className="flex items-center justify-between rounded-2xl border-[1.5px] border-linha bg-cartao p-4 no-underline">
        <span><b>Importar extrato</b><span className="block text-[13px] text-tinta-suave">OFX ou CSV baixado do app do banco. Funciona com qualquer banco.</span></span>
        <span className="text-tinta-suave">›</span>
      </Link>

      {me.connections.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-extrabold">Bancos conectados</h2>
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

      {novo && <Link href="/inicio" className="text-center text-[15px] font-semibold text-tinta-suave">Agora não, só explorar</Link>}
    </div>
  );
}
