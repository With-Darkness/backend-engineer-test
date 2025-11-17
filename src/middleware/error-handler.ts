/**
 * Error handling middleware for Fastify
 */

import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { AppError, ValidationError } from 'src/utils/errors';
import { sendError } from 'src/utils/response';

/**
 * Global error handler middleware
 */
export async function errorHandler(
  error: FastifyError | AppError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Log the error
  request.log.error({ err: error }, 'Request error');

  // Handle known application errors
  if (error instanceof AppError) {
    sendError(reply, error);
    return;
  }

  // Handle Fastify validation errors
  if (error.validation) {
    sendError(
      reply,
      new ValidationError(
        error.message || 'Validation error',
        'VALIDATION_ERROR'
      )
    );
    return;
  }

  // Handle unknown errors
  sendError(reply, error);
}

/**
 * Async handler wrapper to catch errors and pass to error handler
 */
export function asyncHandler<T extends FastifyRequest = FastifyRequest>(
  handler: (request: T, reply: FastifyReply) => Promise<void>
) {
  return async (request: T, reply: FastifyReply): Promise<void> => {
    try {
      await handler(request, reply);
    } catch (error) {
      await errorHandler(error as Error, request, reply);
    }
  };
}

