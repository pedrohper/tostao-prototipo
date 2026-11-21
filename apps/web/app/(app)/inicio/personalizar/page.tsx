import { BackLink, PageFrame } from '@/components/ui';
import { DEFAULT_HIDDEN_SECTIONS, HOME_SECTIONS, readHomePrefs, resolveSectionOrder } from '@/lib/inicio-prefs';
import { resolveBackHref } from '@/lib/format';
import { PersonalizarForm } from './form';
import { getI18n } from '@/lib/i18n-server';

export default async function CustomizeHomePage({ searchParams }: { searchParams: Promise<{ voltar?: string }> }) {
  const [{ voltar }, prefs, { locale, t }] = await Promise.all([searchParams, readHomePrefs(), getI18n()]);
  const tp = t.pages.personalizar;
  const rows = resolveSectionOrder(prefs)
    .map((id) => HOME_SECTIONS.find((s) => s.id === id)!)
    .map((s) => {
      const tr = tp.sections[s.id as keyof typeof tp.sections];
      return { id: s.id, nome: tr?.name ?? s.nome, dica: tr?.hint ?? s.dica };
    });
  const backHref = resolveBackHref(voltar, '/mais');

  return (
    <PageFrame size="focused">
      <BackLink href={backHref} label={backHref === '/inicio' ? t.nav.home : t.common.back} />
      <h1 className="font-display text-[30px] leading-[34px] font-extrabold">{t.home.customizeHome}</h1>
      <p className="text-[15px] leading-[21px] text-tinta-suave">{tp.subtitle}</p>
      <PersonalizarForm
        linhas={rows}
        ocultos={prefs.ocultos}
        padrao={HOME_SECTIONS.map((s) => s.id)}
        padraoOcultos={[...DEFAULT_HIDDEN_SECTIONS]}
        locale={locale}
      />
    </PageFrame>
  );
}
