// Acertos: quem te deve e pra quem você deve.
import Link from 'next/link';
import { money } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';
import { getPeople } from './dados';

export async function SplitsSection() {
  const [{ t }, splits] = await Promise.all([getI18n(), getPeople()]);
  if (!splits || (splits.owedToYouInCents <= 0 && splits.youOweInCents <= 0)) return null;
  const owedToMe = splits.people.filter((p) => p.balanceInCents > 0);
  const iOwe = splits.people.filter((p) => p.balanceInCents < 0);
  return (
    <Link
      href="/acertos?voltar=/inicio"
      className="flex flex-col gap-1.5 rounded-2xl border border-linha bg-cartao p-3.5 text-tinta no-underline"
    >
      <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">{t.home.splitsLabel}</span>
      <div className="flex items-baseline justify-between gap-3">
        {splits.owedToYouInCents > 0 && (
          <span className="text-[15px]">
            {t.home.owedToYou} <b className="text-verde-texto tabular-nums">{money(splits.owedToYouInCents)}</b>
          </span>
        )}
        {splits.youOweInCents > 0 && (
          <span className="text-[15px]">
            {t.home.youOwe} <b className="text-vermelho-texto tabular-nums">{money(splits.youOweInCents)}</b>
          </span>
        )}
      </div>
      <span className="truncate text-[13px] text-tinta-suave">
        {[...owedToMe, ...iOwe]
          .slice(0, 3)
          .map((p) => `${p.name} ${money(Math.abs(p.balanceInCents))}`)
          .join(' · ')}
      </span>
    </Link>
  );
}
