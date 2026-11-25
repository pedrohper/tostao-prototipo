// O menu com o que depende da API (avisos pendentes, XP e ofensiva). Fica atrás de um <Suspense> no layout: a tela
// desenha na hora, com o menu sem esses números, e eles entram quando chegarem.
import { SidebarFooter } from '@/components/lateral';
import { Nav } from '@/components/nav';
import { getMissions, getProgress, getTostaoAuto } from '@/lib/api-queries';
import type { Locale } from '@/lib/i18n';
import { orFallback } from '@/lib/rethrow';
import { NO_PROGRESS, xpFrom } from '@/lib/xp';

export async function MenuComDados({ locale }: { locale: Locale }) {
  const [progress, auto, missions] = await Promise.all([
    getProgress().catch(orFallback(NO_PROGRESS)),
    getTostaoAuto().catch(orFallback(null)),
    getMissions().catch(orFallback(null)),
  ]);
  const { xp, level } = xpFrom(progress.done.length, progress.bonusXp ?? 0);

  return (
    <Nav
      locale={locale}
      pendingCount={auto?.insights.length ?? 0}
      footer={
        <SidebarFooter
          xp={xp}
          level={level}
          streakDays={missions?.streakDays ?? progress.streakDays}
          missions={missions}
          locale={locale}
        />
      }
    />
  );
}

/** Enquanto os números não chegam: o mesmo menu, com o "Anotar" já funcionando e um espaço no lugar da ofensiva. */
export function MenuCarregando({ locale }: { locale: Locale }) {
  return <Nav locale={locale} footer={<SidebarFooter carregando locale={locale} />} />;
}
