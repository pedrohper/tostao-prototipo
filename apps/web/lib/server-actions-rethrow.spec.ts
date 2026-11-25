// Trava de regressão: nenhum `catch` de Server Action (nem do layout do app) pode engolir NEXT_REDIRECT.
// Todo catch precisa chamar rethrowIfRedirect(...) logo na primeira linha, e `.catch(() => fallback)` de promise
// precisa passar por orFallback(...).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

const files = [
  ...walk(join(ROOT, 'app')),
  ...walk(join(ROOT, 'lib')),
  join(ROOT, 'components/menu-com-dados.tsx'),
].filter((f) => {
  const rel = relative(ROOT, f);
  if (rel.endsWith('.spec.ts')) return false;
  if (rel === 'app/(app)/layout.tsx' || rel === 'components/menu-com-dados.tsx') return true;
  return /^['"]use server['"]/m.test(readFileSync(f, 'utf8').split('\n').slice(0, 3).join('\n'));
});

describe('Server Actions e layout não engolem NEXT_REDIRECT', () => {
  it('encontrou as Server Actions (sanidade)', () => {
    expect(files.length).toBeGreaterThan(20);
    expect(files.map((f) => relative(ROOT, f))).toContain('app/(app)/layout.tsx');
  });

  for (const file of files) {
    const rel = relative(ROOT, file);
    it(rel, () => {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (/\}\s*catch\s*(\(\s*(\w+)\s*\))?\s*\{/.test(line)) {
          const next = lines[i + 1] ?? '';
          expect(next, `${rel}:${i + 1}: catch sem rethrowIfRedirect na linha seguinte`).toMatch(
            /rethrowIfRedirect\(\w+\)/,
          );
        }
        expect(line, `${rel}:${i + 1}: .catch(() => ...) engole redirect; use orFallback()`).not.toMatch(
          /\.catch\(\s*\(\)\s*=>/,
        );
      });
    });
  }
});
