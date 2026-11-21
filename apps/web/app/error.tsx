'use client';
import { ErrorScreen } from '@/components/error-screen';
import { getDictionary } from '@/lib/i18n';

// Fallback do site inteiro (landing, login...). O lançamento é só PT-BR; o cookie de idioma não chega num boundary de cliente.
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = getDictionary('pt-BR').system;
  return (
    <ErrorScreen
      fullPage
      title={t.errorTitle}
      body={t.errorBody}
      retryLabel={t.retry}
      onRetry={reset}
      homeLabel={t.goHome}
      homeHref="/"
      digest={error.digest}
    />
  );
}
