import Link from 'next/link';

/** Folha que sobe de baixo (Anotar, Categorizar), igual ao design: fundo escurecido que fecha ao tocar. */
export function Sheet({ back, top = 112, children }: { back: string; top?: number; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-[#8E8780] dark:bg-black/70">
      <Link href={back} aria-label="Fechar" className="block shrink-0" style={{ height: top }} />
      <div className="mx-auto flex w-full max-w-[520px] grow flex-col gap-3.5 overflow-y-auto rounded-t-[26px] bg-papel px-5 pt-3 pb-7 text-tinta">
        <div className="h-[5px] w-10 shrink-0 self-center rounded-full bg-linha" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}

export const pill = (on: boolean) =>
  `flex h-10 min-w-0 items-center justify-center gap-1 rounded-full border-[1.5px] px-3 text-sm font-semibold ${on ? 'border-tinta bg-tinta text-papel' : 'border-linha bg-cartao text-tinta'}`;
