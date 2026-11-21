'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FLASH_COOKIE, parseFlash, readFlashCookie } from '@/lib/flash-toast';
import { undoFlashAction } from '@/lib/toast-actions';
import { getDictionary, type Locale } from '@/lib/i18n';
import { useToast } from './toast';

/**
 * Mostra o toast que uma Server Action deixou no cookie antes de um redirect(). Roda a cada render do layout
 * (inclusive depois de uma navegação ou de `revalidate`): ler o cookie é barato e ele é apagado na hora.
 */
export function FlashToastBridge({ locale = 'pt-BR' }: { locale?: Locale }) {
  const toast = useToast();
  const router = useRouter();
  const t = getDictionary(locale).growth.toast;

  useEffect(() => {
    const raw = readFlashCookie(document.cookie);
    if (raw === null) return;
    document.cookie = `${FLASH_COOKIE}=; Max-Age=0; path=/`;
    const flash = parseFlash(raw);
    if (!flash) return;
    const undo = flash.undo;
    toast.toast({
      message: flash.message,
      variant: flash.variant,
      ...(undo
        ? {
            actionLabel: t.undo,
            onAction: async () => {
              const { ok } = await undoFlashAction(undo).catch(() => ({ ok: false }));
              if (ok) {
                toast.info(t.undone);
                router.refresh();
              } else {
                toast.error(t.undoFailed);
              }
            },
          }
        : {}),
    });
  });

  return null;
}
