const HttpError = require('../utils/HttpError');

// Validates req.body against a zod schema and replaces it with the parsed value.
const validate = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    const first = result.error.issues[0];
    throw new HttpError(400, `${first.path.join('.') || 'body'}: ${first.message}`);
  }
  req.body = result.data;
  next();
};

module.exports = validate;
