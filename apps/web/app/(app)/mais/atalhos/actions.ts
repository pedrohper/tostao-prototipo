'use server';
import { revalidatePath } from 'next/cache';
import { createAutomationTokenBody, type CreateAutomationTokenResponse } from '@tostao/contracts';
import { api, ApiError } from '@/lib/api';
import { rethrowIfRedirect } from '@/lib/rethrow';
import { isSafePathSegment, safePathSegment } from '@/lib/safe-redirect';

export type TokenState = { error?: string; token?: string; label?: string };

/** Gera um token. O valor em claro volta UMA vez, só pra tela mostrar; o servidor guarda apenas o hash. */
export async function createAutomationToken(_: TokenState, form: FormData): Promise<TokenState> {
  const parsed = createAutomationTokenBody.safeParse({ label: form.get('label') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  try {
    const r = await api<CreateAutomationTokenResponse>('/automation-tokens', { method: 'POST', body: parsed.data });
    revalidatePath('/mais/atalhos');
    return { token: r.token, label: r.item.label };
  } catch (e) {
    rethrowIfRedirect(e);
    return { error: e instanceof ApiError ? e.message : 'Não consegui gerar o token agora.' };
  }
}

export async function revokeAutomationToken(form: FormData) {
  const id = form.get('id');
  if (!isSafePathSegment(id)) return;
  try {
    await api(`/automation-tokens/${safePathSegment(id)}`, { method: 'DELETE' });
  } catch (e) {
    rethrowIfRedirect(e);
  }
  revalidatePath('/mais/atalhos');
}
