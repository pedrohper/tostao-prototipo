import Link from 'next/link';
import { ErrorNote } from '@/components/ui';
import type { Dictionary } from '@/lib/i18n';

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="shrink-0">
      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
    </svg>
  );
}

export function resolveOAuthError(
  code: string | undefined,
  errors: Dictionary['authPages']['social']['errors'],
): string | undefined {
  if (!code) return undefined;
  switch (code) {
    case 'unconfigured_google':
      return errors.unconfiguredGoogle;
    case 'unconfigured_apple':
      return errors.unconfiguredApple;
    case 'cancelled':
      return errors.cancelled;
    case 'unverified_email':
      return errors.unverifiedEmail;
    case 'email_in_use_password':
      return errors.emailInUsePassword;
    default:
      return errors.failed;
  }
}

export function SocialAuthButtons({
  mode,
  invite,
  oauthError,
  social,
  form,
}: {
  mode: 'entrar' | 'criar';
  invite?: string;
  oauthError?: string;
  social: Dictionary['authPages']['social'];
  form: Dictionary['authPages']['form'];
}) {
  const from = mode === 'criar' ? 'criar-conta' : 'entrar';
  const query = new URLSearchParams({ from });
  if (mode === 'criar' && invite) query.set('convite', invite);
  const qs = query.toString();
  const errorMessage = resolveOAuthError(oauthError, social.errors);

  return (
    <div className="flex flex-col gap-2.5">
      <a
        href={`/api/auth/google/start?${qs}`}
        className="flex h-[52px] w-full items-center justify-center gap-2.5 rounded-full border-[1.5px] border-linha bg-cartao px-4 text-[15px] font-semibold text-tinta transition hover:border-tinta/40 active:translate-y-px"
      >
        <GoogleIcon />
        <span>{social.continueGoogle}</span>
      </a>
      <a
        href={`/api/auth/apple/start?${qs}`}
        className="flex h-[52px] w-full items-center justify-center gap-2.5 rounded-full border-[1.5px] border-tinta bg-tinta px-4 text-[15px] font-semibold text-papel transition hover:opacity-90 active:translate-y-px"
      >
        <AppleIcon />
        <span>{social.continueApple}</span>
      </a>
      {mode === 'criar' && (
        <p className="px-1 text-center text-xs leading-[17px] text-tinta-suave">
          {social.signupTermsPrefix}
          <Link href="/termos" className="font-semibold text-tinta underline">
            {form.termsLink}
          </Link>
          {form.andWord}
          <Link href="/privacidade" className="font-semibold text-tinta underline">
            {form.privacyLink}
          </Link>
          {form.termsSuffix}
        </p>
      )}
      <ErrorNote message={errorMessage} />
      <div className="my-1 flex items-center gap-3 text-xs font-semibold tracking-wide text-tinta-suave uppercase">
        <span className="h-px grow bg-linha" aria-hidden="true" />
        <span>{social.orEmail}</span>
        <span className="h-px grow bg-linha" aria-hidden="true" />
      </div>
    </div>
  );
}
