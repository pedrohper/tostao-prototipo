import type { TribunalResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { resolveBackHref } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';
import { Mascot } from '@/components/mascote';
import { BackLink, PageFrame } from '@/components/ui';
import { Rich, Voto } from './voto';

/** Tribunal do Tostão: um caso por semana, a galera vota e o Tostão dá o veredito. */
export default async function TribunalPage({ searchParams }: { searchParams: Promise<{ voltar?: string }> }) {
  const [{ voltar }, t, { locale, t: dict }] = await Promise.all([
    searchParams,
    api<TribunalResponse>('/tribunal'),
    getI18n(),
  ]);
  const tt = dict.pages.tribunal;
  const fim = new Date(t.endsAt)
    .toLocaleDateString(locale, { weekday: 'long', timeZone: 'America/Sao_Paulo' })
    .replace('-feira', '');
  const backHref = resolveBackHref(voltar, '/aprender');

  return (
    <PageFrame size="focused" className="min-h-[calc(100dvh-160px)] md:min-h-[540px]">
      <div className="flex items-center justify-between">
        <BackLink href={backHref} label={dict.common.back} />
        <span className="text-xs font-semibold text-tinta-suave">{tt.endsPrefix(fim, t.totalVotes)}</span>
      </div>
      <div className="flex items-center gap-2.5">
        <Mascot pose="pensando" size={76} alt="Tostão" />
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-bold tracking-[0.08em] text-laranja-texto uppercase">{tt.eyebrow}</span>
          <h1 className="font-display text-[26px] leading-[30px] font-extrabold">{t.case.title}</h1>
        </div>
      </div>
      <div className="flex flex-col gap-2 rounded-[18px] border border-linha bg-cartao px-4 py-3.5">
        <span className="text-[13px] font-semibold text-tinta-suave">{tt.caseOfWeek}</span>
        <p className="text-[15px] leading-[22px]">
          <Rich text={t.case.story} />
        </p>
      </div>
      <Voto initial={t} locale={locale} />
    </PageFrame>
  );
}
