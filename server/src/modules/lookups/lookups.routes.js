const router = require('express').Router();
const prisma = require('../../lib/prisma');
const { authorize } = require('../../middlewares/authorize');
const { eligibleManagerWhere } = require('../employees/employees.service');

// Reference data for dropdowns (any authenticated user)
router.get('/', async (req, res) => {
  const [departments, leaveTypes] = await prisma.$transaction([
    prisma.department.findMany({ orderBy: { name: 'asc' } }),
    prisma.leaveType.findMany({ orderBy: { id: 'asc' } }),
  ]);
  res.json({ departments, leaveTypes });
});

// Manager picker - only for users who can assign managers; lists only people allowed to have reports
router.get('/managers', authorize('employee:create', 'employee:update:all'), async (req, res) => {
  const managers = await prisma.employee.findMany({
    where: eligibleManagerWhere,
    select: { id: true, firstName: true, lastName: true, jobTitle: true },
    orderBy: { firstName: 'asc' },
  });
  res.json(managers);
});

module.exports = router;
