'use server';
import { revalidatePath } from 'next/cache';
import { importStatementBody, type ImportResponse } from '@tostao/contracts';
import { api, ApiError } from '@/lib/api';

export type ImportState = { error?: string; result?: ImportResponse; failed?: string[] };

/** Banco brasileiro adora mandar OFX em Windows-1252. Tenta UTF-8 primeiro. */
function decode(buf: ArrayBuffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('windows-1252').decode(buf);
  }
}

export async function importStatement(_: ImportState, form: FormData): Promise<ImportState> {
  const files = form.getAll('file').filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { error: 'Escolhe o arquivo do extrato.' };
  const tipo = String(form.get('tipo') ?? 'auto');
  let total: ImportResponse | undefined;
  const failed: string[] = [];
  for (const file of files.slice(0, 12)) {
    if (file.size > 4_000_000) { failed.push(`${file.name} (maior que 4 MB, baixa um período menor)`); continue; }
    const parsed = importStatementBody.safeParse({
      accountName: form.get('accountName') ?? '',
      fileName: file.name,
      content: decode(await file.arrayBuffer()),
      isCard: tipo === 'auto' ? undefined : tipo === 'cartao',
    });
    if (!parsed.success) { failed.push(`${file.name} (${parsed.error.issues[0]?.message})`); continue; }
    try {
      const r = await api<ImportResponse>('/imports', { method: 'POST', body: parsed.data });
      total = !total ? r : {
        ...r,
        importedCount: total.importedCount + r.importedCount,
        skipped: total.skipped + r.skipped,
        accountName: total.accountName === r.accountName ? r.accountName : `${total.accountName} e ${r.accountName}`,
        from: total.from < r.from ? total.from : r.from,
        to: total.to > r.to ? total.to : r.to,
      };
    } catch (e) {
      failed.push(`${file.name} (${e instanceof ApiError ? e.message : 'algo deu errado'})`);
    }
  }
  if (total) revalidatePath('/', 'layout');
  if (!total) return { error: failed.length === 1 ? `Não consegui ler ${failed[0]}` : 'Não consegui ler nenhum arquivo.', failed: failed.length > 1 ? failed : undefined };
  return { result: total, failed };
}
