// T5.3 · tela /mais/atalhos: o que o Atalho do iPhone precisa saber pra falar com o Tostão. Funções puras.

/** URL pública do webhook: o iPhone fala com o SITE (o BFF repassa pra API). Sem barra sobrando. */
export function webhookUrl(base: string): string {
  return `${base.replace(/\/+$/, '')}/api/webhooks/shortcuts`;
}

export type GuideKind = 'apple_pay' | 'ios_notification';

/** Corpo JSON que o Atalho manda. Os `[...]` são as variáveis mágicas do app Atalhos. */
export function bodyTemplate(kind: GuideKind): string {
  const body =
    kind === 'apple_pay'
      ? { source: 'apple_pay', amount: '[Valor]', merchant: '[Comerciante]', eventId: '[Data atual] [Valor]' }
      : { source: 'ios_notification', text: '[Entrada do atalho]', eventId: '[Data atual]' };
  return JSON.stringify(body, null, 2);
}

export type GuideStep = { title: string; body: string };

/** Os 3 passos de cada caminho (o texto da tela). */
export function guideSteps(kind: GuideKind): GuideStep[] {
  if (kind === 'apple_pay') {
    return [
      {
        title: 'Gere o seu token',
        body: 'Aqui em cima, toque em "Gerar token". Ele aparece UMA vez: copie e guarde no Atalho.',
      },
      {
        title: 'Crie a automação no app Atalhos',
        body: 'Atalhos → Automação → Nova automação → Transação (Wallet). Escolha os cartões, "Executar imediatamente" e, na ação, "Obter conteúdo da URL".',
      },
      {
        title: 'Aponte pro Tostão',
        body: 'URL abaixo, método POST, cabeçalho Authorization com "Bearer" + seu token, e o corpo JSON do modelo. Faça uma compra de teste e confira no Tostão.',
      },
    ];
  }
  return [
    { title: 'Gere o seu token', body: 'Aqui em cima, toque em "Gerar token" e copie. Ele aparece uma única vez.' },
    {
      title: 'Crie a automação de Notificação',
      body: 'Atalhos → Automação → Nova automação → Notificação (iOS 27 ou mais novo). Escolha o app do seu banco e, se quiser, filtre por "compra".',
    },
    {
      title: 'Mande o texto pro Tostão',
      body: 'Ação "Obter conteúdo da URL": POST na URL abaixo, Authorization com "Bearer" + token e o corpo do modelo. O Tostão lê o valor e o estabelecimento do texto.',
    },
  ];
}

/** Atalhos prontos (iCloud) são opcionais: só aparecem se o link estiver configurado no build. */
export function installLink(kind: GuideKind, env: Record<string, string | undefined> = process.env): string | null {
  const v = kind === 'apple_pay' ? env.SHORTCUT_APPLE_PAY_URL : env.SHORTCUT_NOTIFICATION_URL;
  return v && /^https:\/\/www\.icloud\.com\/shortcuts\//.test(v) ? v : null;
}
