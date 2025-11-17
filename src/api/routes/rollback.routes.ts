import type { FastifyInstance } from 'fastify';
import { rollback } from '../controllers/rollback.controller';

export async function rollbackRoutes(fastify: FastifyInstance) {
  fastify.post('/rollback', rollback);
}

