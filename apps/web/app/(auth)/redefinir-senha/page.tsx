import { Mascote } from '@/components/mascote';
import { ResetForm } from './reset-form';

export default async function RedefinirSenhaPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <>
      <div className="flex items-end gap-3">
        <Mascote pose="pensando" size={110} alt="Tostão pensando" />
        <div className="pb-2">
          <h1 className="font-display text-[30px] leading-[34px] font-extrabold">Senha nova</h1>
          <p className="text-[15px] text-tinta-suave">Acontece com todo mundo.</p>
        </div>
      </div>
      {token ? <ResetForm token={token} /> : <p className="text-[15px]">Esse link tá incompleto. Pede um novo pra quem te convidou.</p>}
    </>
  );
}
