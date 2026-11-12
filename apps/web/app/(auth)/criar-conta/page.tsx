import { Mascote } from '@/components/mascote';
import { BackLink } from '@/components/ui';
import { AuthForm } from '../auth-form';

export default async function CriarContaPage({ searchParams }: { searchParams: Promise<{ convite?: string }> }) {
  const { convite } = await searchParams;
  return (
    <>
      <div className="flex items-center gap-3">
        <BackLink href="/entrar" />
        <div className="h-2 grow overflow-hidden rounded-full border border-linha bg-papel-2" role="img" aria-label="Passo 1 de 2">
          <div className="h-full w-1/2 rounded-full bg-tinta" />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[30px] leading-[34px] font-extrabold">Crie sua conta</h1>
          <p className="text-sm text-tinta-suave">Pra eu guardar seu progresso e suas metas.</p>
        </div>
        <Mascote pose="orgulhoso" size={80} alt="Tostão orgulhoso de braços cruzados" />
      </div>
      <AuthForm mode="criar" invite={convite} />
    </>
  );
}
