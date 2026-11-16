// Gera content/lessons/modules.json a partir de content/curriculo.md.
// Edite o .md (texto do currículo) e rode: pnpm content:build
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const md = readFileSync(new URL('../content/curriculo.md', import.meta.url), 'utf8').replace(/\\([!.\-*()])/g, '$1');
const body = md.split('## Microcopy')[0];
const slug = (s) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const field = (block, name) => {
  const m = new RegExp(`\\*\\*${name}:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\s*-\\s*\\*\\*|$)`).exec(block);
  return m ? m[1].replace(/\s+/g, ' ').trim().replace(/^"|"$/g, '') : '';
};

const modules = body
  .split(/\n## Módulo /)
  .slice(1)
  .map((chunk, i) => {
    const [head, ...rest] = chunk.split(/\n### Lição /);
    const title = head
      .split('\n')[0]
      .replace(/^\d+:\s*/, '')
      .trim();
    const optional = /só para quem/i.test(title);
    const lessons = rest.map((l, j) => {
      const lessonTitle = l
        .split('\n')[0]
        .replace(/^\d+:\s*/, '')
        .trim();
      const simulador = field(l, 'Simulador');
      const sim = /^\*(.+?)\*:\s*(.*)$/.exec(simulador);
      const dilema = field(l, 'Dilema');
      const dm = /^(.*?)\s*Lado A:\s*(.*?)\s*Lado B:\s*(.*)$/.exec(dilema);
      let question = dilema;
      let optionA = 'Opção A';
      let optionB = 'Opção B';
      let sideA = '';
      let sideB = '';

      if (dm) {
        question = dm[1].trim();
        sideA = dm[2].trim();
        sideB = dm[3].trim();
        const optMatch = /^Opção A:\s*(.*?)\s*vs\.\s*Opção B:\s*(.*?)\.?$/.exec(question);
        if (optMatch) {
          optionA = optMatch[1].trim();
          optionB = optMatch[2].trim();
        } else {
          const vsMatch = /^(.*?)\s*vs\.\s*(.*?)\.?$/.exec(question);
          if (vsMatch) {
            optionA = vsMatch[1].replace(/^Opção A:\s*/i, '').trim();
            optionB = vsMatch[2].replace(/^Opção B:\s*/i, '').trim();
          }
        }
      }

      return {
        id: `m${i + 1}-l${j + 1}`,
        number: j + 1,
        title: lessonTitle,
        hook: field(l, 'Gancho'),
        concept: field(l, 'Conceito'),
        simulator: sim ? { name: sim[1], description: sim[2] } : { name: 'Simulador', description: simulador },
        dilemma: { question, optionA, optionB, sideA, sideB },
        commitment: field(l, 'Compromisso da semana'),
      };
    });
    return {
      id: `m${i + 1}`,
      number: i + 1,
      slug: slug(title.replace(/\(.*\)/, '')),
      title: title.replace(/\s*\(.*\)/, ''),
      optional,
      goal: field(head, 'Objetivo'),
      lessons,
    };
  });

mkdirSync(new URL('../content/lessons/', import.meta.url), { recursive: true });
writeFileSync(new URL('../content/lessons/modules.json', import.meta.url), JSON.stringify({ modules }, null, 2) + '\n');
console.log(`${modules.length} módulos, ${modules.reduce((s, m) => s + m.lessons.length, 0)} lições`);
