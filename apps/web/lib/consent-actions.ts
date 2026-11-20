'use server';
import { revalidatePath } from 'next/cache';
import type { ConsentsResponse } from '@tostao/contracts';
import { api, ApiError } from './api';
import { rethrowIfRedirect } from './rethrow';

export type ConsentResult = { ok: true } | { ok: false; error: string };

/** LGPD: aceitar (true) ou revogar (false) o uso de IA. Sem aceite, chat e categorização automática ficam bloqueados. */
export async function setAiConsentAction(accepted: boolean): Promise<ConsentResult> {
  try {
    await api<ConsentsResponse>('/me/consents', { method: 'PATCH', body: { aiConsent: accepted } });
  } catch (e) {
    rethrowIfRedirect(e);
    return { ok: false, error: e instanceof ApiError ? e.message : 'Não consegui salvar agora. Tenta de novo.' };
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}
