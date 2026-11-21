/**
 * O que volta pro formulário depois de um erro de login/cadastro. Allowlist explícita: NUNCA inclui
 * `password` nem `confirmPassword` (senha em texto plano não pode voltar no HTML/RSC payload).
 */
export function safeAuthFields(raw: Record<string, unknown>): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const key of ['name', 'email', 'inviteCode'] as const) {
    const value = raw[key];
    if (typeof value === 'string') fields[key] = value;
  }
  return fields;
}
