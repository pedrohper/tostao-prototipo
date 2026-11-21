import Link from 'next/link';

import { resolveBackHref } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';
import { Mascot } from '@/components/mascote';
import { BackLink, Card, PageFrame } from '@/components/ui';
import { DeleteAccountForm } from './delete-form';
import { getMe } from '@/lib/api-queries';

export const metadata = { title: 'Apagar minha conta · Tostão' };

export default async function ApagarContaPage({ searchParams }: { searchParams: Promise<{ voltar?: string }> }) {
  const [{ voltar }, { t }, me] = await Promise.all([searchParams, getI18n(), getMe()]);
  const backHref = resolveBackHref(voltar, '/mais');
  const td = t.pages.deleteAccount;

  return (
    <PageFrame size="focused">
      <BackLink href={backHref} label={t.common.back} />
      <div className="flex items-center gap-3">
        <Mascot pose="triste" size={72} alt={td.mascotAlt} />
        <div>
          <h1 className="font-display text-[28px] leading-tight font-extrabold">{td.title}</h1>
          <p className="text-[15px] text-tinta-suave">{td.subtitle}</p>
        </div>
      </div>

      <Card className="flex flex-col gap-2 text-[15px] leading-6">
        <h2 className="font-display text-lg font-extrabold">{td.whatGoesTitle}</h2>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {td.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="text-tinta-suave">
          {td.disconnectHintBefore}
          <Link href="/privacidade" className="font-semibold underline">
            {td.privacyLink}
          </Link>
          .
        </p>
      </Card>

      <DeleteAccountForm
        hasPassword={me.hasPassword}
        email={me.email}
        labels={{
          passwordLabel: td.form.passwordLabel,
          emailLabel: td.form.emailLabel,
          emailHint: td.form.emailHint(me.email),
          confirmLabel: td.form.confirmLabel,
          submit: td.form.submit,
          pending: td.form.pending,
        }}
      />
    </PageFrame>
  );
}
