// "Isso é golpe?" (T6.20): a pessoa cola a mensagem que recebeu e o Tostão aponta os sinais. Os textos fixos moram
// aqui porque o app, o WhatsApp e a tela sem IA precisam dizer exatamente a mesma coisa.
import { z } from 'zod';

export const SCAM_MESSAGE_MIN = 10;
export const SCAM_MESSAGE_MAX = 2000;

export const scamCheckBody = z.object({
  message: z
    .string({ error: 'Cola a mensagem que você recebeu' })
    .trim()
    .min(SCAM_MESSAGE_MIN, 'Cola a mensagem inteira que você recebeu')
    .max(SCAM_MESSAGE_MAX, 'Mensagem longa demais (máx. 2.000 caracteres)'),
});

export type ScamRisk = 'baixo' | 'medio' | 'alto';

/** Nenhum título afirma certeza, nem o de risco baixo. */
export const SCAM_HEADLINES: Record<ScamRisk, string> = {
  alto: 'Risco alto: tem muita cara de golpe',
  medio: 'Risco médio: tem coisa estranha aí',
  baixo: 'Risco baixo: poucos sinais, mas isso não garante nada',
};

/** Fecha TODA resposta, com IA ou sem. */
export const SCAM_FINAL_ADVICE = 'Na dúvida, fala com o banco pelo app oficial.';

export const SCAM_CHECKLIST_SIGNS = [
  'Pressa ou ameaça: “só hoje”, “sua conta vai ser bloqueada”.',
  'Pede senha, código que chegou por SMS ou dados do cartão.',
  'Pede Pix, “taxa” ou depósito pra liberar prêmio, empréstimo ou vaga.',
  'Link estranho, encurtado ou parecido com o do banco, mas diferente.',
  'Número novo dizendo ser parente ou amigo e pedindo dinheiro.',
  'Promessa boa demais: dinheiro fácil, lucro garantido, prêmio que você nem disputou.',
] as const;

export const SCAM_CHECKLIST_ACTIONS = [
  'Não clica no link, não responde e não manda dinheiro.',
  'Confirma com a pessoa ou a empresa por um canal que você já conhecia.',
  'Já fez Pix ou passou dados? Avisa o banco na hora, pede a devolução pelo MED do Pix e registra boletim de ocorrência.',
] as const;

/** Por que veio a lista fixa em vez da análise da IA. */
export type ScamFallbackReason = 'sem_ia' | 'limite' | 'falha';

export const SCAM_FALLBACK_NOTES: Record<ScamFallbackReason, string> = {
  sem_ia: 'A análise com IA não está disponível agora. Confere os sinais você mesmo:',
  limite: 'Suas análises com IA de hoje acabaram. Confere os sinais você mesmo:',
  falha: 'Não consegui analisar agora. Confere os sinais você mesmo:',
};

/** POST /chat/scam-check. Nem a mensagem nem a resposta ficam guardadas. */
export type ScamCheckResponse = {
  signs: string[];
  actions: string[];
  advice: string;
} & ({ source: 'ia'; risk: ScamRisk } | { source: 'checklist'; risk: null; reason: ScamFallbackReason });
