'use server';
import { redirect } from 'next/navigation';
import { deleteAccountBody } from '@tostao/contracts';
import { api, ApiError } from '@/lib/api';
import { clearToken } from '@/lib/session';

export type DeleteAccountState = { error?: string };

export async function deleteAccount(_: DeleteAccountState, form: FormData): Promise<DeleteAccountState> {
  if (form.get('confirmo') !== 'on') return { error: 'Marca a caixinha pra confirmar.' };
  const parsed = deleteAccountBody.safeParse({ password: form.get('password') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  try {
    await api('/me/delete', { method: 'POST', body: parsed.data });
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
  await clearToken();
  redirect('/?conta=apagada');
}
