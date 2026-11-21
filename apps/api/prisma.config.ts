// Configuração do Prisma CLI (substitui o bloco "prisma" do package.json, que o Prisma 7 deixa de ler).
// Importante: com este arquivo o CLI NÃO carrega mais o .env sozinho, então carregamos aqui.
// Em produção o DATABASE_URL pode vir direto do ambiente (aí não existe .env e tudo bem).
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';

const envFile = fileURLToPath(new URL('./.env', import.meta.url));
try {
  process.loadEnvFile(envFile);
} catch {
  // sem .env: segue com as variáveis do ambiente
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
});
