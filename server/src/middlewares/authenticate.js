const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

// Verifies the access token, then loads the user + permissions fresh from the DB on every
// request so role changes and deactivation take effect immediately (not at token expiry).
async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw ApiError.unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, env.jwt.accessSecret);
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
      employee: { select: { id: true } },
    },
  });
  if (!user || !user.isActive) throw ApiError.unauthorized('Account is inactive');

  req.user = {
    id: user.id,
    email: user.email,
    role: user.role.name,
    employeeId: user.employee?.id ?? null,
    permissions: user.role.permissions.map((rp) => rp.permission.key),
  };
  next();
}

module.exports = authenticate;
