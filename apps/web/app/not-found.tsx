import { ErrorScreen } from '@/components/error-screen';
import { getI18n } from '@/lib/i18n-server';

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <ErrorScreen
      fullPage
      pose="investigando"
      title={t.system.notFoundTitle}
      body={t.system.notFoundBody}
      homeLabel={t.system.goHome}
      homeHref="/"
    />
  );
}
