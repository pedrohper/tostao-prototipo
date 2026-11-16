import { Mascot } from '@/components/mascote';
import { getI18n } from '@/lib/i18n-server';
import { ResetForm } from './reset-form';

export default async function RedefinirSenhaPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const [{ token }, { t }] = await Promise.all([searchParams, getI18n()]);
  const p = t.authPages;
  return (
    <>
      <div className="flex items-end gap-3">
        <Mascot pose="pensando" size={110} alt={p.resetMascotAlt} className="lg:hidden" />
        <div className="pb-2 lg:pb-0">
          <h1 className="font-display text-[30px] leading-[34px] font-extrabold">{p.resetTitle}</h1>
          <p className="text-[15px] text-tinta-suave">{p.resetSubtitle}</p>
        </div>
      </div>
      {token ? <ResetForm token={token} t={p.resetForm} /> : <p className="text-[15px]">{p.resetInvalidToken}</p>}
    </>
  );
}
