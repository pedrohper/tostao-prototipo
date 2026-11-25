// "Quanto posso gastar hoje" (T6.17): uma linha logo abaixo do saldo, só no mês que está rolando. A conta é da API
// (previsão); aqui só entra o texto, que diz o que foi descontado e não promete mais do que a conta sabe.
import Link from 'next/link';
import { money } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';
import { safeToSpendView } from '@/lib/safe-to-spend';
import { SafeToSpendCard } from '../safe-to-spend-card';
import { getForecast } from './dados';

export async function SafeToSpendSection() {
  const [{ t }, forecast] = await Promise.all([getI18n(), getForecast()]);
  if (!forecast) return null; // previsão fora do ar: some o bloco, sem pedir renda de quem já informou
  const texts = t.home.safeToSpend;
  if (!forecast.thisMonth) {
    return (
      <Link
        href="/renda?voltar=/inicio"
        className="flex min-h-14 items-center justify-between gap-3 rounded-card bg-amarelo-claro px-[18px] py-2.5 text-tinta no-underline lg:px-7"
      >
        <span className="min-w-0 text-small font-semibold">{texts.line}</span>
        <span className="shrink-0 text-small font-bold underline underline-offset-2">{texts.inviteCta} ›</span>
      </Link>
    );
  }
  const view = safeToSpendView(forecast.thisMonth, texts, money, t.common.close);
  return view ? <SafeToSpendCard {...view} /> : null;
}
