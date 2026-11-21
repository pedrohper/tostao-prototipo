'use client';
// Último recurso: um erro no próprio layout raiz. Substitui o <html>, então precisa trazer os seus.
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/bricolage-grotesque/800.css';
import './globals.css';
import { ErrorScreen } from '@/components/error-screen';
import { getDictionary } from '@/lib/i18n';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = getDictionary('pt-BR').system;
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh">
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
      </body>
    </html>
  );
}
