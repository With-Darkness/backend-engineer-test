import type { FastifyRequest, FastifyReply } from 'fastify';
import { getPool } from '../../db/index';
import { getBalance } from '../../services/balance.service';

export async function getAddressBalance(
  request: FastifyRequest<{ Params: { address: string } }>,
  reply: FastifyReply
): Promise<void> {
  // Prevent errors from propagating to Fastify's error handler
  try {
    const { address } = request.params;
    
    if (!address) {
      if (!reply.sent) {
        try {
          reply.code(400).send({ error: 'Address parameter is required' });
        } catch (sendError) {
          // Ignore errors from send() if headers already sent
        }
      }
      return;
    }

    const pool = getPool();
    const balance = await getBalance(pool, address);

    if (!reply.sent) {
      try {
        reply.code(200).send({ balance });
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
      // Log unexpected errors
      request.log.error({ err: error }, 'Unexpected error in getAddressBalance');
      reply.code(500).send({ error: 'Internal server error' });
    } catch (sendError) {
      // Ignore errors from send() if headers already sent
    }
  }
}

