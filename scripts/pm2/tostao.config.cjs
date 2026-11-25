// Referência versionada das duas apps do Tostão no pm2 (T6.1). O arquivo que o pm2 usa de verdade é
// ~/homelab/ecosystem.config.cjs (junto de anki-studio e homelab-hub); mantenha os blocos iguais aos daqui.
//
// Por que processo único: com `bash -c "pnpm start:api"` eram 5 camadas (bash > pnpm > sh > tsx > node). O pm2 só
// matava a de cima e o node de baixo seguia segurando a porta (26 reinícios com EADDRINUSE em 2026-11-22).
// Aqui o pm2 é o pai direto do node: o SIGTERM chega no processo que tem o handler de desligamento limpo.
//
// Trocar no servidor (o Pedro roda; precisa do dump salvo pro boot):
//   pm2 delete tostao-api tostao-web
//   pm2 start ~/homelab/ecosystem.config.cjs --only tostao-api,tostao-web
//   pm2 save
const ROOT = '/home/optiplex/homelab/tostao-prototipo';

module.exports = {
  apps: [
    {
      name: 'tostao-api',
      cwd: `${ROOT}/apps/api`,
      // Caminho absoluto + interpreter "none": o pm2 executa o node direto, sem interpretar "node" como um arquivo.
      // `--env-file=.env` lê apps/api/.env (cwd); `--import tsx` registra o loader do tsx sem o wrapper do CLI do tsx.
      script: '/usr/bin/node',
      args: '--env-file=.env --import tsx src/server.ts',
      interpreter: 'none',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      // O desligamento limpo da API tem teto de 10 s (src/lib/shutdown.ts); o pm2 só manda SIGKILL depois de 15 s.
      kill_timeout: 15000,
      // Sem isto, uma falha de boot (banco fora do ar por mais de 60 s) reinicia sem pausa.
      restart_delay: 3000,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'tostao-web',
      cwd: `${ROOT}/apps/web`,
      script: 'node_modules/next/dist/bin/next',
      // Mesma porta de hoje: o Next usa PORT (padrão 3000) e o `start` do package.json já fixava `-H 127.0.0.1`.
      // As variáveis vêm de apps/web/.env.local, que o Next lê do cwd (igual ao `pnpm --filter @tostao/web start`).
      args: 'start -H 127.0.0.1',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      kill_timeout: 15000,
      restart_delay: 3000,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
