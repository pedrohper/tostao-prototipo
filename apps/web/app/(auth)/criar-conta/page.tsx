import { Mascote } from '@/components/mascote';
import { AuthForm } from '../auth-form';

export default function CriarContaPage() {
  return (
    <>
      <div className="flex items-end gap-3">
        <Mascote pose="comemorando" size={110} alt="Tostão comemorando" />
        <div className="pb-2">
          <h1 className="font-display text-[30px] leading-[34px] font-extrabold">Bem-vindo ao Tostão</h1>
          <p className="text-[15px] text-tinta-suave">Grana explicada, de tostão em tostão.</p>
        </div>
      </div>
      <AuthForm mode="criar" />
    </>
  );
}
