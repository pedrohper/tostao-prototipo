// Estado do toast global, sem React: um reducer puro que o ToastProvider usa e o vitest testa direto.

export type ToastVariant = 'success' | 'error' | 'info';

export type Toast = {
  id: string;
  message: string;
  variant: ToastVariant;
  /** Texto do botão (ex.: "Desfazer"). Só aparece junto com `onAction`. */
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  durationMs: number;
};

export type ToastInput = {
  message: string;
  variant?: ToastVariant;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  /** Padrão por variante; toast com ação dura mais, pra dar tempo de tocar. */
  durationMs?: number;
};

export type ToastAction = { type: 'add'; toast: Toast } | { type: 'dismiss'; id: string } | { type: 'clear' };

/** Mais que isso na tela vira poluição: os mais antigos saem. */
export const MAX_TOASTS = 3;

const DEFAULT_DURATION: Record<ToastVariant, number> = { success: 3500, info: 4000, error: 6000 };
const WITH_ACTION_DURATION = 7000;

export function createToast(input: ToastInput, id: string): Toast {
  const variant = input.variant ?? 'success';
  const hasAction = Boolean(input.actionLabel && input.onAction);
  return {
    id,
    message: input.message,
    variant,
    ...(hasAction ? { actionLabel: input.actionLabel, onAction: input.onAction } : {}),
    durationMs: input.durationMs ?? (hasAction ? WITH_ACTION_DURATION : DEFAULT_DURATION[variant]),
  };
}

export function toastReducer(state: Toast[], action: ToastAction): Toast[] {
  switch (action.type) {
    case 'add': {
      // Mesma mensagem e variante já na tela (ex.: dois "Salvo" seguidos): troca em vez de empilhar.
      const rest = state.filter((t) => !(t.message === action.toast.message && t.variant === action.toast.variant));
      return [...rest, action.toast].slice(-MAX_TOASTS);
    }
    case 'dismiss':
      return state.some((t) => t.id === action.id) ? state.filter((t) => t.id !== action.id) : state;
    case 'clear':
      return state.length === 0 ? state : [];
  }
}

/** `role` do toast: erro interrompe o leitor de tela (alert); o resto espera a vez (status). */
export function toastRole(variant: ToastVariant): 'alert' | 'status' {
  return variant === 'error' ? 'alert' : 'status';
}
