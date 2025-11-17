import type { FastifyInstance } from 'fastify';
import { getAddressBalance } from 'src/api/controllers/balance.controller';

export async function balanceRoutes(fastify: FastifyInstance) {
  fastify.get('/balance/:address', getAddressBalance);
}

