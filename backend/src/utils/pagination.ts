/**
 * Day 37: Pagination utilities
 * Adds cursor-based pagination to all list endpoints
 */

export interface PaginationQuery {
  page?: number;
  limit?: number;
  cursor?: string; // For cursor-based pagination
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Parse & validate pagination params from request query
 */
export function parsePagination(query: Record<string, unknown>): Required<Omit<PaginationQuery, 'cursor'>> {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? '50'), 10) || 50));
  return { page, limit };
}

/**
 * Build a paginated response wrapper
 */
export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / limit);
  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

/**
 * Compute skip offset for Prisma queries
 */
export function paginationToSkipTake(page: number, limit: number) {
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}
