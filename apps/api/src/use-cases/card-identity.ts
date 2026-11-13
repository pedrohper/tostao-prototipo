/** "CREDIT:VISA:2784" → { brand: 'VISA', last4: '2784' }. Sem fingerprint, tudo null. */
export function cardIdentity(fingerprint: string | null | undefined): { brand: string | null; last4: string | null } {
  const [kind, brand, last4] = (fingerprint ?? '').split(':');
  if (kind !== 'CREDIT' || !last4) return { brand: null, last4: null };
  return { brand: brand || null, last4 };
}
