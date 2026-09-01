/**
 * Pagination utilities for MongoDB queries.
 */

/**
 * Parse pagination params from request query.
 * @param {object} query - req.query
 * @param {object} defaults
 * @returns {object} { page, limit, skip, sort }
 */
const parsePagination = (query, defaults = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || defaults.page || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(query.limit, 10) || defaults.limit || 20)
  );
  const skip = (page - 1) * limit;

  // Parse sort (e.g., "-createdAt" or "name")
  let sort = {};
  if (query.sort) {
    const sortStr = query.sort;
    if (sortStr.startsWith("-")) {
      sort[sortStr.slice(1)] = -1;
    } else {
      sort[sortStr] = 1;
    }
  } else {
    sort = defaults.sort || { createdAt: -1 };
  }

  return { page, limit, skip, sort };
};

/**
 * Build pagination response object.
 * @param {number} total - Total documents matching filter
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {object}
 */
const buildPagination = (total, page, limit) => ({
  total,
  totalPages: Math.ceil(total / limit),
  currentPage: page,
  hasNextPage: page * limit < total,
  hasPrevPage: page > 1,
  nextPage: page * limit < total ? page + 1 : null,
  prevPage: page > 1 ? page - 1 : null,
});

/**
 * Cursor-based pagination helpers.
 * Use MongoDB _id for cursor-based pagination (more efficient for large datasets).
 */

/**
 * Build cursor query filter.
 * @param {string} cursor - The last item's _id from previous page
 * @param {"after"|"before"} direction
 * @returns {object} MongoDB filter addition
 */
const buildCursorFilter = (cursor, direction = "after") => {
  if (!cursor) return {};

  if (direction === "after") {
    return { _id: { $gt: cursor } };
  }
  return { _id: { $lt: cursor } };
};

/**
 * Build cursor-based pagination response.
 * @param {Array} docs - Fetched documents
 * @param {number} limit - Items per page
 * @returns {object}
 */
const buildCursorPagination = (docs, limit) => {
  const hasNextPage = docs.length > limit;
  const data = hasNextPage ? docs.slice(0, limit) : docs;

  return {
    data,
    pagination: {
      hasNextPage,
      nextCursor: hasNextPage ? data[data.length - 1]._id.toString() : null,
      count: data.length,
    },
  };
};

/**
 * Express middleware that attaches pagination helpers to req.
 */
const paginationMiddleware = (req, res, next) => {
  req.pagination = parsePagination(req.query);
  next();
};

module.exports = {
  parsePagination,
  buildPagination,
  buildCursorFilter,
  buildCursorPagination,
  paginationMiddleware,
};
