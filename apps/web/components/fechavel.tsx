import { dismissAlert } from '@/lib/inicio-actions';

/** "X" button to dismiss an alert card that the user has resolved. */
export function DismissButton({ id, label = 'Já resolvi, fechar' }: { id: string; label?: string }) {
  return (
    <form action={dismissAlert.bind(null, id)} className="absolute top-1.5 right-1.5 z-[1]">
      <button
        type="submit"
        aria-label={label}
        title={label}
        className="flex h-8 w-8 items-center justify-center rounded-full text-tinta-suave hover:bg-tinta/10"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </form>
  );
}

/** Card wrapper with a top-right dismiss button. */
export function DismissibleCard({ id, label, children }: { id: string; label?: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <DismissButton id={id} label={label} />
    </div>
  );
}

