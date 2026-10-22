const bcrypt = require('bcrypt');
const prisma = require('../../lib/prisma');
const ApiError = require('../../utils/ApiError');
const { scopeOf } = require('../../middlewares/authorize');
const { EMPLOYEE_EDITABLE_FIELDS } = require('../../config/permissions');

const include = {
  department: true,
  manager: { select: { id: true, firstName: true, lastName: true } },
  user: { select: { id: true, email: true, isActive: true, role: { select: { id: true, name: true } } } },
};

// Row-level filter: which employees this user may see
function visibleWhere(user) {
  switch (scopeOf(user, 'employee:read')) {
    case 'all': return {};
    case 'team': return { OR: [{ id: user.employeeId }, { managerId: user.employeeId }] };
    case 'own': return { id: user.employeeId };
    default: throw ApiError.forbidden();
  }
}

async function list(user, { q, departmentId, status, page, pageSize }) {
  const where = {
    AND: [
      visibleWhere(user),
      departmentId ? { departmentId } : {},
      status ? { status } : {},
      q ? {
        OR: ['firstName', 'lastName', 'employeeCode', 'jobTitle'].map((f) => ({ [f]: { contains: q, mode: 'insensitive' } })),
      } : {},
    ],
  };
  const [items, total] = await prisma.$transaction([
    prisma.employee.findMany({ where, include, orderBy: { id: 'asc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.employee.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

// Returns 404 (not 403) for records outside the user's scope, so existence isn't leaked
async function getVisible(user, id) {
  const employee = await prisma.employee.findFirst({ where: { AND: [{ id }, visibleWhere(user)] }, include });
  if (!employee) throw ApiError.notFound('Employee not found');
  return employee;
}

async function assertValidManager(employeeId, managerId) {
  if (managerId == null) return;
  if (managerId === employeeId) throw ApiError.badRequest('An employee cannot be their own manager');
  const manager = await prisma.employee.findUnique({ where: { id: managerId } });
  if (!manager || manager.status !== 'ACTIVE') throw ApiError.badRequest('Manager must be an active employee');
  // Walk up the chain to prevent reporting cycles (A -> B -> A)
  let cursor = manager;
  while (employeeId && cursor?.managerId) {
    if (cursor.managerId === employeeId) throw ApiError.badRequest('This assignment would create a reporting cycle');
    cursor = await prisma.employee.findUnique({ where: { id: cursor.managerId } });
  }
}

async function create(data) {
  const { email, password, roleId, departmentId, managerId, ...emp } = data;
  await assertValidManager(null, managerId);
  if (!(await prisma.role.findUnique({ where: { id: roleId } }))) throw ApiError.badRequest('Role does not exist');
  if (!(await prisma.department.findUnique({ where: { id: departmentId } }))) throw ApiError.badRequest('Department does not exist');
  const passwordHash = await bcrypt.hash(password, 10);

  return prisma.$transaction(async (tx) => {
    const last = await tx.employee.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
    return tx.employee.create({
      data: {
        ...emp,
        employeeCode: `EMP${String((last?.id ?? 0) + 1).padStart(4, '0')}`,
        department: { connect: { id: departmentId } },
        ...(managerId && { manager: { connect: { id: managerId } } }),
        user: { create: { email: email.toLowerCase(), passwordHash, role: { connect: { id: roleId } } } },
      },
      include,
    });
  });
}

// Field-level authorization: the editable fields depend on the relationship to the record
function editableFields(user, target) {
  const scope = scopeOf(user, 'employee:update');
  if (scope === 'all') return EMPLOYEE_EDITABLE_FIELDS.all;
  const perms = user.permissions;
  if (target.id === user.employeeId && perms.includes('employee:update:own')) return EMPLOYEE_EDITABLE_FIELDS.own;
  if (target.managerId === user.employeeId && perms.includes('employee:update:team')) return EMPLOYEE_EDITABLE_FIELDS.team;
  return [];
}

async function update(user, id, data) {
  const target = await getVisible(user, id);
  const allowed = editableFields(user, target);
  const denied = Object.keys(data).filter((f) => !allowed.includes(f));
  if (!allowed.length) throw ApiError.forbidden('You cannot edit this employee');
  if (denied.length) throw ApiError.forbidden(`You are not allowed to change: ${denied.join(', ')}`);

  if ('managerId' in data) await assertValidManager(id, data.managerId);
  if (data.status === 'INACTIVE' && id === user.employeeId) throw ApiError.badRequest('You cannot deactivate yourself');

  return prisma.$transaction(async (tx) => {
    if (data.status) {
      await tx.user.update({
        where: { id: target.user.id },
        data: { isActive: data.status === 'ACTIVE', tokenVersion: { increment: 1 } },
      });
    }
    return tx.employee.update({ where: { id }, data, include });
  });
}

async function deactivate(user, id) {
  if (id === user.employeeId) throw ApiError.badRequest('You cannot deactivate yourself');
  const target = await prisma.employee.findUnique({ where: { id } });
  if (!target) throw ApiError.notFound('Employee not found');
  return prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: target.userId }, data: { isActive: false, tokenVersion: { increment: 1 } } });
    return tx.employee.update({ where: { id }, data: { status: 'INACTIVE' }, include });
  });
}

module.exports = { list, getVisible, create, update, deactivate, editableFields };
