import { api } from '@/lib/api';
import { Mascote } from '@/components/mascote';
import { BackLink } from '@/components/ui';
import { CodeCard } from './code-card';
import { unlink } from './actions';

type Status = { enabled: boolean; number: string | null; linkedPhone: string | null };

export default async function WhatsAppPage() {
  const s = await api<Status>('/whatsapp').catch((): Status => ({ enabled: false, number: null, linkedPhone: null }));
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/perfil" label="Perfil" />
      <h1 className="font-display text-[30px] leading-[34px] font-extrabold">Tostão no WhatsApp</h1>
      <div className="flex items-center gap-1.5 rounded-2xl bg-menta-clara py-3 pr-3.5 pl-1.5">
        <Mascote pose="acenando" size={72} alt="" />
        <p className="text-[15px] leading-[21px]">Pergunta pelo WhatsApp do mesmo jeito que no app: &ldquo;quanto gastei com delivery?&rdquo;, &ldquo;dá pra comprar um tênis?&rdquo;.</p>
      </div>

      {!s.enabled ? (
        <p className="rounded-2xl border border-dashed border-linha p-4 text-[15px] text-tinta-suave">Ainda tô ligando o número. Quando estiver pronto, aparece aqui o botão pra conectar.</p>
      ) : s.linkedPhone ? (
        <div className="flex flex-col gap-3 rounded-[20px] border border-linha bg-cartao p-4">
          <span className="text-[15px]">Ligado ao número <b className="tabular-nums">{s.linkedPhone}</b>.</span>
          {s.number && <a href={`https://wa.me/${s.number}`} target="_blank" rel="noreferrer" className="flex h-[50px] items-center justify-center rounded-full bg-menta text-[15px] font-semibold text-[#1E1B18] no-underline">Abrir conversa</a>}
          <form action={unlink}><button type="submit" className="w-full py-1 text-sm font-semibold text-vermelho-texto underline">Desligar este número</button></form>
        </div>
      ) : (
        <CodeCard />
      )}

      <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] leading-[19px] text-tinta-suave">
        <li>Só o número que mandar o código vê seus dados.</li>
        <li>Por lá eu mando números resumidos. Extrato e saldo de cada conta, só no app.</li>
        <li>As perguntas contam no mesmo limite diário do chat.</li>
      </ul>
    </div>
  );
}
