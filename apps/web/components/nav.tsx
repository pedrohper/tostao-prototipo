'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/inicio', label: 'Início', icon: <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /> },
  { href: '/carteira', label: 'Carteira', icon: <><rect x="3" y="6" width="18" height="14" rx="3" /><path d="M3 10h18" /><path d="M16 15h2" /></> },
  { href: '/chat', label: 'Tostão', icon: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z" /> },
  { href: '/aprender', label: 'Aprender', icon: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" /><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" /></> },
  { href: '/perfil', label: 'Perfil', icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0z" /></> },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-linha bg-cartao px-2 pt-2 pb-[max(16px,env(safe-area-inset-bottom))] md:static md:inset-auto md:flex md:w-56 md:flex-col md:gap-1 md:border-t-0 md:border-r md:bg-papel md:px-4 md:pt-8">
      <img src="/wordmark.png" alt="Tostão" className="mb-6 hidden h-9 w-auto self-start md:block" />
      {items.map((it) => {
        const active = path.startsWith(it.href);
        return (
          <Link key={it.href} href={it.href} aria-current={active ? 'page' : undefined}
            className={`flex flex-col items-center gap-1 py-1.5 text-xs md:flex-row md:gap-3 md:rounded-2xl md:px-3 md:py-2.5 md:text-[15px] ${active ? 'font-bold text-tinta md:bg-papel-2' : 'font-semibold text-tinta-suave'}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? '#FFC233' : 'none'} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{it.icon}</svg>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
