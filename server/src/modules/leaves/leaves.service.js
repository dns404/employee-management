const prisma = require('../../lib/prisma');
const ApiError = require('../../utils/ApiError');
const { scopeOf } = require('../../middlewares/authorize');

const include = {
  leaveType: true,
  employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, managerId: true, userId: true } },
};

const historyInclude = {
  history: {
    orderBy: { createdAt: 'asc' },
    include: { actor: { select: { email: true, employee: { select: { firstName: true, lastName: true } } } } },
  },
};

function visibleWhere(user) {
  switch (scopeOf(user, 'leave:read')) {
    case 'all': return {};
    case 'team': return { OR: [{ employeeId: user.employeeId }, { employee: { managerId: user.employeeId } }] };
    case 'own': return { employeeId: user.employeeId };
    default: throw ApiError.forbidden();
  }
}

// view: mine = own requests, team = requests the user can act on as a reviewer
function viewWhere(user, view) {
  if (view === 'mine') return { employeeId: user.employeeId };
  if (view === 'team') {
    const scope = scopeOf(user, 'leave:read');
    if (scope === 'all') return {};
    if (scope === 'team') return { employee: { managerId: user.employeeId } };
    throw ApiError.forbidden();
  }
  return {};
}

async function list(user, { view, status, page, pageSize }) {
  const where = { AND: [visibleWhere(user), viewWhere(user, view), status ? { status } : {}] };
  const [items, total] = await prisma.$transaction([
    prisma.leaveRequest.findMany({ where, include, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.leaveRequest.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

async function get(user, id) {
  const leave = await prisma.leaveRequest.findFirst({
    where: { AND: [{ id }, visibleWhere(user)] },
    include: { ...include, ...historyInclude },
  });
  if (!leave) throw ApiError.notFound('Leave request not found');
  return leave;
}

const todayUtc = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

// Working days (Mon-Fri) in an inclusive date range
function workingDays(start, end) {
  let count = 0;
  for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

async function create(user, { leaveTypeId, startDate, endDate, reason }) {
  if (!user.employeeId) throw ApiError.badRequest('Only employees can submit leave requests');
  if (startDate < todayUtc()) throw ApiError.badRequest('Start date cannot be in the past');
  if (endDate < startDate) throw ApiError.badRequest('End date must be on or after start date');
  const days = workingDays(startDate, endDate);
  if (!days) throw ApiError.badRequest('The selected range contains no working days');

  // Friendly check; the DB exclusion constraint "leave_no_overlap" is the race-proof backstop
  const overlap = await prisma.leaveRequest.findFirst({
    where: {
      employeeId: user.employeeId,
      status: { in: ['PENDING', 'APPROVED'] },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
  });
  if (overlap) throw ApiError.conflict('Leave request overlaps an existing pending or approved request');

  return prisma.leaveRequest.create({
    data: {
      employeeId: user.employeeId, leaveTypeId, startDate, endDate, days, reason,
      history: { create: { toStatus: 'PENDING', actorUserId: user.id, comment: 'Submitted' } },
    },
    include,
  });
}

// Atomic status transition: only succeeds if the request is still PENDING (guards against double approval)
async function transition(leave, toStatus, actorUserId, comment) {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.leaveRequest.updateMany({ where: { id: leave.id, status: 'PENDING' }, data: { status: toStatus } });
    if (!count) throw ApiError.conflict(`Only pending requests can be ${toStatus.toLowerCase()}`);
    await tx.leaveRequestHistory.create({
      data: { leaveRequestId: leave.id, fromStatus: 'PENDING', toStatus, actorUserId, comment },
    });
    return tx.leaveRequest.findUnique({ where: { id: leave.id }, include: { ...include, ...historyInclude } });
  });
}

async function cancel(user, id, comment) {
  const leave = await get(user, id);
  if (leave.employeeId !== user.employeeId) throw ApiError.forbidden('You can only cancel your own leave requests');
  return transition(leave, 'CANCELLED', user.id, comment || 'Cancelled by employee');
}

async function decide(user, id, decision, comment) {
  const leave = await get(user, id);
  if (leave.employeeId === user.employeeId) throw ApiError.forbidden('You cannot approve or reject your own leave request');

  const scope = scopeOf(user, 'leave:approve');
  const allowed = scope === 'all' || (scope === 'team' && leave.employee.managerId === user.employeeId);
  if (!allowed) throw ApiError.forbidden('You can only review leave requests of your direct reports');

  return transition(leave, decision, user.id, comment);
}

module.exports = { list, get, create, cancel, decide, workingDays };
