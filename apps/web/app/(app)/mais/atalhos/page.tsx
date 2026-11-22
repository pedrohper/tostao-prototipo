import { headers } from 'next/headers';
import type { AutomationTokensResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { BackLink, PageFrame } from '@/components/ui';
import { Mascot } from '@/components/mascote';
import { bodyTemplate, guideSteps, installLink, webhookUrl, type GuideKind } from '@/lib/shortcuts-guide';
import { publicOrigin } from '@/lib/public-origin';
import { CopyField } from './copy-field';
import { TokensManager } from './tokens-manager';

const GUIDES: { kind: GuideKind; title: string; sub: string }[] = [
  { kind: 'apple_pay', title: 'Apple Pay / Wallet', sub: 'Cada compra no cartão vira um lançamento na hora.' },
  {
    kind: 'ios_notification',
    title: 'Notificação do banco (iOS 27 ou mais novo)',
    sub: 'O Tostão lê o valor e o estabelecimento do texto da notificação.',
  },
];

export default async function AtalhosPage() {
  const [{ tokens, limit }, h] = await Promise.all([api<AutomationTokensResponse>('/automation-tokens'), headers()]);
  const url = webhookUrl(publicOrigin(h, process.env.APP_PUBLIC_URL));
  return (
    <PageFrame size="focused">
      <BackLink href="/mais" label="Voltar" />
      <div className="flex items-center gap-3">
        <Mascot pose="conectando" size={72} alt="" />
        <div>
          <h1 className="font-display text-[28px] leading-tight font-extrabold">Atalhos do iPhone</h1>
          <p className="text-[15px] text-tinta-suave">
            Compras do Apple Pay e notificações do banco entram no Tostão sozinhas, sem Open Finance e sem custo.
          </p>
        </div>
      </div>

      <section
        aria-labelledby="tokens"
        className="flex flex-col gap-3 rounded-[22px] border border-linha bg-cartao p-4"
      >
        <h2 id="tokens" className="font-display text-[20px] font-extrabold">
          Seus tokens
        </h2>
        <p className="text-[13px] leading-[19px] text-tinta-suave">
          O token é a “chave” que o Atalho usa pra falar com o Tostão. Você pode ter até {limit} ativos (um por aparelho
          ou automação). Perdeu o iPhone? Revogue na hora.
        </p>
        <TokensManager tokens={tokens} limit={limit} />
      </section>

      <section aria-labelledby="guia" className="flex flex-col gap-3">
        <h2 id="guia" className="font-display text-[20px] font-extrabold">
          Como configurar (3 passos)
        </h2>
        {GUIDES.map((g) => {
          const link = installLink(g.kind);
          return (
            <details
              key={g.kind}
              className="rounded-[22px] border border-linha bg-cartao"
              open={g.kind === 'apple_pay'}
            >
              <summary className="flex min-h-14 cursor-pointer list-none flex-col justify-center px-4 py-2.5">
                <span className="text-[16px] font-bold">{g.title}</span>
                <span className="text-[13px] text-tinta-suave">{g.sub}</span>
              </summary>
              <div className="flex flex-col gap-4 border-t border-linha px-4 py-4">
                <ol className="flex flex-col gap-3">
                  {guideSteps(g.kind).map((s, i) => (
                    <li key={s.title} className="flex gap-3">
                      <span
                        aria-hidden
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tinta text-[13px] font-bold text-papel"
                      >
                        {i + 1}
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <b className="text-[15px]">{s.title}</b>
                        <span className="text-[13px] leading-[19px] text-tinta-suave">{s.body}</span>
                      </div>
                    </li>
                  ))}
                </ol>
                {link ? (
                  <a
                    href={link}
                    rel="noopener noreferrer"
                    className="flex h-12 items-center justify-center rounded-full bg-tinta text-[15px] font-semibold text-papel no-underline"
                  >
                    Instalar o Atalho pronto no iPhone
                  </a>
                ) : (
                  <p className="rounded-xl bg-papel-2 px-3 py-2.5 text-[13px] leading-[19px]">
                    O Atalho pronto (1 toque) ainda não está disponível. Monte o seu com os dados abaixo: leva 2
                    minutos.
                  </p>
                )}
                <CopyField label="URL (método POST)" value={url} />
                <CopyField label="Cabeçalho Authorization" value="Bearer SEU_TOKEN_AQUI" />
                <CopyField label="Corpo (JSON)" value={bodyTemplate(g.kind)} multiline />
              </div>
            </details>
          );
        })}
        <p className="text-[12px] leading-[17px] text-tinta-suave">
          O Atalho manda só o valor, o estabelecimento e a data. Se o mesmo aviso chegar duas vezes, o Tostão não
          duplica (o campo <code>eventId</code> faz isso). A compra entra como saída; se for entrada, mande{' '}
          <code>&quot;kind&quot;: &quot;entrada&quot;</code>.
        </p>
      </section>
    </PageFrame>
  );
}
