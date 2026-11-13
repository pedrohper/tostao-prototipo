import type { FastifyInstance } from 'fastify';
import type { TaxasResponse } from '@tostao/contracts';
import type { RatesGateway } from '../../gateways/rates-gateway.js';
import { verifyJwt } from '../middlewares/verify-jwt.js';

// Taxas do Banco Central pro simulador de juros e pro "Onde investir"
export function investRoutes(app: FastifyInstance, rates: RatesGateway) {
  app.get('/rates', { onRequest: verifyJwt }, async () => (await rates.taxas()) satisfies TaxasResponse);
}
