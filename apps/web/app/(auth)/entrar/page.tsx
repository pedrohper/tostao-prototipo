import { Mascote } from '@/components/mascote';
import { AuthForm } from '../auth-form';

export default function EntrarPage() {
  return (
    <>
      <div className="flex items-end gap-3">
        <Mascote pose="acenando" size={110} alt="Tostão acenando" />
        <div className="pb-2">
          <h1 className="font-display text-[30px] leading-[34px] font-extrabold">Bora de novo?</h1>
          <p className="text-[15px] text-tinta-suave">Seu dinheiro sentiu sua falta.</p>
        </div>
      </div>
      <AuthForm mode="entrar" />
    </>
  );
}
