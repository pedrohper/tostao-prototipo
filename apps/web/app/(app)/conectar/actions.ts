'use server';
import { revalidatePath } from 'next/cache';
import { connectBankBody, type SyncResponse } from '@tostao/contracts';
import { api, ApiError } from '@/lib/api';

export type ConnectState = { error?: string; ok?: string };

export async function connectBank(_: ConnectState, form: FormData): Promise<ConnectState> {
  const parsed = connectBankBody.safeParse({ itemId: form.get('itemId') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  try {
    const r = await api<SyncResponse>('/connections', { method: 'POST', body: parsed.data });
    revalidatePath('/', 'layout');
    return { ok: `Conectado! ${r.accounts} ${r.accounts === 1 ? 'conta' : 'contas'} e ${r.importedCount} transações novas.` };
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
}

export async function syncNow(_: ConnectState, form: FormData): Promise<ConnectState> {
  try {
    const r = await api<SyncResponse>(`/connections/${form.get('id')}/sync`, { method: 'POST', body: {} });
    revalidatePath('/', 'layout');
    return { ok: r.importedCount ? `${r.importedCount} transações novas.` : 'Já tava tudo em dia.' };
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
}
