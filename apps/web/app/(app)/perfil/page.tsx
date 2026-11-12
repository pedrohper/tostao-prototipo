import Link from 'next/link';
import type { ProfileResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { Mascote } from '@/components/mascote';
import { Card } from '@/components/ui';

export default async function PerfilPage() {
  const me = await api<ProfileResponse>('/me');
  const desde = new Date(me.createdAt).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Mascote pose="avatar" size={80} alt="" className="rounded-full bg-amarelo-claro" />
        <div>
          <h1 className="font-display text-[28px] leading-tight font-extrabold">{me.name}</h1>
          <p className="text-sm text-tinta-suave">{me.email} · desde {desde}</p>
        </div>
      </div>
      <Card className="flex flex-col divide-y divide-linha p-0">
        <Link href="/conectar" className="flex justify-between p-4 no-underline"><span className="font-semibold">Bancos conectados</span><span className="text-tinta-suave">{me.connections.length} ›</span></Link>
        <Link href="/categorias" className="flex justify-between p-4 no-underline"><span className="font-semibold">Minhas categorias</span><span className="text-tinta-suave">›</span></Link>
        <Link href="/limites" className="flex justify-between p-4 no-underline"><span className="font-semibold">Limites do mês</span><span className="text-tinta-suave">›</span></Link>
        <Link href="/fechamento" className="flex justify-between p-4 no-underline"><span className="font-semibold">Fechamento do mês</span><span className="text-tinta-suave">›</span></Link>
        <Link href="/assinaturas" className="flex justify-between p-4 no-underline"><span className="font-semibold">Minhas assinaturas</span><span className="text-tinta-suave">›</span></Link>
        <Link href="/anotar" className="flex justify-between p-4 no-underline"><span className="font-semibold">Anotar gasto</span><span className="text-tinta-suave">›</span></Link>
        <Link href="/convites" className="flex justify-between p-4 no-underline"><span className="font-semibold">Convidar alguém</span><span className="text-tinta-suave">›</span></Link>
        <Link href="/aprender" className="flex justify-between p-4 no-underline"><span className="font-semibold">Minha trilha</span><span className="text-tinta-suave">›</span></Link>
      </Card>
      <div className="flex items-center gap-3 rounded-[20px] bg-amarelo-claro p-3">
        <Mascote pose="caramelo-moeda" size={64} alt="Caramelo com uma moeda" />
        <p className="text-sm">Isso aqui é um protótipo. Achou algo estranho? Anota e conta pro Pedro.</p>
      </div>
      <a href="/sair" className="flex h-[50px] items-center justify-center rounded-full border-[1.5px] border-tinta font-semibold no-underline">Sair</a>
    </div>
  );
}
