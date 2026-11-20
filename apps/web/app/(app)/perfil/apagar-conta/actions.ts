'use server';
import { redirect } from 'next/navigation';
import { deleteAccountBody, type DeleteAccountResponse } from '@tostao/contracts';
import { api, ApiError } from '@/lib/api';
import { clearSession } from '@/lib/session';
import { rethrowIfRedirect } from '@/lib/rethrow';

export type DeleteAccountState = { error?: string };

export async function deleteAccount(_: DeleteAccountState, form: FormData): Promise<DeleteAccountState> {
  if (form.get('confirmo') !== 'on') return { error: 'Marca a caixinha pra confirmar.' };
  const password = form.get('password')?.toString();
  const confirmEmail = form.get('confirmEmail')?.toString();
  const parsed = deleteAccountBody.safeParse({
    ...(password !== undefined ? { password } : {}),
    ...(confirmEmail !== undefined ? { confirmEmail } : {}),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  let providerFailures: number;
  try {
    ({ providerFailures } = await api<DeleteAccountResponse>('/me/delete', { method: 'POST', body: parsed.data }));
  } catch (e) {
    rethrowIfRedirect(e);
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
  await clearSession();
  // Se o provedor falhou em desligar algum banco, a landing avisa pra revogar o acesso no Open Finance.
  redirect(providerFailures > 0 ? '/?conta=apagada&bancos=revogar' : '/?conta=apagada');
}
