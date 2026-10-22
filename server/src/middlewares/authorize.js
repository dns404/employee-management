const ApiError = require('../utils/ApiError');

const SCOPES = ['all', 'team', 'own'];

// True if the user holds `base` exactly or any scoped variant of it (e.g. leave:read -> leave:read:team)
const hasPermission = (user, base) => user.permissions.some((p) => p === base || p.startsWith(`${base}:`));

// Broadest scope the user holds for an action: 'all' | 'team' | 'own' | null
const scopeOf = (user, base) => SCOPES.find((s) => user.permissions.includes(`${base}:${s}`)) || null;

// Route guard: user must hold at least one of the given permissions (scoped variants count).
// Record-level checks (which rows) happen in the service layer using scopeOf().
const authorize = (...bases) => (req, res, next) => {
  if (!req.user) throw ApiError.unauthorized();
  if (!bases.some((b) => hasPermission(req.user, b))) throw ApiError.forbidden();
  next();
};

module.exports = { authorize, hasPermission, scopeOf };
