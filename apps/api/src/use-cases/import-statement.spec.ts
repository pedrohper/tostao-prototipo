import { describe, expect, it } from 'vitest';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { FakeBankGateway } from '../gateways/fake-bank-gateway.js';
import { ImportStatementUseCase } from './import-statement.js';
import { SyncBankConnectionUseCase } from './sync-bank-connection.js';
import { DisconnectBankUseCase } from './disconnect-bank.js';

const CONTA = 'Data,Valor,Identificador,Descrição\n03/11/2026,-500.00,a1,Pagamento de fatura\n04/11/2026,-30.00,a2,IFOOD *ACAI\n05/11/2026,2000.00,a3,SALARIO EMPRESA';
const FATURA = 'date,title,amount\n2026-11-03,Pagamento recebido,-500.00\n2026-11-02,Netflix,39.90';

describe('importar extrato', () => {
  it('cria a conta, categoriza, não duplica e reconhece pagamento de fatura', async () => {
    const repos = makeInMemoryRepositories();
    const imp = new ImportStatementUseCase(repos);
    const r = await imp.execute({ userId: 'u1', accountName: 'Itaú', fileName: 'itau.csv', content: CONTA });
    expect(r).toMatchObject({ importedCount: 3, skipped: 0, kind: 'BANK', accountName: 'Itaú' });
    expect(repos.accounts.items).toHaveLength(1);
    expect(repos.transactions.items.find((t) => t.description === 'SALARIO EMPRESA')!.categoryId).toBe('salario');

    const again = await imp.execute({ userId: 'u1', accountName: 'Itaú', fileName: 'itau.csv', content: CONTA });
    expect(again).toMatchObject({ importedCount: 0, skipped: 3 });
    expect(repos.transactions.items).toHaveLength(3);

    await imp.execute({ userId: 'u1', accountName: 'Cartão Itaú', fileName: 'fatura.csv', content: FATURA });
    expect(repos.accounts.items.map((a) => a.type).sort()).toEqual(['BANK', 'CREDIT']);
    const internal = repos.transactions.items.filter((t) => t.isInternalTransfer).map((t) => t.description).sort();
    expect(internal).toEqual(['Pagamento de fatura', 'Pagamento recebido']);
  });

  it('o sync diário ignora a conta importada e desconectar não chama o provedor', async () => {
    const repos = makeInMemoryRepositories();
    await new ImportStatementUseCase(repos).execute({ userId: 'u1', accountName: 'Itaú', fileName: 'itau.csv', content: CONTA });
    const bank = Object.assign(new FakeBankGateway(), {
      fetchAccounts: async () => { throw new Error('não devia chamar'); },
      deleteItem: async () => { throw new Error('não devia chamar'); },
    });
    const connection = repos.connections.items[0]!;
    await expect(new SyncBankConnectionUseCase({ ...repos, bank }).execute({ connectionId: connection.id })).resolves.toMatchObject({ importedCount: 0 });
    expect(await new DisconnectBankUseCase(repos.connections, bank).execute({ userId: 'u1', connectionId: connection.id })).toEqual({ providerDeleted: true });
    expect(repos.transactions.items).toHaveLength(0);
  });
});
