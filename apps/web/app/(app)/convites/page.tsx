import type { InvitesResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { Mascote } from '@/components/mascote';
import { BackLink, Button, Card } from '@/components/ui';
import { createInvite } from './actions';
import { CopyLink } from './copy-link';

export default async function ConvitesPage() {
  const { invites } = await api<InvitesResponse>('/invites');
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/perfil" />
      <div className="flex items-center gap-3">
        <Mascote pose="caramelo-moeda" size={72} alt="" />
        <div>
          <h1 className="font-display text-[28px] leading-tight font-extrabold">Convidar alguém</h1>
          <p className="text-[15px] text-tinta-suave">Cada convite vale pra uma pessoa só.</p>
        </div>
      </div>
      <form action={createInvite}><Button type="submit">Gerar convite</Button></form>
      {invites.length > 0 && (
        <Card className="flex flex-col divide-y divide-linha p-0">
          {invites.map((i) => (
            <div key={i.code} className="flex items-center justify-between gap-3 p-4">
              <span className={`font-mono text-[15px] font-semibold ${i.usedAt ? 'text-tinta-suave line-through' : ''}`}>{i.code}</span>
              {i.usedAt ? <span className="text-[13px] text-tinta-suave">usado por {i.usedBy ?? 'alguém'}</span> : <CopyLink code={i.code} />}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
