import Link from 'next/link';

const base = 'flex items-center justify-center rounded-full font-semibold transition active:translate-y-px disabled:opacity-50';

export function ButtonLink({ href, children, variant = 'primary' }: { href: string; children: React.ReactNode; variant?: 'primary' | 'outline' | 'dark' }) {
  return <Link href={href} className={`${base} ${variants[variant]}`}>{children}</Link>;
}

export function Button({ children, variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' | 'dark' }) {
  return <button {...props} className={`${base} w-full ${variants[variant]} ${props.className ?? ''}`}>{children}</button>;
}

const variants = {
  primary: 'h-[54px] bg-laranja text-[#1E1B18] text-base font-bold shadow-[0_2px_0_rgba(30,27,24,0.14)]',
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
  return <div className={`rounded-[20px] bg-cartao p-4 ${className}`}>{children}</div>;
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
