import Link from 'next/link';
import { modules, MODULE_COLORS } from '@/lib/lessons';
import { Mascote } from '@/components/mascote';
import { Eyebrow, StreakChip } from '@/components/ui';
import type { LessonProgressResponse, MonthSummaryResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { currentMonth } from '@/lib/format';
import { NO_PROGRESS, xpFrom } from '@/lib/xp';
import { LegacyProgress } from './legacy-progress';

export default async function AprenderPage() {
  const [{ done, streakDays, doneToday }, summary] = await Promise.all([
    api<LessonProgressResponse>('/progress').catch(() => NO_PROGRESS),
    api<MonthSummaryResponse>(`/summary?month=${currentMonth()}`).catch(() => null),
  ]);
  const pendentes = summary?.uncategorizedCount ?? 0;
  const { xp } = xpFrom(done.length);
  // Módulo atual = o primeiro que ainda tem lição por fazer
  const atualIdx = modules.findIndex((m) => m.lessons.some((l) => !done.includes(l.id)));
  const atual = atualIdx >= 0 ? modules[atualIdx] : null;
  const proxima = atual?.lessons.find((l) => !done.includes(l.id));
  const feitas = atual ? atual.lessons.filter((l) => done.includes(l.id)).length : 0;
  const proximos = atualIdx >= 0 ? modules.slice(atualIdx + 1, atualIdx + 4) : [];

  return (
    <div className="flex flex-col gap-3.5 pt-9 md:pt-0">
      <LegacyProgress saved={done} />
      <div className="flex items-end justify-between">
        <h1 className="font-display text-[34px] leading-[38px] font-extrabold">Aprender</h1>
        <div className="flex gap-1.5">
          <StreakChip days={streakDays} />
          <span className="rounded-full bg-amarelo px-2.5 py-1.5 text-sm font-bold text-[#1E1B18]">{xp} XP</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 rounded-[18px] border border-linha bg-cartao py-3 pr-3.5 pl-1.5">
        <Mascote pose="professor" size={84} alt="Tostão professor" />
        <div className="flex min-w-0 grow flex-col gap-[9px]">
          <Eyebrow>Missões de hoje</Eyebrow>
          <Missao feita={doneToday > 0} href={proxima ? `/aprender/${proxima.id}` : '/aprender/trilha'}>Fazer 1 lição</Missao>
          <Missao feita={pendentes === 0} href="/carteira?filtro=pendentes">
            {pendentes === 0 ? 'Gastos todos categorizados' : `Categorizar ${pendentes} ${pendentes === 1 ? 'gasto' : 'gastos'}`}
          </Missao>
        </div>
      </div>

      {atual && proxima ? (
        <div className="flex flex-col gap-2.5 rounded-[18px] bg-amarelo-claro p-4">
          <Eyebrow>Módulo {atual.number} · {feitas ? 'em andamento' : 'começa aqui'}</Eyebrow>
          <h2 className="font-display text-[22px] leading-[27px] font-extrabold">{atual.title}</h2>
          <div className="flex gap-1.5" role="img" aria-label={`${feitas} de ${atual.lessons.length} lições feitas`}>
            {atual.lessons.map((l) => <i key={l.id} className={`h-2 grow rounded-full ${done.includes(l.id) ? 'bg-tinta' : 'bg-cartao'}`} />)}
          </div>
          <div className="flex items-center justify-between gap-3 rounded-[14px] bg-cartao py-2.5 pr-2.5 pl-3.5">
            <div className="flex min-w-0 flex-col">
              <span className="text-xs text-tinta-suave">Próxima · 2 min · usa seus gastos</span>
              <span className="text-[15px] font-bold">{proxima.title}</span>
            </div>
            <Link href={`/aprender/${proxima.id}`} className="flex h-[38px] shrink-0 items-center rounded-full bg-tinta px-4 text-sm font-semibold text-papel no-underline">
              {done.length ? 'Continuar' : 'Começar'}
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-[18px] bg-menta-clara p-4">
          <Mascote pose="comemorando" size={84} alt="Tostão comemorando" />
          <p className="text-[15px] leading-[21px]"><b>Trilha completa!</b> Você fez todas as lições. Pode rever qualquer uma na trilha.</p>
        </div>
      )}

      <section className="flex flex-col">
        <div className="flex min-h-9 items-center justify-between">
          <Eyebrow>{proximos.length ? 'Próximos módulos' : 'Todos os módulos'}</Eyebrow>
          <Link href="/aprender/trilha" className="flex h-9 items-center gap-1 text-sm font-semibold text-laranja-texto no-underline">
            Ver trilha
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
          </Link>
        </div>
        {proximos.map((m) => {
          const i = modules.indexOf(m);
          const começou = m.lessons.some((l) => done.includes(l.id));
          return (
            <Link key={m.id} href="/aprender/trilha" className="flex min-h-14 items-center gap-3 border-b border-linha text-tinta no-underline last:border-b-0">
              <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] text-sm font-bold text-[#1E1B18]" style={{ background: MODULE_COLORS[i] }}>{m.number}</div>
              <div className="flex min-w-0 grow flex-col py-2">
                <span className="text-[15px] font-semibold">{m.title}{m.optional ? ' · opcional' : ''}</span>
                <span className="truncate text-xs text-tinta-suave">{m.goal}</span>
              </div>
              {!começou && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Ainda não começou" className="shrink-0 text-tinta-suave"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
              )}
            </Link>
          );
        })}
      </section>
    </div>
  );
}

function Missao({ feita, href, children }: { feita: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex flex-col gap-1 text-tinta no-underline">
      <span className="flex justify-between text-[13px] font-semibold">
        <span className={feita ? 'text-tinta-suave line-through' : ''}>{children}</span>
        <span>{feita ? '1/1' : '0/1'}</span>
      </span>
      <span className="h-2 rounded-full bg-papel-2" aria-hidden="true">
        <span className={`bar-fill block h-full rounded-full ${feita ? 'w-full bg-menta' : 'w-[4%] bg-tinta'}`} />
      </span>
      <span className="sr-only">{feita ? '(feita)' : '(pendente)'}</span>
    </Link>
  );
}
