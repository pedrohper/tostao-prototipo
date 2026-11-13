import type { PersonDTO, PersonEntryBody } from '@tostao/contracts';
import type { Repositories } from '../repositories/types.js';
import type { Person, Transaction } from '../domain/entities.js';
import { NEUTRAL_CATEGORY_ID } from '../domain/entities.js';
import { ResourceNotFoundError } from '../domain/errors.js';

/**
 * Caderninho de acertos. Cada lançamento ligado a uma pessoa sai do gasto e da renda
 * (vira isInternalTransfer) e entra no saldo dela:
 * saiu dinheiro (emprestei, comprei no meu cartão pra ela, paguei o que devia) = ela te deve mais / você deve menos;
 * entrou dinheiro (ela me pagou, peguei emprestado) = o contrário.
 */
const balanceOf = (txs: Transaction[]) => txs.reduce((s, t) => s - t.amountInCents, 0);

function toDto(p: Person, txs: Transaction[]): PersonDTO {
  return { id: p.id, name: p.name, balanceInCents: balanceOf(txs), count: txs.length, lastAt: txs[0]?.occurredAt.toISOString() ?? null };
}

type Repos = Pick<Repositories, 'people' | 'transactions' | 'accounts'>;

export class ListPeopleUseCase {
  constructor(private readonly repos: Repos) {}

  async execute({ userId }: { userId: string }) {
    const people = await this.repos.people.listByUser(userId);
    const dtos = await Promise.all(people.map(async (p) => toDto(p, await this.repos.transactions.findByPerson(userId, p.id))));
    // Quem tem saldo aberto primeiro (maior valor), quitados por último.
    dtos.sort((a, b) => Number(b.balanceInCents !== 0) - Number(a.balanceInCents !== 0) || Math.abs(b.balanceInCents) - Math.abs(a.balanceInCents) || a.name.localeCompare(b.name));
    return {
      people: dtos,
      owedToYouInCents: dtos.filter((d) => d.balanceInCents > 0).reduce((s, d) => s + d.balanceInCents, 0),
      youOweInCents: dtos.filter((d) => d.balanceInCents < 0).reduce((s, d) => s - d.balanceInCents, 0),
    };
  }
}

export class GetPersonUseCase {
  constructor(private readonly repos: Repos) {}

  async execute({ userId, personId }: { userId: string; personId: string }) {
    const p = await this.repos.people.findById(personId);
    if (!p || p.userId !== userId) throw new ResourceNotFoundError('Pessoa');
    const [txs, accounts] = await Promise.all([this.repos.transactions.findByPerson(userId, p.id), this.repos.accounts.listByUser(userId)]);
    const accName = new Map(accounts.map((a) => [a.id, a.name]));
    return {
      person: toDto(p, txs),
      transactions: txs.map((t) => ({ ...t, categoryName: null, accountName: t.accountId ? accName.get(t.accountId) ?? null : null })),
    };
  }
}

const cleanName = (s: string) => s.trim().replace(/\s+/g, ' ');

export class EnsurePersonUseCase {
  constructor(private readonly repos: Pick<Repositories, 'people'>) {}
  async execute({ userId, name }: { userId: string; name: string }) {
    const n = cleanName(name);
    return { person: (await this.repos.people.findByName(userId, n)) ?? (await this.repos.people.create({ userId, name: n })) };
  }
}

/** "Essa compra não é minha" / "Isso foi empréstimo": liga o lançamento a alguém (ou desfaz). */
export class LinkTransactionPersonUseCase {
  constructor(private readonly repos: Pick<Repositories, 'people' | 'transactions'>) {}

  async execute({ userId, transactionId, personName }: { userId: string; transactionId: string; personName: string | null }) {
    const t = await this.repos.transactions.findById(transactionId);
    if (!t || t.userId !== userId) throw new ResourceNotFoundError('Transação');
    if (personName === null) {
      // Volta a contar como gasto/renda (a não ser que a categoria seja "Não conta"). O próximo sync reavalia transferências.
      await this.repos.transactions.save({ ...t, personId: null, isInternalTransfer: t.categoryId === NEUTRAL_CATEGORY_ID });
      return { person: null };
    }
    const name = personName.trim().replace(/\s+/g, ' ');
    const person = (await this.repos.people.findByName(userId, name)) ?? (await this.repos.people.create({ userId, name }));
    await this.repos.transactions.save({ ...t, personId: person.id, isInternalTransfer: true });
    return { person };
  }
}

const SIGN: Record<PersonEntryBody['kind'], -1 | 1> = { emprestei: -1, paguei: -1, peguei: 1, recebi: 1 };
const LABEL: Record<PersonEntryBody['kind'], string> = { emprestei: 'Emprestei', paguei: 'Paguei', peguei: 'Peguei emprestado', recebi: 'Me pagou' };

/** Acerto anotado à mão: dinheiro vivo ou combinado que não passou pelo banco. */
export class AddPersonEntryUseCase {
  constructor(private readonly repos: Pick<Repositories, 'people' | 'transactions'>) {}

  async execute({ userId, personId, kind, amountInCents, description, occurredAt }: { userId: string; personId: string; occurredAt: Date } & Omit<PersonEntryBody, 'occurredAt'>) {
    const p = await this.repos.people.findById(personId);
    if (!p || p.userId !== userId) throw new ResourceNotFoundError('Pessoa');
    const transaction = await this.repos.transactions.create({
      userId, accountId: null, externalId: null, categoryId: null, isInternalTransfer: true, seriesId: null, personId: p.id,
      description: description?.trim() || `${LABEL[kind]} (${p.name})`,
      amountInCents: SIGN[kind] * amountInCents,
      occurredAt,
    });
    return { transaction };
  }
}

/** Apaga a pessoa: anotados à mão com ela somem; os do banco voltam a contar como gasto/renda. */
export class DeletePersonUseCase {
  constructor(private readonly repos: Pick<Repositories, 'people' | 'transactions'>) {}

  async execute({ userId, personId }: { userId: string; personId: string }) {
    const p = await this.repos.people.findById(personId);
    if (!p || p.userId !== userId) throw new ResourceNotFoundError('Pessoa');
    for (const t of await this.repos.transactions.findByPerson(userId, p.id)) {
      if (!t.externalId && !t.accountId) await this.repos.transactions.delete(t.id);
      else await this.repos.transactions.save({ ...t, personId: null, isInternalTransfer: t.categoryId === NEUTRAL_CATEGORY_ID });
    }
    await this.repos.people.delete(p.id);
  }
}
