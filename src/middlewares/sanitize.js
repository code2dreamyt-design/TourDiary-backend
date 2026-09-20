// Custom NoSQL-injection sanitizer for req.body.
// express-mongo-sanitize (2.2.0) is Express 4-only — it tries to reassign
// req.query, which Express 5 made a read-only getter, and crashes every request.
// Our actual attack surface is entirely req.body (no route reads req.query),
// and req.body is still a plain writable property in Express 5, so sanitizing
// it directly here avoids the incompatible package entirely.
const sanitizeValue = (value) => {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value !== null && typeof value === "object") return sanitizeObject(value);
  return value;
};

const sanitizeObject = (obj) => {
  const clean = {};
  for (const key of Object.keys(obj)) {
    if (key.startsWith("$") || key.includes(".")) continue; // drop dangerous keys entirely
    clean[key] = sanitizeValue(obj[key]);
  }
  return clean;
};

export const sanitizeBody = (req, res, next) => {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body);
  }
  next();
};
