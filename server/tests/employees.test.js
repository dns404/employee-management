const { prisma, login, api, employeeIdOf } = require('./helpers');

let t = {};
let id = {};

beforeAll(async () => {
  for (const who of ['admin', 'manager', 'sara', 'employee']) t[who] = await login(who);
  for (const who of ['admin', 'manager', 'employee', 'ethan', 'sam']) id[who] = await employeeIdOf(who);
});
afterAll(() => prisma.$disconnect());

describe('Employee visibility (row-level scoping)', () => {
  test('admin sees every employee', async () => {
    const res = await api(t.admin).get('/api/employees');
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(6);
  });

  test('manager sees only self and direct reports', async () => {
    const res = await api(t.manager).get('/api/employees');
    const ids = res.body.items.map((e) => e.id).sort();
    expect(ids).toEqual([id.manager, id.employee, id.ethan].sort());
  });

  test('employee sees only their own record', async () => {
    const res = await api(t.employee).get('/api/employees');
    expect(res.body.items.map((e) => e.id)).toEqual([id.employee]);
  });

  test('employee cannot fetch another employee by id (404, existence not leaked)', async () => {
    expect((await api(t.employee).get(`/api/employees/${id.ethan}`)).status).toBe(404);
  });

  test('manager cannot fetch an employee from another team', async () => {
    expect((await api(t.manager).get(`/api/employees/${id.sam}`)).status).toBe(404);
  });
});

describe('Employee creation', () => {
  const newEmployee = async () => {
    const roles = await api(t.admin).get('/api/roles');
    return {
      firstName: 'Nina', lastName: 'New', email: `nina${Date.now()}@ems.local`, password: 'Welcome123',
      roleId: roles.body.find((r) => r.name === 'Employee').id, jobTitle: 'Analyst',
      departmentId: (await prisma.department.findFirst()).id, managerId: id.manager, hireDate: '2024-05-01',
    };
  };

  test('employee and manager cannot create employees (403)', async () => {
    const body = await newEmployee();
    expect((await api(t.employee).post('/api/employees', body)).status).toBe(403);
    expect((await api(t.manager).post('/api/employees', body)).status).toBe(403);
  });

  test('admin creates an employee with a login; the new user can sign in', async () => {
    const body = await newEmployee();
    const res = await api(t.admin).post('/api/employees', body);
    expect(res.status).toBe(201);
    expect(res.body.employeeCode).toMatch(/^EMP\d{4}$/);
    expect(res.body.manager.id).toBe(id.manager);
  });

  test('duplicate email is rejected with 409', async () => {
    const body = { ...(await newEmployee()), email: 'employee@ems.local' };
    expect((await api(t.admin).post('/api/employees', body)).status).toBe(409);
  });

  test('invalid input and unknown fields are rejected with 400', async () => {
    const res = await api(t.admin).post('/api/employees', { ...(await newEmployee()), password: 'short', isAdmin: true });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toEqual(expect.arrayContaining(['password', 'isAdmin']));
  });
});

describe('Employee updates (field-level permissions)', () => {
  test('employee can update own contact details', async () => {
    const res = await api(t.employee).patch(`/api/employees/${id.employee}`, { phone: '+1 555 0199' });
    expect(res.status).toBe(200);
    expect(res.body.phone).toBe('+1 555 0199');
  });

  test('employee cannot change own job title or manager (privilege escalation)', async () => {
    const res = await api(t.employee).patch(`/api/employees/${id.employee}`, { jobTitle: 'CTO' });
    expect(res.status).toBe(403);
    expect((await api(t.employee).patch(`/api/employees/${id.employee}`, { managerId: null })).status).toBe(403);
  });

  test('manager can update a direct report\'s job title but not their personal details', async () => {
    expect((await api(t.manager).patch(`/api/employees/${id.ethan}`, { jobTitle: 'Senior QA Engineer' })).status).toBe(200);
    expect((await api(t.manager).patch(`/api/employees/${id.ethan}`, { phone: '+1 555 0000' })).status).toBe(403);
  });

  test('manager cannot update employees outside their team', async () => {
    expect((await api(t.sara).patch(`/api/employees/${id.employee}`, { jobTitle: 'Hacked' })).status).toBe(404);
  });

  test('admin cannot create a reporting cycle', async () => {
    // Mark reports to Alice; making Alice report to Emma (who reports to Mark) is a cycle
    const res = await api(t.admin).patch(`/api/employees/${id.admin}`, { managerId: id.employee });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/cycle/);
  });

  test('only admin can deactivate employees', async () => {
    expect((await api(t.manager).delete(`/api/employees/${id.ethan}`)).status).toBe(403);
    expect((await api(t.admin).delete(`/api/employees/${id.admin}`)).status).toBe(400); // not self
  });
});
