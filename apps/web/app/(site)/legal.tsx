// Peças comuns de Termos e Privacidade.
import { getI18n } from '@/lib/i18n-server';
import { getLegalConfig } from '@/lib/legal-config';
import { SiteFooter, SiteHeader } from './chrome';
import s from './site.module.css';

/**
 * Canal de contato nos textos legais. O e-mail vem de NEXT_PUBLIC_SUPPORT_EMAIL / NEXT_PUBLIC_DPO_EMAIL
 * (`apps/web/.env.example`). Sem e-mail configurado, mostra o texto genérico em vez de inventar um endereço.
 */
export function Contato({ dpo = false }: { dpo?: boolean }) {
  const cfg = getLegalConfig();
  const email = dpo ? cfg.dpoEmail : cfg.supportEmail;
  if (!email) return <>o canal de suporte do Tostão</>;
  return <a href={`mailto:${email}`}>{email}</a>;
}

/** "Razão Social, CNPJ 00.000.000/0000-00" (o CNPJ só aparece se estiver configurado e for válido). */
export function Controlador() {
  const { entity, cnpj } = getLegalConfig();
  return <>{cnpj ? `${entity}, CNPJ ${cnpj}` : entity}</>;
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
  return (
    <div className={s.tabela}>
      <table>{children}</table>
    </div>
  );
}

export const disp = s.disp;
