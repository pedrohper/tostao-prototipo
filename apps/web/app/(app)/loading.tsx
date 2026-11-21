import { getI18n } from '@/lib/i18n-server';

/** Esqueleto das telas logadas enquanto o servidor busca os dados (mesmo tom dos cartões, sem pulo de layout). */
export default async function AppLoading() {
  const { t } = await getI18n();
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col gap-4 px-4 py-6">
      <span className="sr-only">{t.system.loadingAria}</span>
      <div aria-hidden="true" className="h-8 w-2/5 animate-pulse rounded-xl bg-papel-2" />
      <div aria-hidden="true" className="h-32 animate-pulse rounded-[20px] bg-papel-2" />
      <div aria-hidden="true" className="h-24 animate-pulse rounded-[20px] bg-papel-2" />
      <div aria-hidden="true" className="h-24 animate-pulse rounded-[20px] bg-papel-2" />
    </div>
  );
}
