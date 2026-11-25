// Fim da Home: trazer de volta os avisos fechados e abrir o Personalizar.
import Link from 'next/link';
import type { Dictionary } from '@/lib/i18n';
import { restoreDismissedAlerts } from '@/lib/inicio-actions';

export function RestoreAlertsForm({ count, t }: { count: number; t: Dictionary }) {
  if (count === 0) return null;
  return (
    <form action={restoreDismissedAlerts} className="self-center">
      <button type="submit" className="min-h-11 text-small font-semibold text-tinta-suave underline">
        {t.home.showDismissedAlerts(count)}
      </button>
    </form>
  );
}

export function CustomizeHomeLink({ t }: { t: Dictionary }) {
  return (
    <Link
      href="/inicio/personalizar"
      className="flex h-11 items-center justify-center gap-2 self-center rounded-full border border-linha px-4 text-[14px] font-semibold text-tinta no-underline"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
        <circle cx="16" cy="6" r="2" />
        <circle cx="10" cy="12" r="2" />
        <circle cx="18" cy="18" r="2" />
      </svg>
      {t.home.customizeHome}
    </Link>
  );
}
