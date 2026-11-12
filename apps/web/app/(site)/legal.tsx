// Peças comuns de Termos e Privacidade.
import { SiteFooter, SiteHeader } from './chrome';
import s from './site.module.css';

export const ATUALIZADO_EM = '12 de novembro de 2026';

/** E-mail de contato do responsável. Vem do .env da web (CONTATO_EMAIL); sem ele, a página diz o que fazer pelo app. */
export function Contato() {
  const email = process.env.CONTATO_EMAIL;
  if (email) return <a href={`mailto:${email}`}>{email}</a>;
  return <>o e-mail de contato que vamos publicar aqui ainda durante o beta (enquanto isso, tudo que dá pra fazer sozinho está no Perfil do app)</>;
}

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={s.lp}>
      <div className={s.wrap}>
        <SiteHeader />
        <main className={s.doc}>
          <h1 className={s.disp}>{title}</h1>
          <p className={s.atualizado}>Atualizado em {ATUALIZADO_EM}</p>
          {children}
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}

export function Resumo({ children }: { children: React.ReactNode }) {
  return (
    <section className={`${s.card} ${s.resumo}`}>
      <h2 className={s.disp}>Resumo sem juridiquês</h2>
      {children}
    </section>
  );
}

export function Tabela({ children }: { children: React.ReactNode }) {
  return <div className={s.tabela}><table>{children}</table></div>;
}

export const disp = s.disp;
