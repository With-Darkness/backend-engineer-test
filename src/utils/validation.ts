/**
 * Validation utilities
 */

import { ValidationError } from 'src/utils/errors';

/**
 * Validate that a value is not empty
 */
export function validateRequired(
  value: any,
  fieldName: string
): void {
  if (value === undefined || value === null || value === '') {
    throw new ValidationError(`${fieldName} is required`);
  }
}

/**
 * Validate that a number is non-negative
 */
export function validateNonNegative(
  value: number,
  fieldName: string
): void {
  if (isNaN(value) || value < 0) {
    throw new ValidationError(
      `${fieldName} must be a non-negative integer`
    );
  }
}

/**
 * Validate integer
 */
export function validateInteger(
  value: any,
  fieldName: string
): number {
  const parsed = parseInt(String(value), 10);
  if (isNaN(parsed)) {
    throw new ValidationError(
      `${fieldName} must be a valid integer`
    );
  }
  return parsed;
}

/**
 * Validate integer and non-negative
 */
export function validateNonNegativeInteger(
  value: any,
  fieldName: string
): number {
  const parsed = validateInteger(value, fieldName);
  validateNonNegative(parsed, fieldName);
  return parsed;
}

