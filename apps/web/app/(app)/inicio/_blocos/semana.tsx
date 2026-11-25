// O que vence nos próximos dias e o resumo da semana.
import { UpcomingReminders, WeeklySummaryCard } from '@/components/engajamento';
import { DismissibleCard } from '@/components/fechavel';
import { getI18n } from '@/lib/i18n-server';
import { readHomePrefs } from '@/lib/inicio-prefs';
import { getReminders, getWeekly } from './dados';

export async function RemindersSection() {
  const [{ locale }, prefs, { reminders }] = await Promise.all([getI18n(), readHomePrefs(), getReminders()]);
  return <UpcomingReminders reminders={reminders.filter((r) => !prefs.fechados.includes(r.key))} locale={locale} />;
}

export async function WeekSection() {
  const [{ locale, t }, prefs, weekly] = await Promise.all([getI18n(), readHomePrefs(), getWeekly()]);
  if (!weekly || prefs.fechados.includes(`semana:${weekly.from}`)) return null;
  return (
    <DismissibleCard id={`semana:${weekly.from}`} label={t.home.dismissAlertLabel}>
      <WeeklySummaryCard w={weekly} locale={locale} />
    </DismissibleCard>
  );
}
