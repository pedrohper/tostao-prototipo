'use client';
import { useTransition } from 'react';
import { getDictionary, type Locale } from '@/lib/i18n';
import { setLocaleAction } from '@/lib/i18n-actions';

const OPTIONS: { code: Locale; label: string; flag: string }[] = [
  { code: 'pt-BR', label: 'Português', flag: '🇧🇷' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
];

export function LanguageSwitcher({ locale, embedded = false }: { locale: Locale; embedded?: boolean }) {
  const [isPending, startTransition] = useTransition();
  const t = getDictionary(locale);

  return (
    <section
      className={
        embedded
          ? 'flex flex-col gap-2 py-3.5'
          : 'flex flex-col gap-2.5 rounded-[22px] border border-linha bg-cartao p-4'
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <span className="text-[15px] font-semibold text-tinta">{t.profile.languageTitle}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {OPTIONS.map((opt) => {
            const isSelected = opt.code === locale;
            return (
              <button
                key={opt.code}
                type="button"
                disabled={isPending}
                onClick={() => {
                  if (opt.code === locale) return;
                  startTransition(async () => {
                    await setLocaleAction(opt.code);
                  });
                }}
                aria-pressed={isSelected}
                className={`flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                  isSelected ? 'bg-tinta text-papel' : 'bg-papel-2 text-tinta-suave hover:text-tinta'
                }`}
              >
                <span aria-hidden="true">{opt.flag}</span>
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-[13px] leading-[19px] text-tinta-suave">{t.profile.languageDescription}</p>
    </section>
  );
}
