// Mês a mês: o gráfico do que entrou e saiu (consulta própria, uma das lentas).
import { CashflowLineChart } from '@/components/graficos';
import { Card } from '@/components/ui';
import { getI18n } from '@/lib/i18n-server';
import { getHistory } from './dados';

export async function EvolutionSection({ month }: { month: string }) {
  const [{ locale, t }, history] = await Promise.all([getI18n(), getHistory(month)]);
  if (!history || !history.months.some((m) => m.incomeInCents > 0 || m.outcomeInCents > 0)) return null;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-display text-xl leading-[26px] font-extrabold">{t.growth.home.evolutionTitle}</h2>
        <p className="text-small leading-[18px] text-tinta-suave">{t.growth.home.evolutionSub}</p>
      </div>
      <Card>
        <CashflowLineChart
          data={history.months.map((m) => ({
            month: m.month,
            inInCents: m.incomeInCents,
            outInCents: m.outcomeInCents,
          }))}
          atual={month}
          locale={locale}
          monthBasePath="/inicio"
        />
      </Card>
    </section>
  );
}
