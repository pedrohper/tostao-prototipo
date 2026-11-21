import { ErrorScreen } from '@/components/error-screen';

// Página pré-cacheada pelo service worker: aparece quando a navegação falha sem internet.
// Sem dados da pessoa e sem chamada à API (nada de rota logada fica guardado no aparelho). PT-BR fixo: o SW não lê cookie.
export const metadata = { title: 'Sem internet · Tostão' };

export default function OfflinePage() {
  return (
    <ErrorScreen
      fullPage
      pose="dormindo"
      title="Você está sem internet"
      body="Conecte-se de novo pra ver seus dados. Nada do seu extrato fica guardado neste aparelho."
      homeLabel="Tentar de novo"
      homeHref="/inicio"
    />
  );
}
