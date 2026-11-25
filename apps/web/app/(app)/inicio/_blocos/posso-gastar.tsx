// "Quanto posso gastar hoje" (T6.17): o número grande acima do saldo, só no mês que está rolando. A conta é da API
// (previsão); aqui só entra o texto, que diz o que foi descontado e não promete mais do que a conta sabe.
import Link from 'next/link';
import { Mascot } from '@/components/mascote';
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
        className="flex items-center gap-2 rounded-[22px] bg-amarelo-claro py-3 pr-4 pl-2 text-tinta no-underline"
      >
        <Mascot pose="pensando" size={72} alt="" className="shrink-0" />
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-semibold tracking-[0.08em] uppercase">{texts.title}</span>
          <span className="text-[15px] leading-[21px]">{texts.invite}</span>
          <span className="text-[14px] font-bold underline underline-offset-2">{texts.inviteCta}</span>
        </span>
      </Link>
    );
  }
  const view = safeToSpendView(forecast.thisMonth, texts, money);
  return view ? <SafeToSpendCard {...view} /> : null;
}
