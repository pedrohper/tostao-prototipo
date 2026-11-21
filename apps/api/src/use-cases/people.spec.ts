import { describe, expect, it } from 'vitest';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { GetMonthSummaryUseCase } from './get-month-summary.js';
import {
  AddPersonEntryUseCase,
  DeletePersonUseCase,
  LinkTransactionPersonUseCase,
  ListPeopleUseCase,
  RenamePersonUseCase,
} from './people.js';
import { detectInternalTransfers } from '../services/internal-transfers.js';

describe('acertos', () => {
  it('compra no cartão emprestado sai do gasto e vira "Mãe te deve"; o pagamento dela abate', async () => {
    const repos = makeInMemoryRepositories();
    const u = await repos.users.create({ name: 'Ana', email: 'a@x.com', passwordHash: 'x' });
    const conn = await repos.connections.create({ userId: u.id, itemId: 'i', institution: 'Nubank' });
    const card = await repos.accounts.upsertByExternalId({
      userId: u.id,
      connectionId: conn.id,
      externalId: 'c',
      name: 'Nubank',
      type: 'CREDIT',
      balanceInCents: -30000,
      fingerprint: null,
      creditLimitInCents: 100000,
      dueDate: null,
    });
    const tx = (date: string, cents: number, description: string) =>
      repos.transactions.create({
        userId: u.id,
        accountId: card.id,
        externalId: `${date}${cents}`,
        description,
        amountInCents: cents,
        occurredAt: new Date(`${date}T15:00:00Z`),
        categoryId: 'compras',
        isInternalTransfer: false,
      });
    const minha = await tx('2026-11-05', -5000, 'LOJA A');
    const dela = await tx('2026-11-06', -23000, 'FARMACIA');
    const link = new LinkTransactionPersonUseCase(repos);
    const { person } = await link.execute({ userId: u.id, transactionId: dela.id, personName: 'Mãe' });
    // Mesmo nome com outra caixa não cria pessoa nova
    const again = await link.execute({ userId: u.id, transactionId: dela.id, personName: 'mãe' });
    expect(again.person!.id).toBe(person!.id);

    const summary = await new GetMonthSummaryUseCase(repos).execute({ userId: u.id, month: '2026-11' });
    expect(summary.outcomeInCents).toBe(5000);
    expect(
      detectInternalTransfers(
        await repos.transactions.findManyInRange(u.id, new Date('2026-11-01'), new Date('2026-12-01')),
      ).has(dela.id),
    ).toBe(true);

    await new AddPersonEntryUseCase(repos).execute({
      userId: u.id,
      personId: person!.id,
      kind: 'recebi',
      amountInCents: 10000,
      occurredAt: new Date('2026-11-10T15:00:00Z'),
    });
    let list = await new ListPeopleUseCase(repos).execute({ userId: u.id });
    expect(list.people[0]).toMatchObject({ name: 'Mãe', balanceInCents: 13000, count: 2 });
    expect(list.owedToYouInCents).toBe(13000);

    // Peguei emprestado com outra pessoa: você deve
    const { person: joao } = await link.execute({ userId: u.id, transactionId: minha.id, personName: 'João' });
    await new AddPersonEntryUseCase(repos).execute({
      userId: u.id,
      personId: joao!.id,
      kind: 'peguei',
      amountInCents: 20000,
      occurredAt: new Date('2026-11-11T15:00:00Z'),
    });
    list = await new ListPeopleUseCase(repos).execute({ userId: u.id });
    expect(list.youOweInCents).toBe(15000);

    // Apagar a pessoa: o do banco volta a ser gasto, o anotado some
    await new DeletePersonUseCase(repos).execute({ userId: u.id, personId: person!.id });
    expect((await repos.transactions.findById(dela.id))!.isInternalTransfer).toBe(false);
    expect((await new GetMonthSummaryUseCase(repos).execute({ userId: u.id, month: '2026-11' })).outcomeInCents).toBe(
      23000,
    );
    await expect(link.execute({ userId: 'outro', transactionId: dela.id, personName: 'X' })).rejects.toThrow();
  });

  it('renomeia pessoa/grupo: limpa espaços, não deixa duplicar nome e não mexe no de outro usuário', async () => {
    const repos = makeInMemoryRepositories();
    const u = await repos.users.create({ name: 'Ana', email: 'r@x.com', passwordHash: 'x' });
    const outro = await repos.users.create({ name: 'Bia', email: 'b@x.com', passwordHash: 'x' });
    const familia = await repos.people.create({ userId: u.id, name: 'Divido com minha família' });
    await repos.people.create({ userId: u.id, name: 'Mãe' });
    const rename = new RenamePersonUseCase(repos);

    const { person } = await rename.execute({ userId: u.id, personId: familia.id, name: '  Casa   (família) ' });
    expect(person.name).toBe('Casa (família)');
    expect((await repos.people.findById(familia.id))!.name).toBe('Casa (família)');
    // Mesmo nome dela mesma (só caixa diferente) pode
    await expect(rename.execute({ userId: u.id, personId: familia.id, name: 'casa (família)' })).resolves.toBeTruthy();

    await expect(rename.execute({ userId: u.id, personId: familia.id, name: 'mãe' })).rejects.toThrow('Já tem');
    await expect(rename.execute({ userId: outro.id, personId: familia.id, name: 'Qualquer' })).rejects.toThrow();
  });
});
