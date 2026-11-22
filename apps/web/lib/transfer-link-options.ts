// T5.2 · quais contas cada vínculo aceita no detalhe do lançamento (a API confere de novo).
export type LinkAccount = { id: string; name: string; type: 'BANK' | 'CREDIT' };

/**
 * "É pagamento de fatura": exatamente um dos lados é cartão (lançamento numa conta → escolhe o cartão; lançamento no
 * cartão → escolhe quem pagou). "Transferi pra outra conta minha": nenhum lado é cartão. Nunca a própria conta.
 */
export function linkOptions(source: LinkAccount | null, accounts: LinkAccount[]) {
  const others = accounts.filter((a) => a.id !== source?.id);
  const sourceIsCard = source?.type === 'CREDIT';
  return {
    cardPayment: others.filter((a) => (sourceIsCard ? a.type === 'BANK' : a.type === 'CREDIT')),
    transfer: sourceIsCard ? [] : others.filter((a) => a.type === 'BANK'),
  };
}
