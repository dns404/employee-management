const { app, prisma, request, login, api, userIdOf, PASSWORD, USERS } = require('./helpers');

let t = {};
let roles;

beforeAll(async () => {
  for (const who of ['admin', 'manager', 'employee']) t[who] = await login(who);
  roles = Object.fromEntries((await api(t.admin).get('/api/roles')).body.map((r) => [r.name, r]));
});
afterAll(() => prisma.$disconnect());

describe('User management', () => {
  test('non-admins cannot list or modify users (403)', async () => {
    const ethanId = await userIdOf('ethan');
    expect((await api(t.manager).get('/api/users')).status).toBe(403);
    expect((await api(t.employee).get('/api/users')).status).toBe(403);
    expect((await api(t.employee).patch(`/api/users/${ethanId}`, { roleId: roles.Administrator.id })).status).toBe(403);
  });

  test('admin cannot change own role or deactivate self', async () => {
    const adminId = await userIdOf('admin');
    expect((await api(t.admin).patch(`/api/users/${adminId}`, { roleId: roles.Employee.id })).status).toBe(400);
    expect((await api(t.admin).patch(`/api/users/${adminId}`, { isActive: false })).status).toBe(400);
  });

  test('role change takes effect immediately, even for an already-issued token', async () => {
    const ethanId = await userIdOf('ethan');
    const ethanToken = await login('ethan');
    expect((await api(ethanToken).get('/api/leaves?view=team')).status).toBe(403);

    await api(t.admin).patch(`/api/users/${ethanId}`, { roleId: roles.Manager.id }).expect(200);
    expect((await api(ethanToken).get('/api/leaves?view=team')).status).toBe(200);

    await api(t.admin).patch(`/api/users/${ethanId}`, { roleId: roles.Employee.id }).expect(200);
    expect((await api(ethanToken).get('/api/leaves?view=team')).status).toBe(403);
  });

  test('a manager with direct reports cannot be demoted to a role that cannot manage', async () => {
    const markId = await userIdOf('manager');
    const res = await api(t.admin).patch(`/api/users/${markId}`, { roleId: roles.Employee.id });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/direct report/);
  });

  test('deactivated user is locked out immediately and cannot log in', async () => {
    const samId = await userIdOf('sam');
    const samToken = await login('sam');
    await api(t.admin).patch(`/api/users/${samId}`, { isActive: false }).expect(200);

    expect((await api(samToken).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: USERS.sam, password: PASSWORD })).status).toBe(401);

    await api(t.admin).patch(`/api/users/${samId}`, { isActive: true }).expect(200);
  });
});

describe('Role management', () => {
  test('non-admins cannot manage roles (403)', async () => {
    expect((await api(t.manager).post('/api/roles', { name: 'Hacker', permissions: ['user:manage'] })).status).toBe(403);
    expect((await api(t.manager).put(`/api/roles/${roles.Manager.id}`, { permissions: ['user:manage'] })).status).toBe(403);
  });

  test('system Administrator role cannot be modified (prevents lock-out)', async () => {
    expect((await api(t.admin).put(`/api/roles/${roles.Administrator.id}`, { permissions: [] })).status).toBe(403);
  });

  test('unknown permission keys are rejected', async () => {
    expect((await api(t.admin).post('/api/roles', { name: 'Bad', permissions: ['do:anything'] })).status).toBe(400);
  });

  test('admin creates a custom role, and it is enforced', async () => {
    const res = await api(t.admin).post('/api/roles', { name: 'Auditor', description: 'Read-only', permissions: ['employee:read:all', 'leave:read:all'] });
    expect(res.status).toBe(201);
    expect(res.body.permissions).toHaveLength(2);

    // Removing a role that is in use is blocked
    const managerUsers = (await api(t.admin).delete(`/api/roles/${roles.Manager.id}`));
    expect(managerUsers.status).toBe(409);
    expect((await api(t.admin).delete(`/api/roles/${res.body.id}`)).status).toBe(204);
  });
});
