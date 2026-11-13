import { describe, expect, it, vi } from 'vitest';
import { InstitutionLogosUseCase } from './institution-logos.js';

describe('InstitutionLogosUseCase', () => {
  it('guarda a lista por um dia', async () => {
    const list = vi.fn().mockResolvedValue([{ name: 'Nubank', imageUrl: 'https://x/nu.svg', color: '#820AD1' }]);
    let t = 0;
    const uc = new InstitutionLogosUseCase({ listInstitutionLogos: list }, () => t);
    await uc.execute();
    t = 60_000;
    const r = await uc.execute();
    expect(r.logos[0]?.name).toBe('Nubank');
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('se o provedor falhar, devolve vazio sem quebrar', async () => {
    const uc = new InstitutionLogosUseCase({ listInstitutionLogos: vi.fn().mockRejectedValue(new Error('fora do ar')) });
    expect(await uc.execute()).toEqual({ logos: [] });
  });
});
