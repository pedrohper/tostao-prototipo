// T5.3 · mini passo a passo (3 passos curtos) pra baixar o PDF da fatura/extrato nos bancos principais.
// Os nomes dos botões mudam de versão pra versão do app: o texto fala do caminho, não promete o rótulo exato.
export type BankGuide = { id: string; name: string; what: string; steps: [string, string, string] };

export const PDF_GUIDES: BankGuide[] = [
  {
    id: 'nubank',
    name: 'Nubank',
    what: 'Fatura do cartão',
    steps: [
      'Abra o app e toque em "Cartão de crédito".',
      'Escolha a fatura (fechada ou atual) e procure o ícone de compartilhar/baixar.',
      'Escolha "PDF" e compartilhe com o Tostão (ou salve e escolha aqui).',
    ],
  },
  {
    id: 'inter',
    name: 'Inter',
    what: 'Extrato ou fatura',
    steps: [
      'No app, abra "Extrato" (ou "Cartões" → fatura).',
      'Toque em "Exportar"/"Compartilhar" e escolha o período.',
      'Formato PDF; compartilhe com o Tostão ou salve e escolha aqui.',
    ],
  },
  {
    id: 'itau',
    name: 'Itaú',
    what: 'Extrato ou fatura',
    steps: [
      'No app, entre em "Extrato" ou na fatura do cartão.',
      'Procure "Salvar PDF"/"Compartilhar" no topo da tela.',
      'Mande o PDF pro Tostão pelo compartilhar do celular.',
    ],
  },
  {
    id: 'bradesco',
    name: 'Bradesco',
    what: 'Extrato ou fatura',
    steps: [
      'Abra "Extrato" ou "Cartões" → fatura.',
      'Toque em "Exportar"/"Baixar" e escolha PDF.',
      'Compartilhe com o Tostão ou escolha o arquivo aqui.',
    ],
  },
  {
    id: 'santander',
    name: 'Santander',
    what: 'Extrato ou fatura',
    steps: [
      'No app, abra "Extrato" ou a fatura do cartão.',
      'Toque em "Compartilhar"/"Baixar" e escolha PDF.',
      'Mande pro Tostão pelo compartilhar do celular.',
    ],
  },
  {
    id: 'c6',
    name: 'C6 Bank',
    what: 'Extrato ou fatura',
    steps: [
      'No app, abra "Extrato" ou a fatura do cartão.',
      'Toque em "Exportar"/"Compartilhar" e escolha PDF.',
      'Compartilhe com o Tostão ou escolha o arquivo aqui.',
    ],
  },
];
