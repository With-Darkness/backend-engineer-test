import type { FastifyRequest, FastifyReply } from 'fastify';
import { getPool } from 'src/db/index';
import { getBalance } from 'src/services/balance.service';
import { sendSuccess } from 'src/utils/response';
import { validateRequired } from 'src/utils/validation';
import { asyncHandler } from 'src/middleware/error-handler';

export const getAddressBalance = asyncHandler(
  async (request: FastifyRequest<{ Params: { address: string } }>, reply: FastifyReply) => {
    const { address } = request.params;
    
    validateRequired(address, 'Address parameter');

    const pool = getPool();
    const balance = await getBalance(pool, address);

    sendSuccess(reply, { balance });
  }
);

