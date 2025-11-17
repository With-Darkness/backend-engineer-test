/**
 * Response helper utilities
 */

import type { FastifyReply } from "fastify";
import { AppError } from "src/utils/errors";

/**
 * Safely send a response, checking if headers are already sent
 */
export function sendResponse(
  reply: FastifyReply,
  statusCode: number,
  data: any
): void {
  if (reply.sent) {
    return;
  }

  try {
    reply.code(statusCode).send(data);
  } catch (error) {
    // Ignore errors if headers already sent
  }
}

/**
 * Send success response
 */
export function sendSuccess(
  reply: FastifyReply,
  data: any,
  statusCode: number = 200
): void {
  sendResponse(reply, statusCode, data);
}

/**
 * Send error response
 */
export function sendError(
  reply: FastifyReply,
  error: AppError | Error,
  defaultMessage: string = "Internal server error"
): void {
  if (reply.sent) {
    return;
  }

  try {
    if (error instanceof AppError) {
      sendResponse(reply, error.statusCode, {
        error: error.message,
        code: error.code,
      });
    } else {
      sendResponse(reply, 500, {
        error: defaultMessage,
        code: "INTERNAL_SERVER_ERROR",
      });
    }
  } catch (sendError) {
    // Ignore errors if headers already sent
  }
}

/**
 * Send validation error response
 */
export function sendValidationError(
  reply: FastifyReply,
  message: string,
  code?: string
): void {
  sendResponse(reply, 400, {
    error: message,
    code: code || "VALIDATION_ERROR",
  });
}
