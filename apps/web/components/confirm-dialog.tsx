'use client';
import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDialogA11y } from '@/lib/use-dialog-a11y';

type ConfirmDialogProps = {
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** O diálogo em si (sem portal): existe enquanto estiver montado, então o hook de a11y roda do início ao fim da vida dele. */
export function ConfirmDialogPanel({
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = true,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descId = useId();
  useDialogA11y({ open: true, containerRef: panel, onClose: onCancel, initialFocusRef: cancelRef });

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      onClick={onCancel}
    >
      <div
        ref={panel}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[400px] flex-col gap-4 rounded-[24px] border border-linha bg-cartao p-6 text-tinta shadow-2xl outline-none"
      >
        <div className="flex flex-col gap-1.5">
          <h2 id={titleId} className="font-display text-xl leading-6 font-extrabold">
            {title}
          </h2>
          {description && (
            <p id={descId} className="text-[14px] leading-[20px] text-tinta-suave">
              {description}
            </p>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="flex h-11 items-center justify-center rounded-full border-[1.5px] border-tinta px-5 text-sm font-semibold"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold disabled:opacity-50 ${
              destructive ? 'bg-vermelho-texto text-papel' : 'bg-tinta text-papel'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Confirmação acessível pra ações destrutivas (no lugar do `window.confirm`): role="alertdialog", foco inicial em
 * "Cancelar" (o lado seguro), focus trap, Esc cancela, o foco volta pra quem abriu e o body não rola.
 */
export function ConfirmDialog({ open, ...props }: ConfirmDialogProps & { open: boolean }) {
  if (!open || typeof document === 'undefined') return null;
  return createPortal(<ConfirmDialogPanel {...props} />, document.body);
}

/**
 * Botão de enviar formulário que pede confirmação antes. Funciona com Server Action e com `useActionState`:
 * ao confirmar, reenvia o formulário com `requestSubmit(botão)`, então `name`/`value` do botão (ex.: `serie=1`) seguem junto.
 */
export function ConfirmSubmitButton({
  children,
  title,
  description,
  confirmLabel,
  cancelLabel,
  className,
  disabled,
  name,
  value,
  destructive = true,
  'aria-label': ariaLabel,
}: {
  children: React.ReactNode;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  className?: string;
  disabled?: boolean;
  name?: string;
  value?: string;
  destructive?: boolean;
  'aria-label'?: string;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={button}
        type="submit"
        name={name}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        className={className}
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
      >
        {children}
      </button>
      <ConfirmDialog
        open={open}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        destructive={destructive}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          const form = button.current?.form;
          // requestSubmit com o botão como "submitter" não dispara o click de novo: não reabre o diálogo.
          if (form && button.current) form.requestSubmit(button.current);
        }}
      />
    </>
  );
}

/** Confirmação pra ações que não são <form> (ex.: botão que chama uma Server Action direto). */
export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
}: {
  trigger: (open: () => void) => React.ReactNode;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {trigger(() => setOpen(true))}
      <ConfirmDialog
        open={open}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          onConfirm();
        }}
      />
    </>
  );
}
