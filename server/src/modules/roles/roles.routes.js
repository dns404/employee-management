const router = require('express').Router();
const Joi = require('joi');
const prisma = require('../../lib/prisma');
const validate = require('../../middlewares/validate');
const { authorize } = require('../../middlewares/authorize');
const ApiError = require('../../utils/ApiError');
const { PERMISSIONS } = require('../../config/permissions');

const id = Joi.object({ id: Joi.number().integer().positive().required() });
const permissionKeys = Joi.array().items(Joi.string().valid(...Object.keys(PERMISSIONS))).unique();
const createBody = Joi.object({
  name: Joi.string().trim().min(2).max(40).required(),
  description: Joi.string().trim().max(200).allow(''),
  permissions: permissionKeys.required(),
});
const updateBody = Joi.object({
  name: Joi.string().trim().min(2).max(40),
  description: Joi.string().trim().max(200).allow(''),
  permissions: permissionKeys,
}).min(1);

const toDto = (role) => ({
  id: role.id,
  name: role.name,
  description: role.description,
  isSystem: role.isSystem,
  userCount: role._count.users,
  permissions: role.permissions.map((rp) => rp.permission.key),
});
const include = { permissions: { include: { permission: true } }, _count: { select: { users: true } } };

const permissionLinks = async (keys) => {
  const perms = await prisma.permission.findMany({ where: { key: { in: keys } } });
  return perms.map((p) => ({ permissionId: p.id }));
};

async function editableRole(roleId) {
  const role = await prisma.role.findUnique({ where: { id: roleId }, include });
  if (!role) throw ApiError.notFound('Role not found');
  if (role.isSystem) throw ApiError.forbidden('System roles cannot be modified');
  return role;
}

router.get('/', authorize('role:manage', 'user:manage'), async (req, res) => {
  const roles = await prisma.role.findMany({ include, orderBy: { id: 'asc' } });
  res.json(roles.map(toDto));
});

router.get('/permissions', authorize('role:manage'), async (req, res) => {
  res.json(await prisma.permission.findMany({ orderBy: { key: 'asc' } }));
});

router.post('/', authorize('role:manage'), validate({ body: createBody }), async (req, res) => {
  const { permissions, ...data } = req.valid.body;
  const role = await prisma.role.create({
    data: { ...data, permissions: { create: await permissionLinks(permissions) } },
    include,
  });
  res.status(201).json(toDto(role));
});

router.put('/:id', authorize('role:manage'), validate({ params: id, body: updateBody }), async (req, res) => {
  const role = await editableRole(req.valid.params.id);
  const { permissions, ...data } = req.valid.body;
  const updated = await prisma.$transaction(async (tx) => {
    if (permissions) {
      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      await tx.rolePermission.createMany({ data: (await permissionLinks(permissions)).map((p) => ({ ...p, roleId: role.id })) });
    }
    return tx.role.update({ where: { id: role.id }, data, include });
  });
  res.json(toDto(updated));
});

router.delete('/:id', authorize('role:manage'), validate({ params: id }), async (req, res) => {
  const role = await editableRole(req.valid.params.id);
  if (role._count.users) throw ApiError.conflict('Role is assigned to users; reassign them first');
  await prisma.role.delete({ where: { id: role.id } });
  res.status(204).end();
});

module.exports = router;
