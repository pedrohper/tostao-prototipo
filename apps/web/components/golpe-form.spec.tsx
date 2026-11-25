// T6.20 · tela "Isso é golpe?" (renderToString + guardas de fonte, sem navegador).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async (original) => ({
  ...(await original<typeof import('next/navigation')>()),
  useRouter: () => ({ refresh: () => {} }),
}));

import { GolpeForm, ResultadoGolpe } from './golpe-form';

const read = (file: string) => readFileSync(join(__dirname, '..', file), 'utf8');
const advice = 'Na dúvida, fala com o banco pelo app oficial.';

describe('ResultadoGolpe', () => {
  it('mostra o risco sem afirmar certeza e termina com o conselho fixo', () => {
    const html = renderToString(
      <ResultadoGolpe
        result={{ source: 'ia', risk: 'alto', signs: ['Tem pressa.'], actions: ['Não responde.'], advice }}
      />,
    );
    expect(html).toContain('Risco alto');
    expect(html).toContain('não uma certeza');
    expect(html.indexOf(advice)).toBeGreaterThan(html.indexOf('Não responde.'));
  });

  it('texto vindo de fora nunca vira link nem markup', () => {
    const html = renderToString(
      <ResultadoGolpe
        result={{
          source: 'ia',
          risk: 'baixo',
          signs: ['<a href="http://x">clique</a>'],
          actions: ['http://golpe.top'],
          advice,
        }}
      />,
    );
    expect(html).not.toContain('<a ');
    expect(html).toContain('&lt;a href');
  });

  it('lista fixa com o motivo', () => {
    const html = renderToString(
      <ResultadoGolpe
        result={{ source: 'checklist', risk: null, reason: 'limite', signs: ['s'], actions: ['a'], advice }}
      />,
    );
    expect(html).toContain('análises com IA de hoje acabaram');
    expect(html).toContain('Sinais de golpe');
  });
});

describe('GolpeForm', () => {
  it('sem o aceite: mostra o aviso de IA, trava o Analisar e já deixa a lista à mão', () => {
    const html = renderToString(<GolpeForm consented={false} />);
    expect(html).toContain('Li e aceito usar a IA');
    expect(html).toContain('Sem IA, dá pra conferir assim');
    expect(html).toContain(advice);
    expect(html).toMatch(/<button type="submit" disabled=""/);
  });

  it('com o aceite: campo com teto de 2.000, aviso de privacidade e sem lista antes de analisar', () => {
    const html = renderToString(<GolpeForm consented />);
    expect(html).not.toContain('Li e aceito usar a IA');
    expect(html).toContain('maxLength="2000"');
    expect(html).toContain('Nada fica salvo');
    expect(html).not.toContain('Sinais de golpe');
    // sem `name`: um envio antes do JavaScript não leva a mensagem pra URL
    expect(html).not.toMatch(/<textarea[^>]*\sname=/);
  });
});

describe('atalhos no /tostao', () => {
  it('o chat e a tela sem aceite levam pro "Isso é golpe?"', () => {
    expect(read('app/(app)/chat/chat-client.tsx')).toContain('href="/tostao/golpe"');
    expect(read('app/(app)/tostao/page.tsx')).toContain('href="/tostao/golpe"');
  });
});
