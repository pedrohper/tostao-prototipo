import { cookies } from 'next/headers';
import { encodeFlash, FLASH_COOKIE, FLASH_MAX_AGE_SECONDS, type FlashToast } from './flash-toast';
import type { ToastVariant } from './toast-state';

/**
 * Pra Server Actions que terminam em redirect(): grava o aviso que o ToastProvider mostra na tela seguinte.
 * Chamar ANTES do redirect(). Nunca lança: toast é conforto, não pode derrubar a ação.
 */
export async function flashToast(message: string, variant: ToastVariant = 'success', undo?: FlashToast['undo']) {
  try {
    (await cookies()).set(FLASH_COOKIE, encodeFlash({ message, variant, ...(undo ? { undo } : {}) }), {
      path: '/',
      maxAge: FLASH_MAX_AGE_SECONDS,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: false, // o ToastProvider lê no navegador
    });
  } catch {
    /* sem toast, a ação continua valendo */
  }
}
