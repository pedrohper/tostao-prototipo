// Cabeçalho e rodapé das páginas públicas (landing, Termos, Privacidade).
import Link from 'next/link';
import { getI18n } from '@/lib/i18n-server';
import s from './site.module.css';

export async function SiteHeader({ home = false }: { home?: boolean }) {
  const { t } = await getI18n();
  const l = t.legal;
  const anchor = (id: string) => (home ? `#${id}` : `/#${id}`);
  return (
    <header className={s.nav}>
      <Link href="/" aria-label={l.homeAria}>
        <img src="/wordmark.svg" alt="tostão" width={120} height={41} style={{ width: 120, height: 'auto' }} />
      </Link>
      <nav className={s['nav-links']} aria-label={l.navAria}>
        <a href={anchor('como')}>{l.navHow}</a>
        <a href={anchor('aprender')}>{l.navLearn}</a>
        <a href={anchor('seguranca')}>{l.navSafety}</a>
      </nav>
      <div className={s['nav-cta']}>
        <Link href="/entrar" className={`${s.btn} ${s['btn-ghost']} ${s['btn-sm']}`}>
          {l.signIn}
        </Link>
        <Link href="/criar-conta" className={`${s.btn} ${s['btn-dark']} ${s['btn-sm']}`}>
          {l.startFree}
        </Link>
      </div>
    </header>
  );
}

export async function SiteFooter() {
  const { t } = await getI18n();
  const l = t.legal;
  return (
    <footer className={s.foot}>
      <img src="/wordmark.svg" alt="tostão" width={96} height={33} style={{ width: 96, height: 'auto' }} />
      <span>{l.footerTagline}</span>
      <nav className={s['foot-links']} aria-label={l.docsAria}>
        <Link href="/termos">{l.termsLink}</Link>
        <Link href="/privacidade">{l.privacyLink}</Link>
        <span>© 2026 Tostão</span>
      </nav>
    </footer>
  );
}
