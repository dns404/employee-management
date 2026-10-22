const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../../lib/prisma');
const env = require('../../config/env');
const ApiError = require('../../utils/ApiError');

const signAccess = (user) => jwt.sign({ sub: user.id, role: user.role.name }, env.jwt.accessSecret, { expiresIn: env.jwt.accessTtl });
const signRefresh = (user) => jwt.sign({ sub: user.id, tv: user.tokenVersion }, env.jwt.refreshSecret, { expiresIn: env.jwt.refreshTtl });

const userInclude = {
  role: { include: { permissions: { include: { permission: true } } } },
  employee: { include: { department: true, manager: { select: { id: true, firstName: true, lastName: true } } } },
};

const toProfile = (user) => ({
  id: user.id,
  email: user.email,
  role: user.role.name,
  permissions: user.role.permissions.map((rp) => rp.permission.key),
  employee: user.employee && {
    id: user.employee.id,
    employeeCode: user.employee.employeeCode,
    name: `${user.employee.firstName} ${user.employee.lastName}`,
    jobTitle: user.employee.jobTitle,
    department: user.employee.department.name,
    manager: user.employee.manager && `${user.employee.manager.firstName} ${user.employee.manager.lastName}`,
  },
});

async function login(email, password) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, include: userInclude });
  // Same message for unknown user / wrong password / inactive, to avoid account enumeration
  const ok = user && user.isActive && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw ApiError.unauthorized('Invalid email or password');
  return { accessToken: signAccess(user), refreshToken: signRefresh(user), user: toProfile(user) };
}

async function refresh(token) {
  if (!token) throw ApiError.unauthorized('No refresh token');
  let payload;
  try {
    payload = jwt.verify(token, env.jwt.refreshSecret);
  } catch {
    throw ApiError.unauthorized('Invalid refresh token');
  }
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, include: userInclude });
  if (!user || !user.isActive || user.tokenVersion !== payload.tv) throw ApiError.unauthorized('Session expired');
  return { accessToken: signAccess(user), refreshToken: signRefresh(user), user: toProfile(user) };
}

// Invalidates every refresh token issued to this user
async function logout(token) {
  try {
    const { sub } = jwt.verify(token, env.jwt.refreshSecret);
    await prisma.user.update({ where: { id: sub }, data: { tokenVersion: { increment: 1 } } });
  } catch {
    // already invalid - nothing to revoke
  }
}

async function me(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: userInclude });
  return toProfile(user);
}

module.exports = { login, refresh, logout, me };
