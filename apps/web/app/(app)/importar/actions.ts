'use server';
import { revalidateFinance } from '@/lib/revalidate';
import {
  PDF_MAX_BYTES,
  importStatementBody,
  type ImportPreviewResponse,
  type ImportResponse,
  type ImportRowsBody,
} from '@tostao/contracts';
import { getToken } from '@/lib/session';
import { accessTokenSub } from '@/lib/token-expiry';
import { peekShare, takeShare } from '@/lib/share-stash';
import { api, ApiError } from '@/lib/api';
import { rethrowIfRedirect } from '@/lib/rethrow';

export type ImportState = { error?: string; result?: ImportResponse; failed?: string[] };

/** Banco brasileiro adora mandar OFX em Windows-1252. Tenta UTF-8 primeiro. */
function decode(buf: ArrayBuffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch (caught) {
    rethrowIfRedirect(caught);
    return new TextDecoder('windows-1252').decode(buf);
  }
}

export async function importStatement(_: ImportState, form: FormData): Promise<ImportState> {
  const files = form.getAll('file').filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { error: 'Escolhe o arquivo do extrato.' };
  // Teto do envio inteiro = bodySizeLimit do next.config.ts (10 MB). Acima disso o Next nem chega aqui (413).
  if (files.reduce((sum, f) => sum + f.size, 0) > 10_000_000)
    return { error: 'Os arquivos somam mais de 10 MB. Envia menos arquivos por vez.' };
  const tipo = String(form.get('tipo') ?? 'auto');
  let total: ImportResponse | undefined;
  const failed: string[] = [];
  for (const file of files.slice(0, 12)) {
    if (file.size > 4_000_000) {
      failed.push(`${file.name} (maior que 4 MB, baixa um período menor)`);
      continue;
    }
    const parsed = importStatementBody.safeParse({
      accountName: form.get('accountName') ?? '',
      fileName: file.name,
      content: decode(await file.arrayBuffer()),
      isCard: tipo === 'auto' ? undefined : tipo === 'cartao',
    });
    if (!parsed.success) {
      failed.push(`${file.name} (${parsed.error.issues[0]?.message})`);
      continue;
    }
    try {
      const r = await api<ImportResponse>('/imports', { method: 'POST', body: parsed.data });
      total = !total
        ? r
        : {
            ...r,
            importedCount: total.importedCount + r.importedCount,
            skipped: total.skipped + r.skipped,
            accountName:
              total.accountName === r.accountName ? r.accountName : `${total.accountName} e ${r.accountName}`,
            from: total.from < r.from ? total.from : r.from,
            to: total.to > r.to ? total.to : r.to,
          };
    } catch (e) {
      rethrowIfRedirect(e);
      failed.push(`${file.name} (${e instanceof ApiError ? e.message : 'algo deu errado'})`);
    }
  }
  if (total) revalidateFinance();
  if (!total)
    return {
      error: failed.length === 1 ? `Não consegui ler ${failed[0]}` : 'Não consegui ler nenhum arquivo.',
      failed: failed.length > 1 ? failed : undefined,
    };
  return { result: total, failed };
}

// ---------- PDF de fatura/extrato (T5.3) ----------
export type PdfPreviewState = { error?: string; preview?: ImportPreviewResponse; fileName?: string };

/** Quem é a pessoa, pra amarrar o arquivo compartilhado a ela (o `sub` do token; quem valida de verdade é a API). */
async function userKey() {
  const token = await getToken();
  return token ? accessTokenSub(token) : null;
}

async function previewBytes(bytes: Uint8Array, fileName: string, accountName: string): Promise<PdfPreviewState> {
  if (bytes.byteLength > PDF_MAX_BYTES) return { error: 'O PDF passa de 10 MB.' };
  try {
    const preview = await api<ImportPreviewResponse>('/imports/preview', {
      method: 'POST',
      body: { fileName, contentBase64: Buffer.from(bytes).toString('base64'), accountName, allowAi: true },
    });
    return { preview, fileName };
  } catch (e) {
    rethrowIfRedirect(e);
    return { error: e instanceof ApiError ? e.message : 'Não consegui ler esse PDF.' };
  }
}

/** Passo 1: lê o PDF escolhido e devolve as linhas pra conferir. NÃO grava nada. */
export async function previewPdf(_: PdfPreviewState, form: FormData): Promise<PdfPreviewState> {
  const file = form.get('pdf');
  if (!(file instanceof File) || file.size === 0) return { error: 'Escolhe o PDF da fatura ou do extrato.' };
  return previewBytes(
    new Uint8Array(await file.arrayBuffer()),
    file.name,
    String(form.get('accountName') ?? '').slice(0, 40),
  );
}

/** Idem, pro PDF que veio do "Compartilhar" do Android (guardado por 10 min, amarrado à pessoa). */
export async function previewSharedPdf(shareId: string): Promise<PdfPreviewState> {
  const key = await userKey();
  const shared = key ? peekShare(key, shareId) : null;
  if (!shared) return { error: 'O arquivo compartilhado venceu. Compartilha de novo ou escolhe o PDF aqui.' };
  return previewBytes(shared.bytes, shared.name, '');
}

export type PdfConfirmState = { error?: string; result?: ImportResponse };

/** Passo 2: grava as linhas já conferidas/editadas. */
export async function confirmPdfImport(body: ImportRowsBody, shareId?: string): Promise<PdfConfirmState> {
  try {
    const result = await api<ImportResponse>('/imports/rows', { method: 'POST', body });
    revalidateFinance();
    if (shareId) {
      const key = await userKey();
      if (key) takeShare(key, shareId);
    }
    return { result };
  } catch (e) {
    rethrowIfRedirect(e);
    return { error: e instanceof ApiError ? e.message : 'Não consegui importar agora.' };
  }
}

/** Descarta o arquivo compartilhado (a pessoa desistiu). */
export async function discardShared(shareId: string) {
  const key = await userKey();
  if (key) takeShare(key, shareId);
}

/** OFX/CSV que veio do "Compartilhar": importa direto (o fluxo de sempre) e apaga a cópia temporária. */
export async function importSharedStatement(_: ImportState, form: FormData): Promise<ImportState> {
  const shareId = String(form.get('shareId') ?? '');
  const key = await userKey();
  const shared = key ? peekShare(key, shareId) : null;
  if (!shared) return { error: 'O arquivo compartilhado venceu. Compartilha de novo.' };
  const parsed = importStatementBody.safeParse({
    accountName: form.get('accountName') ?? '',
    fileName: shared.name,
    content: decode(
      shared.bytes.buffer.slice(
        shared.bytes.byteOffset,
        shared.bytes.byteOffset + shared.bytes.byteLength,
      ) as ArrayBuffer,
    ),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Não consegui ler o arquivo.' };
  try {
    const result = await api<ImportResponse>('/imports', { method: 'POST', body: parsed.data });
    if (key) takeShare(key, shareId);
    revalidateFinance();
    return { result };
  } catch (e) {
    rethrowIfRedirect(e);
    return { error: e instanceof ApiError ? e.message : 'Não consegui importar agora.' };
  }
}
