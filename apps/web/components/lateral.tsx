import Link from 'next/link';

/** Só no desktop: ofensiva e XP no pé do menu, com o atalho de Anotar gasto. */
export function RodapeMenu({ xp, level, streakDays }: { xp: number; level: number; streakDays: number }) {
  const falta = level * 100 - xp;
  return (
    <div className="mt-auto hidden flex-col gap-2.5 md:flex">
      <div className="flex flex-col gap-2 rounded-2xl bg-amarelo-claro p-3.5">
        <div className="flex justify-between text-[13px] font-bold"><span>Ofensiva de {streakDays} {streakDays === 1 ? 'dia' : 'dias'}</span><span>{xp} XP</span></div>
        <div className="h-2 rounded-full bg-cartao"><div className="h-full rounded-full bg-tinta" style={{ width: `${Math.max(4, xp % 100)}%` }} /></div>
        <span className="text-xs text-tinta-suave">Faltam {falta} XP pro nível {level + 1}</span>
      </div>
      <Link href="/anotar" className="flex h-12 items-center justify-center gap-2 rounded-full bg-tinta text-[15px] font-semibold text-papel no-underline">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        Anotar gasto
      </Link>
    </div>
  );
}
