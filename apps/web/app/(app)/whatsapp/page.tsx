import { api } from '@/lib/api';
import { resolveBackHref } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';
import { Mascot } from '@/components/mascote';
import { BackLink, PageFrame } from '@/components/ui';
import { CodeCard } from './code-card';
import { unlink } from './actions';

type Status = { enabled: boolean; number: string | null; linkedPhone: string | null };

export default async function WhatsAppPage({ searchParams }: { searchParams: Promise<{ voltar?: string }> }) {
  const [{ voltar }, s, { t }] = await Promise.all([
    searchParams,
    api<Status>('/whatsapp').catch((): Status => ({ enabled: false, number: null, linkedPhone: null })),
    getI18n(),
  ]);
  const backHref = resolveBackHref(voltar, '/mais');
  const tw = t.pages.whatsapp;

  return (
    <PageFrame size="focused">
      <BackLink href={backHref} label={t.common.back} />
      <h1 className="font-display text-[30px] leading-[34px] font-extrabold">{tw.title}</h1>
      <div className="flex items-center gap-1.5 rounded-2xl bg-menta-clara py-3 pr-3.5 pl-1.5">
        <Mascot pose="acenando" size={72} alt="" />
        <p className="text-[15px] leading-[21px]">{tw.intro}</p>
      </div>

      {!s.enabled ? (
        <p className="rounded-2xl border border-dashed border-linha p-4 text-[15px] text-tinta-suave">{tw.notReady}</p>
      ) : s.linkedPhone ? (
        <div className="flex flex-col gap-3 rounded-[20px] border border-linha bg-cartao p-4">
          <span className="text-[15px]">{tw.linkedTo(s.linkedPhone)}</span>
          {s.number && <a href={`https://wa.me/${s.number}`} target="_blank" rel="noreferrer" className="flex h-[50px] items-center justify-center rounded-full bg-menta text-[15px] font-semibold text-tinta-fixa no-underline">{tw.openChat}</a>}
          <form action={unlink}><button type="submit" className="w-full py-1 text-sm font-semibold text-vermelho-texto underline">{tw.unlink}</button></form>
        </div>
      ) : (
        <CodeCard t={tw.codeCard} />
      )}

      <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] leading-[19px] text-tinta-suave">
        {tw.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
    </PageFrame>
  );
}
