import { Mascote } from '@/components/mascote';
import { AuthForm } from '../auth-form';

export default function EntrarPage() {
  return (
    <>
      <div className="h-11" aria-hidden="true" />
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[30px] leading-[34px] font-extrabold">Bom te ver de novo</h1>
          <p className="text-sm text-tinta-suave">Entre pra ver como anda sua grana.</p>
        </div>
        <Mascote pose="acenando" size={84} alt="Tostão acenando" />
      </div>
      <AuthForm mode="entrar" />
    </>
  );
}
