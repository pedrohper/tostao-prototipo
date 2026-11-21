'use client';
import { useState, useTransition } from 'react';
import { getDictionary, type Locale } from '@/lib/i18n';
import { type ThemePreference } from '@/lib/theme';
import { setThemeAction } from '@/lib/theme-actions';

const THEME_OPTIONS: readonly { code: ThemePreference; icon: 'system' | 'light' | 'dark' }[] = [
  { code: 'system', icon: 'system' },
  { code: 'light', icon: 'light' },
  { code: 'dark', icon: 'dark' },
];

function ThemeIcon({ kind }: { kind: 'system' | 'light' | 'dark' }) {
  if (kind === 'light') {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
    );
  }
  if (kind === 'dark') {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    );
  }
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

function applyThemeToDom(next: ThemePreference) {
  const root = document.documentElement;
  if (next === 'system') {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = next;
  }
}

export function ThemeSwitcher({
  initialTheme,
  locale,
  embedded = false,
}: {
  initialTheme: ThemePreference;
  locale: Locale;
  embedded?: boolean;
}) {
  const [theme, setTheme] = useState<ThemePreference>(initialTheme);
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
        <span className="text-[15px] font-semibold text-tinta">{t.profile.themeTitle}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {THEME_OPTIONS.map((opt) => {
            const isSelected = opt.code === theme;
            return (
              <button
                key={opt.code}
                type="button"
                disabled={isPending}
                onClick={() => {
                  if (opt.code === theme) return;
                  setTheme(opt.code);
                  applyThemeToDom(opt.code);
                  startTransition(async () => {
                    await setThemeAction(opt.code);
                  });
                }}
                aria-pressed={isSelected}
                className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors disabled:opacity-60 ${
                  isSelected ? 'bg-tinta text-papel' : 'bg-papel-2 text-tinta-suave hover:text-tinta'
                }`}
              >
                <ThemeIcon kind={opt.icon} />
                <span>{t.profile.themeOptions[opt.code]}</span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-[13px] leading-[19px] text-tinta-suave">{t.profile.themeDescription}</p>
    </section>
  );
}
