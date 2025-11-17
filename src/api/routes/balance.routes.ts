import type { FastifyInstance } from 'fastify';
import { getAddressBalance } from '../controllers/balance.controller';

export async function balanceRoutes(fastify: FastifyInstance) {
  fastify.get('/balance/:address', getAddressBalance);
}

