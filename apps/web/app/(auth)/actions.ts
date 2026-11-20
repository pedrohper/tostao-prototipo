'use server';
// Server actions: rodam no servidor quando o formulário é enviado. Funcionam até sem JavaScript no navegador.
import { redirect } from 'next/navigation';
import {
  loginBody,
  passwordResetRequestBody,
  registerBody,
  resetPasswordBody,
  verifyEmailBody,
  type AuthResponse,
  type PasswordResetRequestResponse,
} from '@tostao/contracts';
import { api, ApiError } from '@/lib/api';
import { rethrowIfRedirect } from '@/lib/rethrow';
import { setSession } from '@/lib/session';
import { safeAuthFields } from '@/lib/safe-auth-fields';

export type FormState = { error?: string; fields?: Record<string, string> };
/** Telas de uma etapa só (esqueci a senha, verificar e-mail): `done` troca o formulário pela mensagem. */
export type NoticeState = { error?: string; done?: boolean };

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const raw = Object.fromEntries(form) as Record<string, string>;
  const parsed = loginBody.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, fields: safeAuthFields(raw) };
  try {
    const tokens = await api<AuthResponse>('/sessions', {
      method: 'POST',
      body: parsed.data,
      skipAuthRedirect: true,
    });
    await setSession(tokens);
  } catch (e) {
    rethrowIfRedirect(e);
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.', fields: safeAuthFields(raw) };
  }
  redirect('/inicio');
}

export async function register(_: FormState, form: FormData): Promise<FormState> {
  const raw = Object.fromEntries(form) as Record<string, string>;
  // Checkbox marcado chega como "on"; desmarcado nem chega. O servidor da API também exige (acceptedTerms: true).
  const parsed = registerBody.safeParse({ ...raw, acceptedTerms: raw.acceptedTerms === 'on' });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, fields: safeAuthFields(raw) };
  try {
    const tokens = await api<AuthResponse>('/users', { method: 'POST', body: parsed.data, skipAuthRedirect: true });
    await setSession(tokens);
  } catch (e) {
    rethrowIfRedirect(e);
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.', fields: safeAuthFields(raw) };
  }
  redirect('/conectar?novo=1');
}

export async function resetPassword(_: FormState, form: FormData): Promise<FormState> {
  const raw = Object.fromEntries(form) as Record<string, string>;
  if (raw.password !== raw.confirm) return { error: 'As duas senhas não batem.' };
  const parsed = resetPasswordBody.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  try {
    const tokens = await api<AuthResponse>('/password-resets/redeem', {
      method: 'POST',
      body: parsed.data,
      skipAuthRedirect: true,
    });
    await setSession(tokens);
  } catch (e) {
    rethrowIfRedirect(e);
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
  redirect('/inicio');
}

/**
 * "Esqueci minha senha". A tela responde igual exista a conta ou não (a API já devolve sempre 202):
 * o único erro que aparece é e-mail malformado, limite de tentativas ou API fora do ar.
 */
export async function requestPasswordReset(_: NoticeState, form: FormData): Promise<NoticeState> {
  const parsed = passwordResetRequestBody.safeParse({ email: String(form.get('email') ?? '') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  try {
    await api<PasswordResetRequestResponse>('/password-resets', {
      method: 'POST',
      body: parsed.data,
      skipAuthRedirect: true,
    });
    return { done: true };
  } catch (e) {
    rethrowIfRedirect(e);
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
}

/** Confirma o e-mail com o link recebido. Só roda no clique (scanner de e-mail que abre o link não gasta o token). */
export async function confirmEmail(_: NoticeState, form: FormData): Promise<NoticeState> {
  const parsed = verifyEmailBody.safeParse({ token: String(form.get('token') ?? '') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  try {
    await api('/auth/verify-email', { method: 'POST', body: parsed.data, skipAuthRedirect: true });
    return { done: true };
  } catch (e) {
    rethrowIfRedirect(e);
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
}

/** Reenvia o link de verificação. Exige sessão: sem login, o api() leva pra /entrar. */
export async function resendVerification(): Promise<NoticeState> {
  try {
    await api('/auth/resend-verification', { method: 'POST', body: {} });
    return { done: true };
  } catch (e) {
    rethrowIfRedirect(e);
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
}
