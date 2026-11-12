'use server';
import { revalidatePath } from 'next/cache';
import { connectBankBody, type ConnectTokenResponse, type DisconnectResponse, type SyncResponse } from '@tostao/contracts';
import { api, ApiError } from '@/lib/api';

export type ConnectState = { error?: string; ok?: string };

export async function connectBank(_: ConnectState, form: FormData): Promise<ConnectState> {
  return connectItem(String(form.get('itemId') ?? ''));
}

/** Liga um Item ao usuário. Usado pelo campo manual e pelo onSuccess do Pluggy Connect. */
export async function connectItem(itemId: string): Promise<ConnectState> {
  const parsed = connectBankBody.safeParse({ itemId });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  try {
    const r = await api<SyncResponse>('/connections', { method: 'POST', body: parsed.data });
    revalidatePath('/', 'layout');
    return { ok: `Conectado! ${r.accounts} ${r.accounts === 1 ? 'conta' : 'contas'} e ${r.importedCount} transações novas.` };
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
}

/** Token novo a cada clique: ele vale uns 30 min, então não dá pra guardar da renderização. */
export async function getConnectToken(): Promise<{ connectToken?: string | null; error?: string }> {
  try {
    return await api<ConnectTokenResponse>('/connections/connect-token', { method: 'POST', body: {} });
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

export async function disconnectBank(_: ConnectState, form: FormData): Promise<ConnectState> {
  try {
    const r = await api<DisconnectResponse>(`/connections/${form.get('id')}`, { method: 'DELETE' });
    revalidatePath('/', 'layout');
    return { ok: r.providerDeleted ? 'Banco removido.' : 'Removido do Tostão. O Pluggy não respondeu: se quiser, revoga em meu.pluggy.ai.' };
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
}
