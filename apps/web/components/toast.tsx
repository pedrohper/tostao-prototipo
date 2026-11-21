'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { getDictionary, type Locale } from '@/lib/i18n';
import {
  createToast,
  toastReducer,
  toastRole,
  type Toast,
  type ToastInput,
  type ToastVariant,
} from '@/lib/toast-state';

export type ToastApi = {
  /** Mostra um toast e devolve o id (pra fechar antes da hora). */
  toast: (input: ToastInput) => string;
  success: (message: string, options?: Omit<ToastInput, 'message' | 'variant'>) => string;
  error: (message: string, options?: Omit<ToastInput, 'message' | 'variant'>) => string;
  info: (message: string, options?: Omit<ToastInput, 'message' | 'variant'>) => string;
  dismiss: (id: string) => void;
};

// Fora do provider (um teste, uma tela isolada) o hook não quebra: só não mostra nada.
const NOOP_API: ToastApi = {
  toast: () => '',
  success: () => '',
  error: () => '',
  info: () => '',
  dismiss: () => {},
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  return useContext(ToastContext) ?? NOOP_API;
}

const STYLES: Record<ToastVariant, string> = {
  success: 'bg-tinta text-papel',
  info: 'border border-linha bg-azul text-tinta',
  error: 'border border-vermelho-texto/30 bg-rosa text-vermelho-texto',
};

function ToastItem({ toast, dismissLabel, onDismiss }: { toast: Toast; dismissLabel: string; onDismiss: () => void }) {
  // O callback muda a cada render do provider: guardado num ref pra não reiniciar o relógio dos toasts antigos.
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  });
  useEffect(() => {
    const timer = setTimeout(() => dismissRef.current(), toast.durationMs);
    return () => clearTimeout(timer);
  }, [toast.id, toast.durationMs]);

  return (
    <div
      role={toastRole(toast.variant)}
      data-variant={toast.variant}
      // motion-safe: quem pede menos movimento (prefers-reduced-motion) recebe o toast sem animação.
      className={`pointer-events-auto flex max-w-[min(92vw,420px)] items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-semibold shadow-lg motion-safe:animate-[toast-in_0.2s_ease-out] ${STYLES[toast.variant]}`}
    >
      <span className="min-w-0 flex-1">{toast.message}</span>
      {toast.actionLabel && toast.onAction && (
        <button
          type="button"
          onClick={() => {
            const action = toast.onAction;
            onDismiss();
            void action?.();
          }}
          className="shrink-0 rounded-full px-2 py-1 text-sm font-bold underline underline-offset-2"
        >
          {toast.actionLabel}
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label={dismissLabel}
        className="-mr-1 shrink-0 rounded-full px-1.5 py-0.5 text-base leading-none opacity-70 hover:opacity-100"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}

/** Região de avisos. Fica sempre no DOM: leitor de tela só anuncia o que entra numa live region que já existia. */
export function ToastViewport({
  toasts,
  dismissLabel,
  onDismiss,
}: {
  toasts: Toast[];
  dismissLabel: string;
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-[92px] z-40 flex flex-col items-center gap-2 px-4 md:bottom-6"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} dismissLabel={dismissLabel} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

/** Toast global: um `useToast()` em qualquer Client Component do app, com "Desfazer" opcional. */
export function ToastProvider({ children, locale = 'pt-BR' }: { children: React.ReactNode; locale?: Locale }) {
  const [toasts, dispatch] = useReducer(toastReducer, [] as Toast[]);
  const counter = useRef(0);
  const dismissLabel = getDictionary(locale).growth.toast.dismissAria;

  const dismiss = useCallback((id: string) => dispatch({ type: 'dismiss', id }), []);
  const toast = useCallback((input: ToastInput) => {
    counter.current += 1;
    const id = `t${counter.current}`;
    dispatch({ type: 'add', toast: createToast(input, id) });
    return id;
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      toast,
      dismiss,
      success: (message, options) => toast({ ...options, message, variant: 'success' }),
      error: (message, options) => toast({ ...options, message, variant: 'error' }),
      info: (message, options) => toast({ ...options, message, variant: 'info' }),
    }),
    [toast, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} dismissLabel={dismissLabel} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}
