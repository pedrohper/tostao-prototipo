// Código COMPE (3 dígitos do transferNumber da Pluggy) -> nome do banco.
// Pelo MeuPluggy o conector sempre se chama "MeuPluggy", então é daqui que sai o nome de verdade.
const BANKS: Record<string, string> = {
  '001': 'Banco do Brasil', '033': 'Santander', '041': 'Banrisul', '070': 'BRB', '077': 'Inter',
  '102': 'XP', '104': 'Caixa', '197': 'Stone', '208': 'BTG Pactual', '212': 'Banco Original',
  '237': 'Bradesco', '260': 'Nubank', '290': 'PagBank', '323': 'Mercado Pago', '336': 'C6 Bank',
  '341': 'Itaú', '380': 'PicPay', '403': 'Cora', '422': 'Safra', '536': 'Neon', '655': 'Neon',
  '748': 'Sicredi', '756': 'Sicoob',
};

/** "260/0001/12345-6" -> "Nubank". */
export function bankNameFromTransferNumber(transferNumber: string | null | undefined): string | null {
  const code = /^(\d{3})\b/.exec(transferNumber?.trim() ?? '')?.[1];
  return code ? BANKS[code] ?? null : null;
}

/** "AMAZON MASTERCARD PLATINUM" / "gold" -> "Amazon Mastercard Platinum" / "Gold". Nome já misturado fica como está. */
export function prettyName(s: string) {
  if (s !== s.toUpperCase() && s !== s.toLowerCase()) return s;
  return s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());
}

/** Conector "ponte" que não diz qual é o banco. */
export function isGenericInstitution(name: string | null | undefined) {
  return !name || /pluggy/i.test(name);
}
