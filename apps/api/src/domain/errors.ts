// Erros de negócio. O controller não precisa saber de regra:
// ele só traduz cada erro pro status HTTP certo (ver http/error-handler.ts).
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    /** Código estável pra máquina (a UI decide o que mostrar sem depender do texto). */
    public readonly code?: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
export class EmailAlreadyInUseError extends AppError {
  constructor() {
    super('Esse e-mail já tem conta. Tenta entrar.', 409);
  }
}
export class InvalidCredentialsError extends AppError {
  constructor() {
    super('E-mail ou senha não batem.', 401);
  }
}
export class ResourceNotFoundError extends AppError {
  constructor(what = 'Recurso') {
    super(`${what} não encontrado.`, 404);
  }
}
export class BankConnectionError extends AppError {
  constructor(message = 'Não consegui falar com o banco agora.') {
    super(message, 502);
  }
}
export class ForbiddenError extends AppError {
  constructor(message = 'Você não tem permissão pra isso.') {
    super(message, 403);
  }
}
export class ConflictError extends AppError {
  constructor(message = 'Isso já está em uso.') {
    super(message, 409);
  }
}

/** LGPD: sem o aceite explícito do aviso de IA, nenhuma descrição/saldo sai do Tostão pro provedor de IA. */
export class AiConsentRequiredError extends AppError {
  constructor() {
    super(
      'Pra usar a IA do Tostão, aceite antes o aviso de uso de IA e da Política de Privacidade.',
      403,
      'AI_CONSENT_REQUIRED',
    );
  }
}

/** Refresh token inexistente, vencido, revogado ou reusado. 401 = a web limpa a sessão e manda pro login. */
export class InvalidRefreshTokenError extends AppError {
  constructor() {
    super('Sessão expirada. Entra de novo.', 401);
  }
}
export class InvalidVerificationTokenError extends AppError {
  constructor() {
    super('Esse link expirou ou já foi usado. Pede um novo.', 400);
  }
}
export class RateLimitedError extends AppError {
  constructor(message = 'Muitas tentativas. Espera um pouco e tenta de novo.') {
    super(message, 429);
  }
}
