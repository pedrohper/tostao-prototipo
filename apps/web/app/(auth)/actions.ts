'use server';
// Server actions: rodam no servidor quando o formulário é enviado. Funcionam até sem JavaScript no navegador.
import { redirect } from 'next/navigation';
import { loginBody, registerBody, resetPasswordBody, type AuthResponse } from '@tostao/contracts';
import { api, ApiError } from '@/lib/api';
import { setToken } from '@/lib/session';

export type FormState = { error?: string; fields?: Record<string, string> };

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const raw = Object.fromEntries(form) as Record<string, string>;
  const parsed = loginBody.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, fields: raw };
  try {
    const { token } = await api<AuthResponse>('/sessions', { method: 'POST', body: parsed.data });
    await setToken(token);
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.', fields: raw };
  }
  redirect('/inicio');
}

export async function register(_: FormState, form: FormData): Promise<FormState> {
  const raw = Object.fromEntries(form) as Record<string, string>;
  const parsed = registerBody.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, fields: raw };
  try {
    const { token } = await api<AuthResponse>('/users', { method: 'POST', body: parsed.data });
    await setToken(token);
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.', fields: raw };
  }
  redirect('/conectar?novo=1');
}

export async function resetPassword(_: FormState, form: FormData): Promise<FormState> {
  const raw = Object.fromEntries(form) as Record<string, string>;
  if (raw.password !== raw.confirm) return { error: 'As duas senhas não batem.' };
  const parsed = resetPasswordBody.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  try {
    const { token } = await api<AuthResponse>('/password-resets/redeem', { method: 'POST', body: parsed.data });
    await setToken(token);
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
  redirect('/inicio');
}
