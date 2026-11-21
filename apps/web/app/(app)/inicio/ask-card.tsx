'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mascot } from '@/components/mascote';
import { getDictionary, type Locale } from '@/lib/i18n';

/** Quick-ask card on the Home (`compact` = mobile: chips em uma linha rolável, sem título grande): chips and input route directly to /tostao with ?q=. */
export function AskTostaoCard({ locale = 'pt-BR', compact = false }: { locale?: Locale; compact?: boolean }) {
  const t = getDictionary(locale);
  const router = useRouter();
  const inputId = useId();
  const [query, setQuery] = useState('');

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/tostao?q=${encodeURIComponent(trimmed)}` : '/tostao');
  }

  return (
    <section
      className={`flex flex-col gap-3 rounded-[22px] border border-linha bg-cartao ${compact ? 'p-3.5' : 'p-[18px_20px]'}`}
    >
      <div className="flex items-center gap-2.5">
        <Mascot pose="avatar" size={compact ? 28 : 36} still />
        <h2
          className={`font-display font-extrabold text-tinta ${compact ? 'text-[16px] leading-5' : 'text-[18px] leading-6'}`}
        >
          {t.home.askTostao}
        </h2>
      </div>
      <div className={compact ? '-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5' : 'flex flex-wrap gap-2'}>
        {t.home.askChips.map((chip) => (
          <Link
            key={chip}
            href={`/tostao?q=${encodeURIComponent(chip)}`}
            className="flex min-h-9 shrink-0 items-center rounded-full bg-papel-2 px-3.5 py-1.5 text-[13px] whitespace-nowrap font-semibold text-tinta no-underline hover:bg-linha/50"
          >
            {chip}
          </Link>
        ))}
      </div>
      <form action="/tostao" method="GET" onSubmit={handleSubmit} className="mt-auto flex items-center gap-2 pt-1">
        <label htmlFor={inputId} className="sr-only">
          {t.home.askTostao}
        </label>
        <input
          id={inputId}
          name="q"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.home.askPlaceholder}
          className={`${compact ? 'h-11' : 'h-12'} min-w-0 flex-1 rounded-full border-[1.5px] border-linha bg-papel px-4 text-[15px] text-tinta outline-none placeholder:text-tinta-suave focus:border-tinta`}
        />
        <button
          type="submit"
          aria-label={t.home.askSendLabel}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-tinta text-papel"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 19V5" />
            <path d="M5 12l7-7 7 7" />
          </svg>
        </button>
      </form>
    </section>
  );
}
