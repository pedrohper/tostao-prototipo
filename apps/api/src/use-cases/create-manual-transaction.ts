import { randomUUID } from 'node:crypto';
import type { Repositories } from '../repositories/types.js';
import { AppError, ResourceNotFoundError } from '../domain/errors.js';
import { categorizeByRules } from '../services/categorize.js';
import { balanceEffect, isManualAccount } from '../services/manual-balance.js';
import { canUseCategory, isNeutral } from './categories.js';

type Input = {
  userId: string;
  description: string;
  amountInCents: number; // sempre positivo; o "kind" decide o sinal
  kind: 'saida' | 'entrada';
  occurredAt: Date;
  categoryId?: string | null;
  accountId?: string | null;
  repeat?: 'nao' | 'mensal' | 'parcelado';
  times?: number;
  note?: string;
};

/** Quantos meses o "todo mês" já deixa lançado. Dá pra apagar a série inteira depois. */
export const MONTHLY_AHEAD = 12;

/** Mesmo dia nos meses seguintes; dia 31 vira o último dia do mês quando ele não existe. */
export function addMonths(d: Date, k: number): Date {
  const y = d.getUTCFullYear(),
    m = d.getUTCMonth() + k;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last), d.getUTCHours(), d.getUTCMinutes()));
}

/** "Anotar gasto": pra dinheiro vivo ou pra quem não conectou banco. */
export class CreateManualTransactionUseCase {
  constructor(
    private readonly repos: Pick<Repositories, 'transactions' | 'categories' | 'rules' | 'accounts' | 'tx'>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: Input) {
    const { categories, rules } = this.repos;
    let categoryId = input.categoryId ?? null;
    if (categoryId && !canUseCategory(await categories.findById(categoryId), input.userId))
      throw new ResourceNotFoundError('Categoria');
    const accountId = input.accountId ?? null;
    const account = accountId
      ? (await this.repos.accounts.listByUser(input.userId)).find((a) => a.id === accountId)
      : null;
    if (accountId && !account) throw new ResourceNotFoundError('Conta');
    if (!categoryId) categoryId = categorizeByRules(input.description, await rules.listForUser(input.userId));

    const sign = input.kind === 'saida' ? -1 : 1;
    const total = Math.abs(input.amountInCents);
    const repeat = input.repeat ?? 'nao';
    const n = repeat === 'mensal' ? MONTHLY_AHEAD : repeat === 'parcelado' ? Math.max(2, input.times ?? 2) : 1;
    // Parcelar R$ 0,05 em 12x daria parcelas de 0 centavos (lançamento que não existe). Recusa antes de gravar qualquer uma.
    if (repeat === 'parcelado' && total < n)
      throw new AppError(
        `R$ ${(total / 100).toFixed(2).replace('.', ',')} não dá pra dividir em ${n} parcelas (cada uma teria menos de 1 centavo).`,
        400,
      );
    const seriesId = n > 1 ? randomUUID() : null;
    // Parcelado: o total dividido; os centavos que sobram vão na primeira parcela.
    const parcel = repeat === 'parcelado' ? Math.floor(total / n) : total;
    const first = repeat === 'parcelado' ? total - parcel * (n - 1) : total;

    // Todas as parcelas/meses entram juntas (createMany numa transação): nunca fica meia série lançada.
    const rows = Array.from({ length: n }, (_, i) => ({
      id: randomUUID(),
      userId: input.userId,
      accountId,
      externalId: null,
      description: repeat === 'parcelado' ? `${input.description} (${i + 1}/${n})` : input.description,
      amountInCents: sign * (i === 0 ? first : parcel),
      occurredAt: addMonths(input.occurredAt, i),
      categoryId,
      isInternalTransfer: isNeutral(categoryId),
      seriesId,
      note: input.note || null,
    }));
    const now = this.now();
    const transaction = await this.repos.tx(async (r) => {
      await r.transactions.createMany(rows);
      // Conta manual: o saldo acompanha o que já aconteceu (junto, na mesma transação).
      if (account && isManualAccount(account)) {
        const delta = rows.reduce((sum, row) => sum + balanceEffect(row, now), 0);
        if (delta !== 0) await r.accounts.adjustBalance(account.id, delta);
      }
      return (await r.transactions.findById(rows[0]!.id))!;
    });
    return { transaction, count: n };
  }
}
