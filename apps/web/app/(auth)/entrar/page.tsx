import { Mascot } from '@/components/mascote';
import { getI18n } from '@/lib/i18n-server';
import { AuthForm } from '../auth-form';

export default async function EntrarPage() {
  const { t } = await getI18n();
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
      <AuthForm mode="entrar" t={p.form} />
    </>
  );
}
