import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Block } from '../../types/block.types';
import { getPool } from '../../db/index';
import { processBlock, BlockValidationError } from '../../services/block.service';

export async function createBlock(
  request: FastifyRequest<{ Body: Block }>,
  reply: FastifyReply
) {
  try {
    const block = request.body;
    const pool = getPool();

    await processBlock(pool, block);

    return reply.status(200).send({ message: 'Block processed successfully' });
  } catch (error) {
    if (error instanceof BlockValidationError) {
      return reply.status(error.statusCode).send({ error: error.message });
    }
    
    // Log unexpected errors
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error' });
  }
}

