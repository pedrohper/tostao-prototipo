import type { SubscriptionsResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { money } from '@/lib/format';
import { Mascote } from '@/components/mascote';
import { BackLink, ButtonLink, Card } from '@/components/ui';
import { IgnoreButton } from './ignore-button';

const day = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });

export default async function AssinaturasPage() {
  const { subscriptions, ignored, monthlyInCents, yearlyInCents } = await api<SubscriptionsResponse>('/subscriptions');
  const active = subscriptions.filter((s) => s.active);
  const stopped = subscriptions.filter((s) => !s.active);
  const cheapest = active.at(-1);

  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/inicio" />
      <div>
        <h1 className="font-display text-[28px] leading-tight font-extrabold">Raio-X das assinaturas</h1>
        <p className="mt-1 text-[15px] text-tinta-suave">O que sai todo mês sozinho, sem você abrir o app.</p>
      </div>

      {active.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-8 text-center">
          <Mascote pose="investigando" size={150} alt="Tostão investigando com uma lupa" />
          <h2 className="font-display text-xl font-extrabold">Não achei nada que cobra todo mês</h2>
          <p className="max-w-[300px] text-[15px] text-tinta-suave">Ou você tá com tudo sob controle, ou ainda tem pouco extrato. Eu preciso ver pelo menos duas cobranças pra ter certeza.</p>
          <ButtonLink href="/conectar" variant="outline">Ver bancos conectados</ButtonLink>
        </Card>
      ) : (
        <>
          <div className="rounded-3xl bg-amarelo p-5 text-[#1E1B18]">
            <span className="text-sm font-semibold">{active.length} {active.length === 1 ? 'assinatura' : 'assinaturas'} ativas</span>
            <div className="font-display text-[40px] leading-tight font-extrabold">{money(monthlyInCents)}<span className="text-xl"> /mês</span></div>
            <p className="mt-1 text-[15px] font-semibold">Isso dá <b>{money(yearlyInCents)}</b> num ano.</p>
          </div>

          <Card className="flex flex-col divide-y divide-linha p-0">
            {active.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 flex-col items-start">
                  <span className="font-semibold [overflow-wrap:anywhere]">{s.name}</span>
                  <span className="text-[13px] text-tinta-suave">Próxima por volta de {day(s.nextChargeAt)} · {s.installmentsLeft !== null ? `parcelado, ${s.installmentsLeft === 1 ? 'falta 1' : `faltam ${s.installmentsLeft}`}` : `já cobrou ${s.chargeCount}x`}</span>
                  <IgnoreButton subscriptionKey={s.key} ignored={false} />
                </div>
                <span className="shrink-0 font-bold">{money(s.amountInCents)}</span>
              </div>
            ))}
          </Card>

          {cheapest && (
            <div className="flex items-center gap-3 rounded-[20px] bg-azul p-3">
              <Mascote pose="pensando" size={64} alt="Tostão pensando" />
              <p className="text-[15px] leading-snug">Pergunta sincera: você usou <b>{cheapest.name}</b> esse mês? Cancelar só ela já devolve <b>{money(cheapest.amountInCents * 12)}</b> por ano.</p>
            </div>
          )}
        </>
      )}

      {stopped.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-extrabold">Pararam de cobrar</h2>
          <Card className="flex flex-col divide-y divide-linha p-0">
            {stopped.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-3 p-4 text-tinta-suave">
                <span className="min-w-0 [overflow-wrap:anywhere]">{s.name}</span>
                <span className="shrink-0 text-sm">última em {day(s.lastChargedAt)}</span>
              </div>
            ))}
          </Card>
        </section>
      )}

      {ignored.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-extrabold">Você disse que não é assinatura</h2>
          <Card className="flex flex-col divide-y divide-linha p-0">
            {ignored.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-3 p-4 text-tinta-suave">
                <span className="min-w-0 [overflow-wrap:anywhere]">{s.name} · {money(s.amountInCents)}</span>
                <IgnoreButton subscriptionKey={s.key} ignored />
              </div>
            ))}
          </Card>
        </section>
      )}

      <p className="text-center text-[13px] text-tinta-suave">Eu acho as assinaturas pelo padrão: mesma loja, valor parecido, uma vez por mês. Pix e pagamento de fatura ficam de fora. Plano anual parcelado aparece com as parcelas que faltam.</p>
    </div>
  );
}
