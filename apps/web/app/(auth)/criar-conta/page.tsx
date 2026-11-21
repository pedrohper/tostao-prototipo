import { Mascot } from '@/components/mascote';
import { BackLink } from '@/components/ui';
import { redirectIfAuthenticated } from '@/lib/auth-redirect';
import { getI18n } from '@/lib/i18n-server';
import { AuthForm } from '../auth-form';
import { SocialAuthButtons } from '../social-buttons';

export default async function CriarContaPage({
  searchParams,
}: {
  searchParams: Promise<{ convite?: string; oauthError?: string }>;
}) {
  await redirectIfAuthenticated();
  const [{ convite, oauthError }, { t }] = await Promise.all([searchParams, getI18n()]);
  const p = t.authPages;
  return (
    <>
      <div className="flex items-center gap-3">
        <BackLink href="/entrar" label={t.common.back} />
        <div
          className="h-2 grow overflow-hidden rounded-full border border-linha bg-papel-2"
          role="img"
          aria-label={p.signupStepAria}
        >
          <div className="h-full w-1/3 rounded-full bg-tinta" />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[30px] leading-[34px] font-extrabold">{p.signupTitle}</h1>
          <p className="text-sm text-tinta-suave">{p.signupSubtitle}</p>
        </div>
        <Mascot pose="dupla" size={92} alt={p.signupMascotAlt} className="lg:hidden" />
      </div>
      <SocialAuthButtons mode="criar" invite={convite} oauthError={oauthError} social={p.social} form={p.form} />
      <AuthForm mode="criar" invite={convite} t={p.form} />
    </>
  );
}
