import { Mascote } from '@/components/mascote';
import { AuthForm } from '../auth-form';

export default async function CriarContaPage({ searchParams }: { searchParams: Promise<{ convite?: string }> }) {
  const { convite } = await searchParams;
  return (
    <>
      <div className="flex items-end gap-3">
        <Mascote pose="comemorando" size={110} alt="Tostão comemorando" />
        <div className="pb-2">
          <h1 className="font-display text-[30px] leading-[34px] font-extrabold">Bem-vindo ao Tostão</h1>
          <p className="text-[15px] text-tinta-suave">Por enquanto o Tostão é só pra convidados.</p>
        </div>
      </div>
      <AuthForm mode="criar" invite={convite} />
    </>
  );
}
