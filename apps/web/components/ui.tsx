import { Icone } from './icone';
import Link from 'next/link';

const base = 'flex items-center justify-center rounded-full font-semibold transition active:translate-y-px disabled:opacity-50';

export function ButtonLink({ href, children, variant = 'primary' }: { href: string; children: React.ReactNode; variant?: 'primary' | 'outline' | 'dark' | 'laranja' }) {
  return <Link href={href} className={`${base} ${variants[variant]}`}>{children}</Link>;
}

export function Button({ children, variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' | 'dark' | 'laranja' }) {
  return <button {...props} className={`${base} w-full ${variants[variant]} ${props.className ?? ''}`}>{children}</button>;
}

const variants = {
  // Igual ao artefato: botão principal é tinta; laranja só no "Conectar meu banco" e no desafio da lição.
  primary: 'h-[54px] bg-tinta text-papel text-base',
  laranja: 'h-[54px] bg-laranja text-[#1E1B18] text-base font-bold shadow-[0_2px_0_rgba(30,27,24,0.14)]',
  outline: 'h-[50px] border-[1.5px] border-tinta text-tinta text-[15px]',
  dark: 'h-[54px] bg-tinta text-papel text-base',
};

export function Field({ label, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">{label}</span>
      <input {...props} className="h-[52px] rounded-2xl border-[1.5px] border-linha bg-cartao px-4 text-base outline-none focus:border-tinta" />
      {error && <span className="text-[13px] font-medium text-vermelho-texto">{error}</span>}
    </label>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[20px] border border-linha bg-cartao p-4 ${className}`}>{children}</div>;
}

export function ErrorNote({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" className="rounded-2xl bg-rosa px-4 py-3 text-sm font-medium">{message}</p>;
}

export function BackLink({ href, label = 'Voltar' }: { href: string; label?: string }) {
  return (
    <Link href={href} aria-label={label} className="-ml-2.5 flex h-11 w-11 items-center justify-center">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
    </Link>
  );
}

/** Rótulo pequeno em caixa alta, como "CONTAS CONECTADAS" no design. */
export function Eyebrow({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase ${className}`}>{children}</span>;
}

export function CardIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <rect x="2" y="5" width="20" height="14" rx="3" /><path d="M2 10h20" /><path d="M6 15h4" />
    </svg>
  );
}

export function BankIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M3 21h18" /><path d="M5 21V11M9.5 21V11M14.5 21V11M19 21V11" /><path d="M12 3L3 8.5h18z" />
    </svg>
  );
}

/** Foguinho da ofensiva (dias seguidos com lição). */
export function StreakChip({ days }: { days: number }) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-amarelo-claro px-2.5 py-1.5 text-sm font-bold" aria-label={`${days} ${days === 1 ? 'dia' : 'dias'} de ofensiva`}>
      <Icone src="ui/ofensiva" size={18} />
      {days}
    </span>
  );
}
