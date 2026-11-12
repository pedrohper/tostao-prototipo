'use server';
import { revalidatePath } from 'next/cache';
import { importStatementBody, type ImportResponse } from '@tostao/contracts';
import { api, ApiError } from '@/lib/api';

export type ImportState = { error?: string; result?: ImportResponse };

/** Banco brasileiro adora mandar OFX em Windows-1252. Tenta UTF-8 primeiro. */
function decode(buf: ArrayBuffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('windows-1252').decode(buf);
  }
}

export async function importStatement(_: ImportState, form: FormData): Promise<ImportState> {
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Escolhe o arquivo do extrato.' };
  if (file.size > 4_000_000) return { error: 'Arquivo grande demais (máx. 4 MB). Baixa um período menor.' };
  const tipo = String(form.get('tipo') ?? 'auto');
  const parsed = importStatementBody.safeParse({
    accountName: form.get('accountName') ?? '',
    fileName: file.name,
    content: decode(await file.arrayBuffer()),
    isCard: tipo === 'auto' ? undefined : tipo === 'cartao',
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  try {
    const result = await api<ImportResponse>('/imports', { method: 'POST', body: parsed.data });
    revalidatePath('/', 'layout');
    return { result };
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
}
