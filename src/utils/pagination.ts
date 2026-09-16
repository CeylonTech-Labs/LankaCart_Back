export type PaginationQuery = {
  page?: number;
  limit?: number;
};

export const getPagination = ({ page = 1, limit = 12 }: PaginationQuery) => {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 12, 1), 60);

  return {
    page: safePage,
    limit: safeLimit,
    skip: (safePage - 1) * safeLimit,
    take: safeLimit
  };
};

export const getPaginationMeta = (total: number, page: number, limit: number) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit)
});
