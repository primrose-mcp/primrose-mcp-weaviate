/**
 * Pagination Utilities
 *
 * Helpers for handling pagination in Weaviate API.
 */

import type { PaginatedResponse, PaginationParams } from '../types/entities.js';

/**
 * Default pagination settings
 */
export const PAGINATION_DEFAULTS = {
  limit: 20,
  maxLimit: 100,
} as const;

/**
 * Normalize pagination parameters
 */
export function normalizePaginationParams(
  params?: PaginationParams,
  maxLimit = PAGINATION_DEFAULTS.maxLimit
): Required<Pick<PaginationParams, 'limit'>> & Omit<PaginationParams, 'limit'> {
  return {
    limit: Math.min(params?.limit || PAGINATION_DEFAULTS.limit, maxLimit),
    cursor: params?.cursor,
    offset: params?.offset,
  };
}

/**
 * Create an empty paginated response
 */
export function emptyPaginatedResponse<T>(): PaginatedResponse<T> {
  return {
    items: [],
    count: 0,
    hasMore: false,
  };
}

/**
 * Create a paginated response from an array
 */
export function createPaginatedResponse<T>(
  items: T[],
  options: {
    total?: number;
    hasMore?: boolean;
    nextCursor?: string;
  } = {}
): PaginatedResponse<T> {
  return {
    items,
    count: items.length,
    total: options.total,
    hasMore: options.hasMore ?? false,
    nextCursor: options.nextCursor,
  };
}

/**
 * Calculate if there are more items based on offset pagination
 */
export function hasMoreItems(offset: number, limit: number, total: number): boolean {
  return offset + limit < total;
}

/**
 * Calculate next offset for offset-based pagination
 */
export function getNextOffset(
  currentOffset: number,
  limit: number,
  total: number
): number | undefined {
  const next = currentOffset + limit;
  return next < total ? next : undefined;
}
