// Erros de negócio. O controller não precisa saber de regra:
// ele só traduz cada erro pro status HTTP certo (ver http/error-handler.ts).
export class AppError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = new.target.name;
  }
}
export class EmailAlreadyInUseError extends AppError {
  constructor() { super('Esse e-mail já tem conta. Tenta entrar.', 409); }
}
export class InvalidCredentialsError extends AppError {
  constructor() { super('E-mail ou senha não batem.', 401); }
}
export class ResourceNotFoundError extends AppError {
  constructor(what = 'Recurso') { super(`${what} não encontrado.`, 404); }
}
export class BankConnectionError extends AppError {
  constructor(message = 'Não consegui falar com o banco agora.') { super(message, 502); }
}
