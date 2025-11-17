import type { FastifyInstance } from 'fastify';
import { createBlock } from 'src/api/controllers/block.controller';

export async function blockRoutes(fastify: FastifyInstance) {
  fastify.post('/blocks', createBlock);
}

