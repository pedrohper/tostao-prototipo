import { Suspense } from 'react';
import { TapSoundListener } from '@/components/sons';
import { redirect } from 'next/navigation';
import { getToken } from '@/lib/session';
import { MenuCarregando, MenuComDados } from '@/components/menu-com-dados';
import { OnboardingShell } from '@/components/onboarding-shell';
import { ToastProvider } from '@/components/toast';
import { FlashToastBridge } from '@/components/flash-toast-bridge';
import { ServiceWorkerRegister } from '@/components/sw-register';
import { getLocale } from '@/lib/i18n-server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await getToken())) redirect('/entrar');
  // Nada de esperar a API aqui: o que o menu mostra de número chega depois, sem segurar a tela.
  const locale = await getLocale();

  return (
    <ToastProvider locale={locale}>
      <OnboardingShell
        locale={locale}
        nav={
          <Suspense fallback={<MenuCarregando locale={locale} />}>
            <MenuComDados locale={locale} />
          </Suspense>
        }
      >
        {children}
      </OnboardingShell>
      <TapSoundListener />
      <FlashToastBridge locale={locale} />
      <ServiceWorkerRegister />
    </ToastProvider>
  );
}
