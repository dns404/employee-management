const router = require('express').Router();
const Joi = require('joi');
const bcrypt = require('bcrypt');
const prisma = require('../../lib/prisma');
const validate = require('../../middlewares/validate');
const { authorize } = require('../../middlewares/authorize');
const ApiError = require('../../utils/ApiError');

const ADMIN_PERMISSION = 'user:manage';

const select = {
  id: true, email: true, isActive: true, createdAt: true,
  role: { select: { id: true, name: true } },
  employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
};

const listQuery = Joi.object({ q: Joi.string().trim().max(60).allow('') });
const updateBody = Joi.object({
  roleId: Joi.number().integer().positive(),
  isActive: Joi.boolean(),
  password: Joi.string().min(8).max(128).pattern(/(?=.*[A-Za-z])(?=.*\d)/)
    .messages({ 'string.pattern.base': 'password must contain letters and numbers' }),
}).min(1);

// Prevents locking everyone out: at least one active user must keep user-management rights
async function assertNotLastAdmin(userId) {
  const admins = await prisma.user.count({
    where: { isActive: true, id: { not: userId }, role: { permissions: { some: { permission: { key: ADMIN_PERMISSION } } } } },
  });
  if (!admins) throw ApiError.conflict('At least one active administrator must remain');
}

router.use(authorize('user:manage'));

router.get('/', validate({ query: listQuery }), async (req, res) => {
  const { q } = req.valid.query;
  const users = await prisma.user.findMany({
    where: q ? { email: { contains: q, mode: 'insensitive' } } : {},
    select,
    orderBy: { id: 'asc' },
  });
  res.json(users);
});

router.patch('/:id', validate({ params: Joi.object({ id: Joi.number().integer().positive().required() }), body: updateBody }), async (req, res) => {
  const { id } = req.valid.params;
  const { roleId, isActive, password } = req.valid.body;

  if (id === req.user.id && (roleId !== undefined || isActive === false)) {
    throw ApiError.badRequest('You cannot change your own role or deactivate yourself');
  }
  const target = await prisma.user.findUnique({
    where: { id },
    include: { employee: true, role: { include: { permissions: { include: { permission: true } } } } },
  });
  if (!target) throw ApiError.notFound('User not found');

  const targetIsAdmin = target.role.permissions.some((rp) => rp.permission.key === ADMIN_PERMISSION);
  if (targetIsAdmin && (isActive === false || roleId !== undefined)) await assertNotLastAdmin(id);
  if (roleId !== undefined && !(await prisma.role.findUnique({ where: { id: roleId } }))) throw ApiError.badRequest('Role does not exist');

  const user = await prisma.$transaction(async (tx) => {
    if (isActive !== undefined && target.employee) {
      await tx.employee.update({ where: { userId: id }, data: { status: isActive ? 'ACTIVE' : 'INACTIVE' } });
    }
    return tx.user.update({
      where: { id },
      data: {
        roleId,
        isActive,
        ...(password && { passwordHash: await bcrypt.hash(password, 10) }),
        tokenVersion: { increment: 1 }, // force re-login with the new rights
      },
      select,
    });
  });
  res.json(user);
});

module.exports = router;
