import Link from 'next/link';
import { Icon } from '@/components/icone';
import type { Dictionary } from '@/lib/i18n';

interface Shortcut {
  id: string;
  href: string;
  icon: string;
  /** Tailwind classes for the circle background and the icon color. */
  tone: string;
  label: string;
}

/**
 * Horizontal row of round shortcuts (Nubank style) pointing to the Planejar tools.
 * Pure server component: native scroll + snap, no client JS.
 */
export function PlanejarAtalhos({ t }: { t: Dictionary }) {
  const titles = t.plannerCards.titles;
  const back = '?voltar=/inicio';

  const shortcuts: Shortcut[] = [
    {
      id: 'anotacoes',
      href: `/anotacoes${back}`,
      icon: 'conectar/anotar',
      tone: 'bg-laranja text-papel',
      label: titles.notes,
    },
    {
      id: 'importar',
      href: `/importar${back}`,
      icon: 'conectar/extrato',
      tone: 'bg-menta-clara text-verde-texto',
      label: t.pages.importar.title,
    },
    { id: 'acertos', href: `/acertos${back}`, icon: 'cat/role', tone: 'bg-azul text-tinta', label: titles.splits },
    {
      id: 'assinaturas',
      href: `/assinaturas${back}`,
      icon: 'cat/assinaturas',
      tone: 'bg-papel-2 text-tinta',
      label: titles.subscriptions,
    },
    {
      id: 'limites',
      href: `/limites${back}`,
      icon: 'modulo/9',
      tone: 'bg-amarelo-claro text-tinta',
      label: titles.limits,
    },
    {
      id: 'meta',
      href: `/meta${back}`,
      icon: 'meta/outro',
      tone: 'bg-menta-clara text-verde-texto',
      label: titles.goal,
    },
    { id: 'previsao', href: `/previsao${back}`, icon: 'modulo/8', tone: 'bg-azul text-tinta', label: titles.forecast },
    {
      id: 'renda',
      href: `/renda${back}`,
      icon: 'cat/salario',
      tone: 'bg-menta-clara text-verde-texto',
      label: titles.income,
    },
    {
      id: 'fechamento',
      href: `/fechamento${back}`,
      icon: 'ui/meta-batida',
      tone: 'bg-amarelo-claro text-tinta',
      label: titles.closing,
    },
    {
      id: 'categorias',
      href: `/categorias${back}`,
      icon: 'ui/minhas-categorias',
      tone: 'bg-papel-2 text-tinta',
      label: titles.categories,
    },
  ];

  return (
    <nav aria-label={t.home.shortcutsAria} className="-mx-5 md:-mx-10 lg:mx-0">
      <ul className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-1 [scrollbar-width:none] md:px-10 lg:px-0 [&::-webkit-scrollbar]:hidden">
        {shortcuts.map((item) => (
          <li key={item.id} className="w-[68px] shrink-0 snap-start">
            <Link
              prefetch={false}
              href={item.href}
              className="flex flex-col items-center gap-1.5 text-tinta no-underline [&:active>span:first-child]:scale-95"
            >
              <span
                aria-hidden="true"
                className={`flex h-14 w-14 items-center justify-center rounded-full transition-transform ${item.tone}`}
              >
                <Icon src={item.icon} size={26} />
              </span>
              <span className="line-clamp-2 w-full text-center text-[11px] leading-[14px] font-semibold">
                {item.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
