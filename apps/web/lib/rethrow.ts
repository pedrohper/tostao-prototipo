// Server Actions e layouts do Next ABORTAM a renderização lançando um erro especial (NEXT_REDIRECT, notFound...).
// Um `catch` que engole isso transforma "redireciona pro login" em "segue como se nada": a tela renderiza sem sessão
// ou a ação responde com erro genérico. Todo catch em volta de api()/redirect() começa com rethrowIfRedirect(e).
import { unstable_rethrow } from 'next/navigation';

/** Relança os erros de controle do Next (redirect, notFound, forbidden...). Erro comum passa batido. */
export function rethrowIfRedirect(err: unknown): void {
  unstable_rethrow(err);
}

/** Pra `.catch()` de promise: devolve o fallback em erro comum, mas deixa o redirect passar. */
export function orFallback<T>(fallback: T): (err: unknown) => T {
  return (err) => {
    rethrowIfRedirect(err);
    return fallback;
  };
}
