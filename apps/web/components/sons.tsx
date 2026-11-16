'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { areSoundsEnabled, playSound, setSoundsEnabled, subscribeSounds, type SoundEffect } from '@/lib/sons';
import { getDictionary, type Locale } from '@/lib/i18n';

/** Plays a short tap sound on buttons and navigation links. Mounted in the app layout. */
export function TapSoundListener() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest('button, nav a, [role="switch"]');
      if (el && !(el as HTMLButtonElement).disabled) playSound('toque');
    };
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);
  return null;
}

/** Plays a sound once when mounted (e.g. lesson completed, goal reached). */
export function SoundOnMount({ som }: { som: SoundEffect }) {
  useEffect(() => {
    playSound(som);
  }, [som]);
  return null;
}

/**
 * Celebrates newly completed missions compared against what the user last saw today.
 * First mission of the day plays the streak sound; subsequent ones play the mission sound.
 */
export function MissionCompletionToast({
  day,
  done,
  streak,
  locale = 'pt-BR',
}: {
  day: string;
  done: number;
  streak: number;
  locale?: Locale;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const t = getDictionary(locale);

  useEffect(() => {
    const storageKey = `tostao-missoes-${day}`;
    let previousDone: number;
    try {
      previousDone = Number(localStorage.getItem(storageKey) ?? '-1');
      localStorage.setItem(storageKey, String(done));
    } catch {
      return;
    }
    if (previousDone < 0 || done <= previousDone) return;
    const isFirstToday = previousDone === 0;
    playSound(isFirstToday ? 'ofensiva' : 'missao');
    const showTimer = setTimeout(
      () => setMessage(isFirstToday ? t.profile.streakToast(streak) : t.profile.missionDoneToast),
      0,
    );
    const hideTimer = setTimeout(() => setMessage(null), 2800);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [day, done, streak, t.profile]);

  if (!message) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-4 z-30 mx-auto w-fit rounded-full bg-tinta px-4 py-2 text-sm font-semibold text-papel shadow-lg">
      {message}
    </div>
  );
}

/** Sound effects toggle card in Profile. */
export function SoundToggleCard({ locale = 'pt-BR', embedded = false }: { locale?: Locale; embedded?: boolean }) {
  const enabled = useSyncExternalStore(subscribeSounds, areSoundsEnabled, () => null);
  const t = getDictionary(locale);

  return (
    <section
      className={
        embedded
          ? 'flex flex-col gap-1.5 py-3.5'
          : 'flex flex-col gap-2.5 rounded-[22px] border border-linha bg-cartao p-4'
      }
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[15px] font-semibold text-tinta">{t.profile.soundsTitle}</span>
        {enabled !== null && (
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={t.profile.soundsTitle}
            onClick={() => {
              const next = !enabled;
              setSoundsEnabled(next);
              if (next) setTimeout(() => playSound('moeda'), 0);
            }}
            className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors ${enabled ? 'bg-menta' : 'bg-papel-2 ring-1 ring-linha'}`}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-cartao shadow ring-1 ring-black/5 transition-all ${
                enabled ? 'left-[24px]' : 'left-1'
              }`}
            />
          </button>
        )}
      </div>
      <p className="text-[13px] leading-[19px] text-tinta-suave">{t.profile.soundsDescription}</p>
    </section>
  );
}

