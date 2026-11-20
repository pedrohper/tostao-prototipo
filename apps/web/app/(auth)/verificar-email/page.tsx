import { Mascot } from '@/components/mascote';
import { getI18n } from '@/lib/i18n-server';
import { ConfirmForm, ResendForm } from './verify-forms';

export default async function VerificarEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const [{ token }, { t }] = await Promise.all([searchParams, getI18n()]);
  const p = t.authPages.verifyPage;
  return (
    <>
      <div className="flex items-end gap-3">
        <Mascot pose="acenando" size={110} alt={p.mascotAlt} className="lg:hidden" />
        <div className="pb-2 lg:pb-0">
          <h1 className="font-display text-[30px] leading-[34px] font-extrabold">{p.title}</h1>
          <p className="text-[15px] text-tinta-suave">{p.subtitle}</p>
        </div>
      </div>
      {token ? <ConfirmForm token={token} t={p} /> : <ResendForm t={p} />}
    </>
  );
}
