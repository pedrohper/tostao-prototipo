import type { BankGateway } from './bank-gateway.js';
import { FakeBankGateway } from './fake-bank-gateway.js';
import { PluggyBankGateway } from './pluggy-bank-gateway.js';

export function makeBankGateway(env: {
  BANK_GATEWAY: 'fake' | 'pluggy';
  PLUGGY_CLIENT_ID: string;
  PLUGGY_CLIENT_SECRET: string;
  PLUGGY_INCLUDE_SANDBOX?: 'true' | 'false';
}): BankGateway {
  return env.BANK_GATEWAY === 'pluggy'
    ? new PluggyBankGateway(env.PLUGGY_CLIENT_ID, env.PLUGGY_CLIENT_SECRET, {
        // Sem a variável: sandbox só fora de produção.
        includeSandbox: env.PLUGGY_INCLUDE_SANDBOX ? env.PLUGGY_INCLUDE_SANDBOX === 'true' : undefined,
      })
    : new FakeBankGateway();
}
