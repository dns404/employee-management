require('dotenv').config({ quiet: true });
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const { PERMISSIONS, ROLE_PERMISSIONS } = require('../src/config/permissions');

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'Password@123';

const addDays = (n) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
};

async function main() {
  // Idempotent: wipe and recreate demo data
  await prisma.$transaction([
    prisma.leaveRequestHistory.deleteMany(),
    prisma.leaveRequest.deleteMany(),
    prisma.employee.deleteMany(),
    prisma.user.deleteMany(),
    prisma.rolePermission.deleteMany(),
    prisma.role.deleteMany(),
    prisma.permission.deleteMany(),
    prisma.department.deleteMany(),
    prisma.leaveType.deleteMany(),
  ]);

  await prisma.permission.createMany({
    data: Object.entries(PERMISSIONS).map(([key, description]) => ({ key, description })),
  });
  const perms = await prisma.permission.findMany();
  const permId = Object.fromEntries(perms.map((p) => [p.key, p.id]));

  const roles = {};
  for (const [name, keys] of Object.entries(ROLE_PERMISSIONS)) {
    roles[name] = await prisma.role.create({
      data: {
        name,
        description: `${name} role`,
        isSystem: name === 'Administrator',
        permissions: { create: keys.map((k) => ({ permissionId: permId[k] })) },
      },
    });
  }

  const [eng, hr, sales] = await Promise.all(
    ['Engineering', 'Human Resources', 'Sales'].map((name) => prisma.department.create({ data: { name } })),
  );
  const [paid, sick] = await Promise.all(
    ['Paid', 'Sick', 'Unpaid'].map((name) => prisma.leaveType.create({ data: { name } })),
  );

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const people = [
    { key: 'admin', email: 'admin@ems.local', role: 'Administrator', firstName: 'Alice', lastName: 'Admin', jobTitle: 'HR Director', dept: hr },
    { key: 'mark', email: 'manager@ems.local', role: 'Manager', firstName: 'Mark', lastName: 'Manager', jobTitle: 'Engineering Manager', dept: eng, manager: 'admin' },
    { key: 'sara', email: 'sara@ems.local', role: 'Manager', firstName: 'Sara', lastName: 'Sales', jobTitle: 'Sales Manager', dept: sales, manager: 'admin' },
    { key: 'emma', email: 'employee@ems.local', role: 'Employee', firstName: 'Emma', lastName: 'Employee', jobTitle: 'Software Engineer', dept: eng, manager: 'mark' },
    { key: 'ethan', email: 'ethan@ems.local', role: 'Employee', firstName: 'Ethan', lastName: 'Evans', jobTitle: 'QA Engineer', dept: eng, manager: 'mark' },
    { key: 'sam', email: 'sam@ems.local', role: 'Employee', firstName: 'Sam', lastName: 'Seller', jobTitle: 'Account Executive', dept: sales, manager: 'sara' },
  ];

  const emp = {};
  for (const [i, p] of people.entries()) {
    emp[p.key] = await prisma.employee.create({
      data: {
        employeeCode: `EMP${String(i + 1).padStart(4, '0')}`,
        firstName: p.firstName,
        lastName: p.lastName,
        jobTitle: p.jobTitle,
        phone: `+1-555-010${i}`,
        hireDate: new Date('2023-01-15'),
        department: { connect: { id: p.dept.id } },
        manager: p.manager ? { connect: { id: emp[p.manager].id } } : undefined,
        user: { create: { email: p.email, passwordHash, roleId: roles[p.role].id } },
      },
    });
  }

  // Sample leave requests
  await prisma.leaveRequest.create({
    data: {
      employeeId: emp.emma.id, leaveTypeId: paid.id, startDate: addDays(30), endDate: addDays(32), days: 3,
      reason: 'Family trip',
      history: { create: { toStatus: 'PENDING', actorUserId: emp.emma.userId, comment: 'Submitted' } },
    },
  });
  await prisma.leaveRequest.create({
    data: {
      employeeId: emp.ethan.id, leaveTypeId: sick.id, startDate: addDays(5), endDate: addDays(5), days: 1,
      reason: 'Medical appointment', status: 'APPROVED',
      history: {
        create: [
          { toStatus: 'PENDING', actorUserId: emp.ethan.userId, comment: 'Submitted' },
          { fromStatus: 'PENDING', toStatus: 'APPROVED', actorUserId: emp.mark.userId, comment: 'Get well soon' },
        ],
      },
    },
  });
  await prisma.leaveRequest.create({
    data: {
      employeeId: emp.sam.id, leaveTypeId: paid.id, startDate: addDays(14), endDate: addDays(18), days: 5,
      reason: 'Vacation',
      history: { create: { toStatus: 'PENDING', actorUserId: emp.sam.userId, comment: 'Submitted' } },
    },
  });

  console.log(`Seeded. Demo password for all users: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
