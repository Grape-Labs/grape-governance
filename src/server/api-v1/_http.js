const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 200;

function safeString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

export function getQueryValue(req, key, fallback = undefined) {
  const value = req?.query?.[key];
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

export function getPathParam(req, key, fallback = undefined) {
  const value = req?.query?.[key];
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

export function parseBody(req) {
  if (typeof req?.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req?.body && typeof req.body === 'object' ? req.body : {};
}

export function parseBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return fallback;
}

export function toNumber(value, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    if (/^0x/i.test(trimmed)) {
      const parsedHex = Number.parseInt(trimmed, 16);
      return Number.isFinite(parsedHex) ? parsedHex : fallback;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseLimit(value, fallback = DEFAULT_LIMIT) {
  const parsed = Math.trunc(toNumber(value, fallback));
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed <= 0) return fallback;
  return Math.min(parsed, MAX_LIMIT);
}

export function splitCsv(value) {
  return safeString(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function uniqueStrings(values) {
  const output = [];
  const seen = new Set();
  for (const value of values || []) {
    const normalized = safeString(value).trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
  }
  return output;
}

export function decodeCursor(cursor) {
  if (!cursor) return { offset: 0 };
  try {
    const json = Buffer.from(String(cursor), 'base64url').toString('utf8');
    const parsed = JSON.parse(json);
    const offset = Math.max(0, Math.trunc(toNumber(parsed?.offset, 0)));
    return { offset };
  } catch {
    return { offset: 0 };
  }
}

export function encodeCursor(offset) {
  const safeOffset = Math.max(0, Math.trunc(toNumber(offset, 0)));
  return Buffer.from(JSON.stringify({ offset: safeOffset }), 'utf8').toString('base64url');
}

export function paginateArray(values, { offset = 0, limit = DEFAULT_LIMIT } = {}) {
  const safeOffset = Math.max(0, Math.trunc(toNumber(offset, 0)));
  const safeLimit = parseLimit(limit, DEFAULT_LIMIT);
  const data = Array.isArray(values) ? values.slice(safeOffset, safeOffset + safeLimit) : [];
  const nextOffset = safeOffset + data.length;
  const hasMore = Array.isArray(values) ? nextOffset < values.length : false;
  return {
    data,
    nextCursor: hasMore ? encodeCursor(nextOffset) : null,
    hasMore,
  };
}

export function toUnixSeconds(value) {
  const n = toNumber(value, 0);
  return Math.max(0, Math.trunc(n));
}

function randomRequestId() {
  const part = Math.random().toString(36).slice(2, 10);
  return `req_${part}`;
}

export function getRequestId(req) {
  const header = req?.headers?.['x-request-id'];
  if (Array.isArray(header)) return safeString(header[0], randomRequestId());
  return safeString(header, randomRequestId());
}

export function sendJson(res, statusCode, payload) {
  res.status(statusCode).json(payload);
}

export function sendError(res, req, statusCode, code, message, details = undefined) {
  const requestId = getRequestId(req);
  const error = {
    error: {
      code,
      message,
      request_id: requestId,
    },
  };
  if (details !== undefined) {
    error.error.details = details;
  }
  sendJson(res, statusCode, error);
}

export function sendMethodNotAllowed(res, req) {
  return sendError(res, req, 405, 'INVALID_ARGUMENT', 'Method not allowed');
}

export function parseSort(req, fallbackField = 'draft_at', fallbackOrder = 'desc') {
  const sortBy = String(getQueryValue(req, 'sort_by', fallbackField) || fallbackField);
  const rawOrder = String(getQueryValue(req, 'sort_order', fallbackOrder) || fallbackOrder).toLowerCase();
  const sortOrder = rawOrder === 'asc' ? 'asc' : 'desc';
  return { sortBy, sortOrder };
}

export function sortByField(values, field, order = 'desc') {
  const safeValues = Array.isArray(values) ? [...values] : [];
  const direction = order === 'asc' ? 1 : -1;
  safeValues.sort((a, b) => {
    const av = a?.[field];
    const bv = b?.[field];
    if (av === bv) return 0;
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * direction;
    return String(av).localeCompare(String(bv)) * direction;
  });
  return safeValues;
}
