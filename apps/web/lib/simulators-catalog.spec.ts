import { describe, expect, it } from 'vitest';
import { modules } from './lessons';
import { SIMULATOR_CATALOG, SIMULATOR_GROUPS, findSimulator, simulatorsByGroup } from './simulators-catalog';

describe('catálogo de simuladores', () => {
  it('todo id aponta pra uma lição que existe e tem simulador no conteúdo', () => {
    const lessons = new Map(modules.flatMap((m) => m.lessons).map((l) => [l.id, l]));
    for (const s of SIMULATOR_CATALOG) {
      expect(lessons.has(s.id), s.id).toBe(true);
      expect(lessons.get(s.id)!.simulator.description.length, s.id).toBeGreaterThan(10);
    }
  });

  it('ids únicos, grupos válidos e os principais pedidos estão lá', () => {
    const ids = SIMULATOR_CATALOG.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SIMULATOR_CATALOG) expect(SIMULATOR_GROUPS).toContain(s.group);
    // Parcelado vs à vista, Reserva, Juros compostos, Bola de neve, Assinaturas no ano
    for (const must of ['m2-l3', 'm4-l5', 'm5-l1', 'm2-l2', 'm1-l3']) expect(ids).toContain(must);
    expect(SIMULATOR_CATALOG.length).toBeGreaterThanOrEqual(10);
  });

  it('cada um diz o que a pessoa vai entender, em frase curta (cabe em 2 linhas no celular) e própria', () => {
    for (const s of SIMULATOR_CATALOG) {
      expect(s.aprende.length, s.id).toBeGreaterThan(30);
      expect(s.aprende.length, s.id).toBeLessThanOrEqual(90);
      expect(s.aprende, s.id).toMatch(/^[A-ZÀ-Ú].*\.$/);
      expect(s.aprende, s.id).not.toBe(s.blurb);
    }
    expect(new Set(SIMULATOR_CATALOG.map((s) => s.aprende)).size).toBe(SIMULATOR_CATALOG.length);
    // os 3 pilotos do SimuladorShell (T6.13) estão na galeria
    for (const piloto of ['m2-l2', 'm5-l3', 'm5-l4']) expect(findSimulator(piloto), piloto).not.toBeNull();
  });

  it('findSimulator só acha o que está na galeria (id inventado ou de lição sem destaque = null)', () => {
    expect(findSimulator('m4-l5')?.title).toBe('Reserva de emergência');
    expect(findSimulator('m1-l4')).toBeNull();
    expect(findSimulator('../../etc/passwd')).toBeNull();
    expect(findSimulator('')).toBeNull();
  });

  it('agrupa na ordem dos grupos, sem grupo vazio', () => {
    const groups = simulatorsByGroup();
    expect(groups.map((g) => g.group)).toEqual([...SIMULATOR_GROUPS]);
    expect(groups.flatMap((g) => g.items)).toHaveLength(SIMULATOR_CATALOG.length);
  });
});
