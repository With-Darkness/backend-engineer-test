import type { FastifyRequest, FastifyReply } from "fastify";
import { getPool } from "src/db/index";
import { rollbackToHeight } from "src/services/rollback.service";
import { sendSuccess } from "src/utils/response";
import { getRequiredIntQueryParam } from "src/utils/query";
import { validateNonNegativeInteger } from "src/utils/validation";
import { asyncHandler } from "src/middleware/error-handler";

export const rollback = asyncHandler(
  async (request: FastifyRequest, reply: FastifyReply) => {
    const heightParam = getRequiredIntQueryParam(
      request,
      "height",
      "Height query parameter is required"
    );

    const targetHeight = validateNonNegativeInteger(heightParam, "Height");

    const pool = getPool();
    await rollbackToHeight(pool, targetHeight);

    sendSuccess(reply, {
      message: `Rollback to height ${targetHeight} completed successfully`,
    });
  }
);
