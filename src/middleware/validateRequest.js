const Joi = require('joi');

/**
 * Middleware to validate request data using a Joi schema.
 * Validates req.body by default.
 * On validation error, responds with status 400 and error details.
 * On success, places validated value in req.validated.
 */
function validate(schema) {
  return (req, res, next) => {
    const data = req.body;

    const { error, value } = schema.validate(data, { abortEarly: false, stripUnknown: true });

    if (error) {
      const details = error.details.map(d => d.message);
      return res.status(400).json({ error: 'Validation failed', details });
    }

    req.validated = value;
    next();
  };
}

module.exports = validate;
