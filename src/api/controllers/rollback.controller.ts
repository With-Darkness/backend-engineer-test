import type { FastifyRequest, FastifyReply } from 'fastify';
import { getPool } from '../../db/index';
import { rollbackToHeight, RollbackError } from '../../services/rollback.service';

export async function rollback(
  request: FastifyRequest<{ Querystring: { height?: string } }>,
  reply: FastifyReply
): Promise<void> {
  // Prevent errors from propagating to Fastify's error handler
  try {
    const heightParam = request.query.height;
    
    if (!heightParam) {
      if (!reply.sent) {
        try {
          reply.code(400).send({ error: 'Height query parameter is required' });
        } catch (sendError) {
          // Ignore errors from send() if headers already sent
        }
      }
      return;
    }

    const targetHeight = parseInt(heightParam, 10);
    
    if (isNaN(targetHeight) || targetHeight < 0) {
      if (!reply.sent) {
        try {
          reply.code(400).send({ error: 'Height must be a non-negative integer' });
        } catch (sendError) {
          // Ignore errors from send() if headers already sent
        }
      }
      return;
    }

    const pool = getPool();
    await rollbackToHeight(pool, targetHeight);

    if (!reply.sent) {
      try {
        reply.code(200).send({ message: `Rollback to height ${targetHeight} completed successfully` });
      } catch (sendError) {
        // Ignore errors from send() if headers already sent
      }
    }
  } catch (error) {
    // Only send response if not already sent
    if (reply.sent) {
      return;
    }

    try {
      if (error instanceof RollbackError) {
        reply.code(error.statusCode).send({ error: error.message });
        return;
      }
      
      // Log unexpected errors
      request.log.error({ err: error }, 'Unexpected error in rollback');
      reply.code(500).send({ error: 'Internal server error' });
    } catch (sendError) {
      // Ignore errors from send() if headers already sent
    }
  }
}

