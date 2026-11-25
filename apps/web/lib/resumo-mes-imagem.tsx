// Desenha a imagem 1080×1920 do resumo do mês (T6.19) com o `ImageResponse` do Next. Só roda no servidor.
// Fontes e artes vêm do disco: nada é buscado fora. O gerador não desenha WebP, por isso o mascote usa uma cópia PNG.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { shareTexts, type MonthShare } from './resumo-mes';

export const SHARE_WIDTH = 1080;
export const SHARE_HEIGHT = 1920;

// Cores da marca (a imagem é igual no tema claro e no escuro).
const PAPER = '#FDFBF6';
const INK = '#1E1B18';
const ORANGE = '#FF5A36';
const YELLOW = '#FFC233';
const MINT = '#3DD6A0';
const GOOD = '#0F7A55';
const BAD = '#B3261E';

const dataUrl = (buffer: Buffer) => `data:image/png;base64,${buffer.toString('base64')}`;
const file = (...parts: string[]) => readFile(join(process.cwd(), ...parts));
const font = (family: string, name: string) => file('node_modules', '@fontsource', family, 'files', name);

async function loadAssets(good: boolean) {
  const [display, regular, bold, wordmark, mascot] = await Promise.all([
    font('bricolage-grotesque', 'bricolage-grotesque-latin-800-normal.woff'),
    font('inter', 'inter-latin-400-normal.woff'),
    font('inter', 'inter-latin-700-normal.woff'),
    file('public', 'wordmark.png'),
    file('assets', 'compartilhar', good ? 'comemorando.png' : 'pensando.png'),
  ]);
  return {
    fonts: [
      { name: 'Bricolage', data: display, weight: 800 as const, style: 'normal' as const },
      { name: 'Inter', data: regular, weight: 400 as const, style: 'normal' as const },
      { name: 'Inter', data: bold, weight: 700 as const, style: 'normal' as const },
    ],
    wordmark: dataUrl(wordmark),
    mascot: dataUrl(mascot),
  };
}

const card = { display: 'flex', flexDirection: 'column', borderRadius: 56, padding: '48px 56px' } as const;
const label = { fontSize: 32, fontWeight: 700, letterSpacing: 4 } as const;
const display = { fontFamily: 'Bricolage', fontWeight: 800, lineHeight: 1.05 } as const;

export async function renderShareImage(data: MonthShare, showValues: boolean): Promise<ArrayBuffer> {
  const texts = shareTexts(data, showValues);
  const assets = await loadAssets(texts.headline.good);
  const image = new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        padding: '88px 72px 72px',
        background: ORANGE,
        color: INK,
        fontFamily: 'Inter',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <img src={assets.wordmark} width={300} height={84} alt="" />
        <div style={{ ...display, display: 'flex', marginTop: 56, fontSize: 112 }}>{texts.title}</div>
        <div style={{ display: 'flex', marginTop: 8, fontSize: 40, fontWeight: 700 }}>{texts.subtitle}</div>
      </div>

      <div style={{ ...card, background: PAPER, alignItems: 'center' }}>
        <div style={{ ...label, display: 'flex' }}>{texts.headline.label}</div>
        <div
          style={{
            ...display,
            display: 'flex',
            marginTop: 12,
            fontSize: 240,
            color: texts.headline.good ? GOOD : BAD,
          }}
        >
          {texts.headline.value}
        </div>
        <div style={{ display: 'flex', fontSize: 40, textAlign: 'center' }}>{texts.headline.note}</div>
        {texts.amounts.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginTop: 32,
              paddingTop: 28,
              width: '100%',
              borderTop: `3px solid ${INK}22`,
            }}
          >
            {texts.amounts.map((line) => (
              <div key={line} style={{ display: 'flex', fontSize: 40, fontWeight: 700, lineHeight: 1.45 }}>
                {line}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ ...card, background: INK, color: PAPER }}>
        <div style={{ ...label, display: 'flex', color: YELLOW }}>{texts.category.label}</div>
        <div
          style={{ ...display, display: 'flex', marginTop: 16, fontSize: texts.category.name.length > 15 ? 58 : 76 }}
        >
          {texts.category.name}
        </div>
        <div style={{ display: 'flex', marginTop: 12, fontSize: 38 }}>{texts.category.note}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: 520 }}>
          {texts.streak && (
            <div style={{ ...card, background: texts.headline.good ? MINT : YELLOW, padding: '36px 44px' }}>
              <div style={{ ...label, display: 'flex' }}>{texts.streak.label}</div>
              <div
                style={{ ...display, display: 'flex', marginTop: 8, fontSize: texts.streak.value.length > 8 ? 52 : 68 }}
              >
                {texts.streak.value}
              </div>
            </div>
          )}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              marginTop: 36,
              fontSize: 36,
              fontWeight: 700,
              lineHeight: 1.35,
            }}
          >
            <div style={{ display: 'flex' }}>Grana explicada,</div>
            <div style={{ display: 'flex' }}>de tostão em tostão.</div>
          </div>
        </div>
        <img src={assets.mascot} width={380} height={380} alt="" />
      </div>
    </div>,
    { width: SHARE_WIDTH, height: SHARE_HEIGHT, fonts: assets.fonts },
  );
  // Lê tudo aqui: se o desenho falhar, vira erro tratável em vez de uma imagem cortada no meio da resposta.
  return image.arrayBuffer();
}
