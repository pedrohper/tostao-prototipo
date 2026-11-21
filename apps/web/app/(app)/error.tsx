'use client';
import { ErrorScreen } from '@/components/error-screen';
import { getDictionary } from '@/lib/i18n';

// Fallback das telas logadas: API fora do ar, resposta quebrada, falha de rede. Fica dentro do layout do app (a navegação segue).
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = getDictionary('pt-BR').system;
  return (
    <ErrorScreen
      title={t.errorTitle}
      body={t.errorBody}
      retryLabel={t.retry}
      onRetry={reset}
      homeLabel={t.goHome}
      homeHref="/inicio"
      digest={error.digest}
    />
  );
}
