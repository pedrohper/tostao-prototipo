import { Selo } from '@/components/selo';

/** Faixa "isto veio do seu extrato" que aparece nos simuladores pré-preenchidos (T4.5). */
export function PresetHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl bg-menta-clara p-2.5 text-xs leading-snug font-semibold text-verde-texto">
      <Selo tipo="dados" />
      {children}
    </p>
  );
}
