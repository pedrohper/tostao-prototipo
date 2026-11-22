import type { ImportPdfBody, ImportPreviewResponse, ImportPreviewRow, ImportRowsBody } from '@tostao/contracts';
import { PDF_MAX_BYTES } from '@tostao/contracts';
import { AppError } from '../domain/errors.js';
import type { AiGateway } from '../gateways/ai-gateway.js';
import { civilDay, noonOfCivilDay } from '../lib/tz.js';
import type { KeyValueStore } from '../lib/redis.js';
import { timezoneOf } from '../lib/user-tz.js';
import type { Repositories } from '../repositories/types.js';
import { extractWithAi } from '../services/pdf-ai-fallback.js';
import { extractPdfText, parsePdfText, PdfParseError } from '../services/pdf-statement-parser.js';
import type { ParsedStatement } from '../services/statement-parser.js';
import type { ImportStatementUseCase } from './import-statement.js';

/** Quantas leituras por IA por pessoa por dia (o PDF é caro em tokens e o limite protege a conta do provedor). */
export const PDF_AI_DAILY_LIMIT = 5;

const suggestedName = (bank: string | null, kind: 'BANK' | 'CREDIT') =>
  `${bank ?? 'PDF'}${kind === 'CREDIT' ? ' cartão' : ''}`.slice(0, 40);

/**
 * Importar PDF de fatura/extrato em DUAS etapas, pra a pessoa conferir antes de gravar:
 *   `preview`: valida o arquivo, lê (layout conhecido, ou IA se permitido) e devolve as linhas pra editar. Não grava nada.
 *   `confirm`: grava as linhas (já editadas) pelo mesmo `ImportStatementUseCase` do OFX/CSV: mesma dedup por externalId
 *              determinístico, mesma conciliação de anotações manuais e de transferência interna.
 */
export class ImportPdfUseCase {
  constructor(
    private readonly repos: Pick<Repositories, 'users'>,
    private readonly importer: ImportStatementUseCase,
    private readonly ai: AiGateway,
    private readonly kv: KeyValueStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async preview(userId: string, body: ImportPdfBody): Promise<ImportPreviewResponse> {
    // 1) Arquivo: base64 → bytes, tamanho e magic bytes `%PDF-` (a extensão do nome não conta).
    const bytes = Buffer.from(body.contentBase64, 'base64');
    if (bytes.length > PDF_MAX_BYTES) throw new AppError('PDF grande demais (máx. 10 MB).', 413);
    let text: string;
    try {
      text = await extractPdfText(bytes);
    } catch (e) {
      if (e instanceof PdfParseError) throw new AppError(e.message, e.code === 'too_big' ? 413 : 400);
      throw e;
    }

    // 2) Layout conhecido.
    const now = this.now();
    const parsed = parsePdfText(text, { now });
    let rows: ImportPreviewRow[] = parsed.rows;
    let bank = parsed.bank;
    let kind = parsed.kind;
    let source: ImportPreviewResponse['source'] = 'layout';
    const warnings = [...parsed.warnings];
    let aiBlockedReason: ImportPreviewResponse['aiBlockedReason'] = null;

    // 3) Nada serviu: IA, SÓ com aceite ativo, e com o texto mascarado (pdf-ai-fallback). Sem aceite, nada sai daqui.
    if (rows.length === 0) {
      const user = await this.repos.users.findById(userId);
      if (!body.allowAi) aiBlockedReason = 'disabled';
      else if (!user?.aiConsentAt) aiBlockedReason = 'no_consent';
      else if (!this.ai.enabled) aiBlockedReason = 'disabled';
      else {
        const day = civilDay(now, user.timezone);
        const used = await this.kv.incr(`pdf-ai:${userId}:${day}`, 86_400);
        if (used > PDF_AI_DAILY_LIMIT) aiBlockedReason = 'quota';
        else {
          const ai = await extractWithAi(this.ai, text, { bank, kind, year: Number(day.slice(0, 4)) });
          if (ai) {
            rows = ai.rows;
            bank = ai.bank;
            kind = ai.kind;
            source = 'ai';
            warnings.push('Lido com ajuda da IA (o texto foi mascarado antes). Confere cada linha.');
          } else await this.kv.decr(`pdf-ai:${userId}:${day}`); // não deu em nada: devolve a cota
        }
      }
    }

    const totalInCents = rows.reduce(
      (sum, r) => sum + (kind === 'CREDIT' ? (r.amountInCents < 0 ? -r.amountInCents : 0) : r.amountInCents),
      0,
    );
    return {
      bank,
      kind,
      suggestedAccountName: body.accountName || suggestedName(bank, kind),
      source,
      totalInCents,
      statedTotalInCents: parsed.statedTotalInCents,
      rows,
      warnings,
      aiBlockedReason,
    };
  }

  /** Grava a pré-visualização já conferida. */
  async confirm(userId: string, body: ImportRowsBody) {
    const tz = await timezoneOf(this.repos.users, userId);
    const parsed: ParsedStatement = {
      format: 'pdf',
      kind: body.isCard ? 'CREDIT' : 'BANK',
      balanceInCents: null,
      transactions: body.rows.map((r) => ({
        // A chave vem do PDF original (não do texto editado): editar a descrição não faz o mesmo PDF duplicar depois.
        externalId: `pdf:${r.key}`,
        occurredAt: noonOfCivilDay(r.date, tz),
        amountInCents: r.amountInCents,
        description: r.description,
      })),
    };
    return this.importer.executeParsed({ userId, accountName: body.accountName, parsed });
  }
}
