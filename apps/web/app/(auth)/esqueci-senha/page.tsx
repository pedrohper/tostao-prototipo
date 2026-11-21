import { Mascot } from '@/components/mascote';
import { getI18n } from '@/lib/i18n-server';
import { ForgotForm } from './forgot-form';

export default async function EsqueciSenhaPage() {
  const { t } = await getI18n();
  const p = t.authPages.forgotPage;
  return (
    <>
      <div className="flex items-end gap-3">
        <Mascot pose="pensando" size={110} alt={p.mascotAlt} className="lg:hidden" />
        <div className="pb-2 lg:pb-0">
          <h1 className="font-display text-[30px] leading-[34px] font-extrabold">{p.title}</h1>
          <p className="text-[15px] text-tinta-suave">{p.subtitle}</p>
        </div>
      </div>
      <ForgotForm t={p} />
    </>
  );
}
