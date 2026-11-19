import { Mascot } from '@/components/mascote';
import { getI18n } from '@/lib/i18n-server';
import { AuthForm } from '../auth-form';
import { SocialAuthButtons } from '../social-buttons';

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ oauthError?: string }> }) {
  const [{ oauthError }, { t }] = await Promise.all([searchParams, getI18n()]);
  const p = t.authPages;
  return (
    <>
      <div className="h-11 lg:hidden" aria-hidden="true" />
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[30px] leading-[34px] font-extrabold">{p.loginTitle}</h1>
          <p className="text-sm text-tinta-suave">{p.loginSubtitle}</p>
        </div>
        <Mascot pose="acenando" size={84} alt={p.loginMascotAlt} className="lg:hidden" />
      </div>
      <SocialAuthButtons mode="entrar" oauthError={oauthError} social={p.social} form={p.form} />
      <AuthForm mode="entrar" t={p.form} />
    </>
  );
}
