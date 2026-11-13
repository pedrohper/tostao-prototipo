// pnpm --filter @tostao/api vapid
// Gera as chaves dos avisos no celular e grava no apps/api/.env. Não imprime a chave privada.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import webpush from 'web-push';

const file = new URL('../../.env', import.meta.url);
const current = existsSync(file) ? readFileSync(file, 'utf8') : '';
if (/^VAPID_PRIVATE_KEY=.+/m.test(current)) {
  console.log('Já tem chave VAPID no .env. Nada mudou.');
} else {
  const { publicKey, privateKey } = webpush.generateVAPIDKeys();
  appendFileSync(file, `${current.endsWith('\n') || !current ? '' : '\n'}VAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${privateKey}\n`, { mode: 0o600 });
  console.log('Chaves VAPID gravadas no .env. Reinicie a API (pm2 restart tostao-api --update-env).');
}
