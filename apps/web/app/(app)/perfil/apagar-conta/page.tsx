import Link from 'next/link';
import { Mascote } from '@/components/mascote';
import { BackLink, Card } from '@/components/ui';
import { DeleteAccountForm } from './delete-form';

export const metadata = { title: 'Apagar minha conta · Tostão' };

export default function ApagarContaPage() {
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/perfil" />
      <div className="flex items-center gap-3">
        <Mascote pose="triste" size={72} alt="Tostão triste" />
        <div>
          <h1 className="font-display text-[28px] leading-tight font-extrabold">Apagar minha conta</h1>
          <p className="text-[15px] text-tinta-suave">Sem ressentimento. Você manda nos seus dados.</p>
        </div>
      </div>

      <Card className="flex flex-col gap-2 text-[15px] leading-6">
        <h2 className="font-display text-lg font-extrabold">O que some</h2>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>Seus bancos são desconectados e o Tostão para de ler o extrato na hora.</li>
          <li>Contas, transações, categorias, limites, meta, renda, conversas e progresso nas lições.</li>
          <li>Os backups do servidor apagam tudo sozinhos em até 14 dias.</li>
        </ul>
        <p className="text-tinta-suave">Quer só parar de ler um banco? Dá pra desconectar ele no Perfil sem apagar a conta. Detalhes na <Link href="/privacidade" className="font-semibold underline">Política de privacidade</Link>.</p>
      </Card>

      <DeleteAccountForm />
    </div>
  );
}
