'use client';

import { useRef, useState } from 'react';
import type { PersonDTO } from '@tostao/contracts';

/** Carrossel de pessoas + botão "+ Novo acerto" no final para vincular um lançamento em Acertos. */
export function AcertoPicker({
  people,
  placeholder,
  ariaLabel,
  submitLabel,
  newLabel = 'Novo acerto',
  defaultExpanded = false,
}: {
  people: PersonDTO[];
  placeholder: string;
  ariaLabel: string;
  submitLabel: string;
  newLabel?: string;
  defaultExpanded?: boolean;
}) {
  const [adding, setAdding] = useState(people.length === 0 || defaultExpanded);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="-mx-1 flex min-w-0 items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {people.map((p) => (
          <button
            key={p.id}
            type="submit"
            name="personName"
            value={p.name}
            className="h-9 shrink-0 rounded-full bg-papel-2 px-3.5 text-small font-semibold whitespace-nowrap text-tinta transition-colors hover:bg-linha/60"
          >
            {p.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setAdding(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className={`h-9 shrink-0 rounded-full border border-dashed px-3.5 text-small font-semibold whitespace-nowrap transition-colors ${
            adding
              ? 'border-tinta bg-papel-2 text-tinta'
              : 'border-laranja-texto text-laranja-texto hover:bg-laranja-claro/40'
          }`}
        >
          + {newLabel}
        </button>
      </div>
      {adding && (
        <div className="flex gap-2">
          <input
            ref={inputRef}
            name="personName"
            maxLength={40}
            placeholder={placeholder}
            aria-label={ariaLabel}
            autoComplete="off"
            className="h-11 min-w-0 flex-1 rounded-xl border-[1.5px] border-linha bg-papel px-3 text-base outline-none focus:border-tinta"
          />
          <button type="submit" className="h-11 shrink-0 rounded-full bg-tinta px-4 text-sm font-semibold text-papel">
            {submitLabel}
          </button>
        </div>
      )}
    </div>
  );
}
