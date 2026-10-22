const ApiError = require('../utils/ApiError');

// validate({ body, query, params }) - Joi schemas. Unknown fields are rejected (blocks mass assignment).
// Sanitised values are exposed on req.valid so handlers never read raw input.
const validate = (schemas) => (req, res, next) => {
  req.valid = {};
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const { value, error } = schemas[part].validate(req[part] ?? {}, { abortEarly: false, convert: true });
    if (error) {
      throw ApiError.badRequest(
        'Validation failed',
        error.details.map((d) => ({ field: d.path.join('.'), message: d.message.replace(/"/g, '') })),
      );
    }
    req.valid[part] = value;
  }
  next();
};

module.exports = validate;
