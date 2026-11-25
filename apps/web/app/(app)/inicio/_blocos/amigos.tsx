// Desafio da semana com amigos (coluna da direita no computador).
import Link from 'next/link';
import { Icon } from '@/components/icone';
import { getI18n } from '@/lib/i18n-server';
import { getFriends } from './dados';

export async function WeeklyChallengeCard() {
  const [{ t }, friends] = await Promise.all([getI18n(), getFriends()]);
  const topFriends = friends?.ranking.slice(0, 3) ?? [];
  return (
    <Link
      href="/amigos?voltar=/inicio"
      className="flex flex-col gap-2.5 rounded-2xl border border-linha bg-cartao p-3.5 text-tinta no-underline transition hover:bg-papel-2/50"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">
          {t.weeklyChallenge.eyebrow}
        </span>
        <span className="text-xs font-semibold text-laranja-texto">{t.weeklyChallenge.openRanking}</span>
      </div>
      {friends?.challenge.title && (
        <span className="text-[15px] leading-5 font-bold text-tinta">{friends.challenge.title}</span>
      )}
      {topFriends.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {topFriends.map((person, index) => (
            <div key={person.id} className="flex items-center justify-between gap-2 text-[13px]">
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-papel-2 text-[11px] font-bold text-tinta">
                  {index + 1}
                </span>
                <span className={`truncate ${person.me ? 'font-bold text-tinta' : 'font-medium text-tinta'}`}>
                  {person.name}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-tinta-suave tabular-nums">
                <span>{person.weekScore} pts</span>
                <span className="inline-flex items-center gap-0.5">
                  <Icon src="ui/ofensiva" size={14} />
                  {t.engagement.daysCount(person.streakDays)}
                </span>
              </span>
            </div>
          ))}
          {friends && friends.ranking.length <= 1 && (
            <p className="text-xs leading-[17px] text-tinta-suave">{t.weeklyChallenge.emptyRank}</p>
          )}
        </div>
      ) : (
        <p className="text-[13px] leading-[18px] text-tinta-suave">{t.weeklyChallenge.emptyRank}</p>
      )}
    </Link>
  );
}
