// Lançamentos GERADOS PELO APP (não vieram de banco nem de arquivo), mas que precisam de um externalId pra nunca duplicar:
//   rec:<regra>:<período>      recorrência/parcela automática (T5.2)
//   link:<lançamento>          contrapartida criada pelo vínculo de fatura/transferência (T5.2)
//   shortcut:<token>:<evento>  compra enviada pelo Atalho do iOS (T5.3)
// Pra pessoa eles se comportam como anotação à mão (editam, apagam, entram no saldo da conta manual); só não são
// "do banco": a conciliação não os trata como confirmação de extrato, e a tela mostra "manual".
const PREFIXES = ['rec:', 'link:', 'shortcut:'] as const;

export const isAppGenerated = (externalId: string | null | undefined): boolean =>
  !!externalId && PREFIXES.some((p) => externalId.startsWith(p));

/** Veio do banco ou de arquivo importado (tem externalId e não foi o app que gerou). */
export const isBankSourced = (externalId: string | null | undefined): boolean =>
  !!externalId && !isAppGenerated(externalId);

export const linkExternalId = (transactionId: string) => `link:${transactionId}`;
export const shortcutExternalId = (tokenId: string, eventId: string) => `shortcut:${tokenId}:${eventId}`;
