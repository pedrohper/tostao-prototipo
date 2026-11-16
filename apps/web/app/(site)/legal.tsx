// Peças comuns de Termos e Privacidade.
import { getI18n } from '@/lib/i18n-server';
import { SiteFooter, SiteHeader } from './chrome';
import s from './site.module.css';

export const ATUALIZADO_EM = '12 de novembro de 2026';

/** E-mail de contato do responsável. Dá pra trocar pelo CONTATO_EMAIL no .env da web (lido no build). */
const EMAIL = process.env.CONTATO_EMAIL || 'pedrohper.business@gmail.com';

export function Contato() {
  return <a href={`mailto:${EMAIL}`}>{EMAIL}</a>;
}

export async function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  const { t } = await getI18n();
  const l = t.legal;
  return (
    <div className={s.lp}>
      <div className={s.wrap}>
        <SiteHeader />
        <main className={s.doc}>
          <h1 className={s.disp}>{title}</h1>
          <p className={s.atualizado}>{l.updatedOn(l.updatedDate)}</p>
          {children}
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}

export async function Resumo({ children }: { children: React.ReactNode }) {
  const { t } = await getI18n();
  return (
    <section className={`${s.card} ${s.resumo}`}>
      <h2 className={s.disp}>{t.legal.summaryHeading}</h2>
      {children}
    </section>
  );
}

export function Tabela({ children }: { children: React.ReactNode }) {
  return <div className={s.tabela}><table>{children}</table></div>;
}

export const disp = s.disp;
