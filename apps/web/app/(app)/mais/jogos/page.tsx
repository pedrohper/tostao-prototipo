// "Jogos e amigos" (T6.10): um lugar só pra Tribunal, Batalha, Ofensiva e Amigos, no lugar de atalhos soltos na Home.
// "Compensa parcelar?" fica de fora: é calculadora (ferramenta), e continua em Aprender.
import Link from 'next/link';
import { Icon } from '@/components/icone';
import { BackLink, PageFrame } from '@/components/ui';
import { resolveBackHref } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';

const SELF = encodeURIComponent('/mais/jogos');

const COPY = {
  'pt-BR': {
    title: 'Jogos e amigos',
    items: {
      tribunal: ['Tribunal do Tostão', 'Julgue o caso da semana'],
      batalha: ['Batalha', 'Contra o Tigrinho e o Urubu do Pix'],
      ofensiva: ['Ofensiva', 'Seus dias seguidos e as missões de hoje'],
      amigos: ['Amigos', 'Placar da semana, sem mostrar dinheiro'],
    },
  },
  en: {
    title: 'Games and friends',
    items: {
      tribunal: ['Tostão Court', 'Judge the case of the week'],
      batalha: ['Battle', 'Against Tigrinho and the Pix Vulture'],
      ofensiva: ['Streak', 'Your days in a row and today’s missions'],
      amigos: ['Friends', 'Weekly ranking, no money shown'],
    },
  },
  es: {
    title: 'Juegos y amigos',
    items: {
      tribunal: ['Tribunal de Tostão', 'Juzga el caso de la semana'],
      batalha: ['Batalla', 'Contra Tigrinho y el Buitre del Pix'],
      ofensiva: ['Racha', 'Tus días seguidos y las misiones de hoy'],
      amigos: ['Amigos', 'Ranking semanal, sin mostrar dinero'],
    },
  },
} as const;

const GAMES = [
  { id: 'tribunal', icon: 'jogo/tribunal', tone: 'bg-azul' },
  { id: 'batalha', icon: 'jogo/batalha', tone: 'bg-amarelo-claro' },
  { id: 'ofensiva', icon: 'ui/ofensiva', tone: 'bg-rosa' },
  { id: 'amigos', icon: 'cat/role', tone: 'bg-menta-clara' },
] as const;

export default async function JogosPage({ searchParams }: { searchParams?: Promise<{ voltar?: string }> }) {
  const [sp, { locale, t }] = await Promise.all([searchParams ?? Promise.resolve<{ voltar?: string }>({}), getI18n()]);
  const copy = COPY[locale];
  return (
    <PageFrame size="focused">
      <div className="flex items-center gap-1">
        <BackLink href={resolveBackHref(sp.voltar, '/mais')} label={t.common.back} />
        <h1 className="truncate font-display text-[24px] leading-[30px] font-extrabold text-tinta">{copy.title}</h1>
      </div>
      <nav
        aria-label={copy.title}
        className="flex flex-col divide-y divide-linha rounded-[22px] border border-linha bg-cartao px-4 py-1"
      >
        {GAMES.map((game) => (
          <Link
            key={game.id}
            href={`/${game.id}?voltar=${SELF}`}
            className="flex min-h-[68px] items-center gap-3.5 py-3 text-tinta no-underline transition-opacity hover:opacity-80"
          >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-tinta ${game.tone}`}>
              <Icon src={game.icon} size={24} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-bold">{copy.items[game.id][0]}</span>
              <span className="text-[13px] leading-[18px] text-tinta-suave">{copy.items[game.id][1]}</span>
            </span>
            <span className="shrink-0 text-lg text-tinta-suave" aria-hidden="true">
              ›
            </span>
          </Link>
        ))}
      </nav>
    </PageFrame>
  );
}
