import type { BankGateway } from './bank-gateway.js';
import { FakeBankGateway } from './fake-bank-gateway.js';
import { PluggyBankGateway } from './pluggy-bank-gateway.js';

export function makeBankGateway(env: { BANK_GATEWAY: 'fake' | 'pluggy'; PLUGGY_CLIENT_ID: string; PLUGGY_CLIENT_SECRET: string }): BankGateway {
  return env.BANK_GATEWAY === 'pluggy'
    ? new PluggyBankGateway(env.PLUGGY_CLIENT_ID, env.PLUGGY_CLIENT_SECRET)
    : new FakeBankGateway();
}
