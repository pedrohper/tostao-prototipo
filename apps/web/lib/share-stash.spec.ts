import { beforeEach, describe, expect, it } from 'vitest';
import {
  SHARE_MAX_PER_USER,
  SHARE_MAX_TOTAL,
  SHARE_TTL_MS,
  clearShares,
  peekShare,
  putShare,
  takeShare,
} from './share-stash';

const file = (name = 'f.pdf') => ({ name, type: 'application/pdf', bytes: new Uint8Array([1, 2, 3]) });
beforeEach(() => clearShares());

describe('share-stash', () => {
  it('guarda e devolve o arquivo SÓ pra mesma pessoa; o id é imprevisível', () => {
    const id = putShare('user-a', file())!;
    expect(id).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    expect(putShare('user-a', file())).not.toBe(id);
    expect(peekShare('user-a', id)?.name).toBe('f.pdf');
    expect(peekShare('user-b', id)).toBeNull(); // outra pessoa, mesmo com o id
    expect(peekShare('user-a', 'id-inventado')).toBeNull();
  });

  it('peek não apaga (a página pode renderizar de novo); take apaga', () => {
    const id = putShare('u', file())!;
    expect(peekShare('u', id)).not.toBeNull();
    expect(peekShare('u', id)).not.toBeNull();
    expect(takeShare('u', id)).not.toBeNull();
    expect(peekShare('u', id)).toBeNull();
    expect(takeShare('u', id)).toBeNull();
  });

  it('take de outra pessoa não apaga o arquivo do dono', () => {
    const id = putShare('dono', file())!;
    expect(takeShare('intruso', id)).toBeNull();
    expect(peekShare('dono', id)).not.toBeNull();
  });

  it('expira em 10 minutos', () => {
    const t0 = 1_000_000;
    const id = putShare('u', file(), t0)!;
    expect(peekShare('u', id, t0 + SHARE_TTL_MS - 1)).not.toBeNull();
    expect(peekShare('u', id, t0 + SHARE_TTL_MS)).toBeNull();
  });

  it(`teto por pessoa (${SHARE_MAX_PER_USER}): o mais antigo dela sai`, () => {
    const ids = Array.from({ length: SHARE_MAX_PER_USER + 1 }, (_, i) => putShare('u', file(`f${i}.pdf`))!);
    expect(peekShare('u', ids[0]!)).toBeNull();
    expect(peekShare('u', ids.at(-1)!)).not.toBeNull();
  });

  it(`teto global (${SHARE_MAX_TOTAL}): recusa em vez de crescer sem limite`, () => {
    for (let i = 0; i < SHARE_MAX_TOTAL; i++) expect(putShare(`u${i}`, file())).not.toBeNull();
    expect(putShare('mais-um', file())).toBeNull();
  });
});
