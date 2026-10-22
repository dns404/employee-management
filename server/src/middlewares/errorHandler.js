const { Prisma } = require('@prisma/client');

const notFound = (req, res) => res.status(404).json({ error: { message: `Route ${req.method} ${req.path} not found` } });

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message;
  let details = err.details;

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') { status = 409; message = `Duplicate value for ${err.meta?.target}`; }
    else if (err.code === 'P2025') { status = 404; message = 'Resource not found'; }
    else if (err.code === 'P2003') { status = 400; message = 'Referenced record does not exist'; }
  } else if (/leave_no_overlap/.test(err.message)) {
    status = 409; message = 'Leave request overlaps an existing pending or approved request';
  } else if (err.type === 'entity.parse.failed') {
    status = 400; message = 'Malformed JSON body';
  }

  if (status >= 500) {
    console.error(err);
    message = 'Internal server error'; // never leak internals
    details = undefined;
  }

  res.status(status).json({ error: { message, ...(details && { details }) } });
}

module.exports = { errorHandler, notFound };
