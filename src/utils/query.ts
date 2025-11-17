/**
 * Query parameter parsing utilities
 */

import type { FastifyRequest } from "fastify";
import { parse } from "querystring";
import { ValidationError } from "src/utils/errors";

/**
 * Parse query parameter from request URL
 * Handles both Fastify's parsed query and manual parsing from URL
 */
export function getQueryParam(
  request: FastifyRequest,
  paramName: string
): string | null {
  const query = request.query as any;
  if (query && query[paramName]) {
    return String(query[paramName]);
  }

  // Fallback: parse from URL string
  const urlParts = request.url.split("?");
  if (urlParts.length > 1) {
    const queryString = urlParts[1];
    const queryParams = parse(queryString);
    const value = queryParams[paramName];
    return value ? String(value) : null;
  }

  return null;
}

/**
 * Get required query parameter, throws ValidationError if missing
 */
export function getRequiredQueryParam(
  request: FastifyRequest,
  paramName: string,
  errorMessage?: string
): string {
  const value = getQueryParam(request, paramName);
  if (!value || value === "") {
    throw new ValidationError(
      errorMessage || `${paramName} query parameter is required`
    );
  }
  return value;
}

/**
 * Parse integer from query parameter
 */
export function getIntQueryParam(
  request: FastifyRequest,
  paramName: string,
  defaultValue?: number
): number | null {
  const value = getQueryParam(request, paramName);
  if (!value) {
    return defaultValue ?? null;
  }

  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Get required integer query parameter
 */
export function getRequiredIntQueryParam(
  request: FastifyRequest,
  paramName: string,
  errorMessage?: string
): number {
  const value = getIntQueryParam(request, paramName);
  if (value === null) {
    throw new ValidationError(
      errorMessage || `${paramName} must be a valid integer`
    );
  }
  return value;
}
