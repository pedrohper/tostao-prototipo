import type { InvitesResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { resolveBackHref } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';
import { Mascot } from '@/components/mascote';
import { BackLink, Button, Card, PageFrame } from '@/components/ui';
import { createInvite } from './actions';
import { CopyLink } from './copy-link';

export default async function ConvitesPage({ searchParams }: { searchParams: Promise<{ voltar?: string }> }) {
  const [{ voltar }, { invites }, { t }] = await Promise.all([
    searchParams,
    api<InvitesResponse>('/invites'),
    getI18n(),
  ]);
  const backHref = resolveBackHref(voltar, '/aprender');
  const tc = t.pages.convites;

  return (
    <PageFrame size="focused">
      <BackLink href={backHref} label={t.common.back} />
      <div className="flex items-center gap-3">
        <Mascot pose="caramelo-moeda" size={72} alt="" />
        <div>
          <h1 className="font-display text-[28px] leading-tight font-extrabold">{tc.title}</h1>
          <p className="text-[15px] text-tinta-suave">{tc.subtitle}</p>
        </div>
      </div>
      <form action={createInvite}>
        <Button type="submit">{tc.createCta}</Button>
      </form>
      {invites.length > 0 && (
        <Card className="flex flex-col divide-y divide-linha p-0">
          {invites.map((i) => (
            <div key={i.code} className="flex items-center justify-between gap-3 p-4">
              <span
                className={`font-mono text-[15px] font-semibold ${i.usedAt ? 'text-tinta-suave line-through' : ''}`}
              >
                {i.code}
              </span>
              {i.usedAt ? (
                <span className="text-[13px] text-tinta-suave">{tc.usedBy(i.usedBy)}</span>
              ) : (
                <CopyLink code={i.code} copyLabel={tc.copyLink} copiedLabel={tc.copied} />
              )}
            </div>
          ))}
        </Card>
      )}
    </PageFrame>
  );
}
