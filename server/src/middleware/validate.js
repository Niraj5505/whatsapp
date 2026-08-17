const { sendError } = require('../utils/response');

const validate = (schema) => (req, res, next) => {
  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    next();
  } catch (error) {
    const errorDetails = error.errors?.map((err) => ({
      field: err.path.join('.').replace(/^body\.|^query\.|^params\./, ''),
      message: err.message,
    })) || [{ message: error.message }];

    return sendError(res, 'Validation Error', 400, errorDetails);
  }
};

module.exports = validate;
