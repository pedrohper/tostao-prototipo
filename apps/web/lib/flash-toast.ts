// "Flash" de toast: a Server Action grava um cookie curto antes do redirect() e o ToastProvider (no layout, que
// persiste entre telas) lê e mostra. Assim o aviso sobrevive à navegação sem depender do componente que submeteu.
// Parte pura (nome do cookie, codificar e ler): a escrita fica em flash-toast-server.ts.

import type { ToastVariant } from './toast-state';

export const FLASH_COOKIE = 'tostao-flash';
/** O cookie só precisa durar até a próxima tela carregar. */
export const FLASH_MAX_AGE_SECONDS = 30;

/** "Desfazer" que o servidor sabe refazer sem endpoint novo. */
export type FlashUndo = { kind: 'categorize'; id: string; categoryId: string };

export type FlashToast = {
  message: string;
  variant: ToastVariant;
  undo?: FlashUndo;
};

const VARIANTS: readonly string[] = ['success', 'error', 'info'];
const MAX_MESSAGE = 160;
const SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;

export function encodeFlash(flash: FlashToast): string {
  return encodeURIComponent(JSON.stringify({ ...flash, message: flash.message.slice(0, MAX_MESSAGE) }));
}

/** O "desfazer" também chega por Server Action (entrada do navegador): mesma validação rígida. */
export function parseFlashUndo(raw: unknown): FlashUndo | null {
  if (!raw || typeof raw !== 'object') return null;
  const u = raw as Record<string, unknown>;
  if (u.kind !== 'categorize' || typeof u.id !== 'string' || typeof u.categoryId !== 'string') return null;
  if (!SEGMENT.test(u.id) || !SEGMENT.test(u.categoryId)) return null;
  return { kind: 'categorize', id: u.id, categoryId: u.categoryId };
}

/** Valida tudo: o cookie é editável pelo usuário, então nada dele vira ação sem passar por aqui. */
export function parseFlash(raw: string | null | undefined): FlashToast | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const { message, variant, undo } = data as Record<string, unknown>;
  if (typeof message !== 'string' || message.trim() === '') return null;
  if (typeof variant !== 'string' || !VARIANTS.includes(variant)) return null;
  const flash: FlashToast = { message: message.slice(0, MAX_MESSAGE), variant: variant as ToastVariant };
  const parsedUndo = parseFlashUndo(undo);
  if (parsedUndo) flash.undo = parsedUndo;
  return flash;
}

/** Lê o valor do cookie num `document.cookie` (ou null se não houver). */
export function readFlashCookie(cookieString: string): string | null {
  for (const part of cookieString.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === FLASH_COOKIE) return rest.join('=') || null;
  }
  return null;
}
