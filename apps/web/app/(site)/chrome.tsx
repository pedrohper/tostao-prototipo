// Cabeçalho e rodapé das páginas públicas (landing, Termos, Privacidade).
import Link from 'next/link';
import s from './site.module.css';

export function SiteHeader({ home = false }: { home?: boolean }) {
  const anchor = (id: string) => (home ? `#${id}` : `/#${id}`);
  return (
    <header className={s.nav}>
      <Link href="/" aria-label="Tostão, página inicial">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/wordmark.svg" alt="tostão" width={120} height={41} style={{ width: 120, height: 'auto' }} />
      </Link>
      <nav className={s['nav-links']} aria-label="Seções">
        <a href={anchor('como')}>Como funciona</a>
        <a href={anchor('aprender')}>Aprender</a>
        <a href={anchor('seguranca')}>Segurança</a>
      </nav>
      <div className={s['nav-cta']}>
        <Link href="/entrar" className={`${s.btn} ${s['btn-ghost']} ${s['btn-sm']}`}>Entrar</Link>
        <Link href="/criar-conta" className={`${s.btn} ${s['btn-dark']} ${s['btn-sm']}`}>Começar grátis</Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className={s.foot}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/wordmark.svg" alt="tostão" width={96} height={33} style={{ width: 96, height: 'auto' }} />
      <span>O Tostão ensina critérios e não recomenda investimentos.</span>
      <nav className={s['foot-links']} aria-label="Documentos">
        <Link href="/termos">Termos de uso</Link>
        <Link href="/privacidade">Privacidade</Link>
        <span>© 2026 Tostão</span>
      </nav>
    </footer>
  );
}
