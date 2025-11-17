import type { FastifyRequest, FastifyReply } from "fastify";
import type { Block } from "src/types/block.types";
import { getPool } from "src/db/index";
import { processBlock } from "src/services/block.service";
import { sendSuccess } from "src/utils/response";
import { asyncHandler } from "src/middleware/error-handler";

export const createBlock = asyncHandler(
  async (request: FastifyRequest<{ Body: Block }>, reply: FastifyReply) => {
    const block = request.body;
    const pool = getPool();

    await processBlock(pool, block);

    sendSuccess(reply, { message: "Block processed successfully" });
  }
);
