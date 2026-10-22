const jwt = require('jsonwebtoken');
const { app, prisma, request, login, api, PASSWORD, USERS } = require('./helpers');

afterAll(() => prisma.$disconnect());

describe('Authentication', () => {
  test('valid credentials return an access token, profile and httpOnly refresh cookie', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: USERS.employee, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.role).toBe('Employee');
    expect(res.body.user.permissions).toContain('leave:create:own');
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.headers['set-cookie'][0]).toMatch(/refreshToken=.*HttpOnly.*SameSite=Strict/i);
  });

  test('wrong password and unknown user get the same 401 message (no account enumeration)', async () => {
    const a = await request(app).post('/api/auth/login').send({ email: USERS.employee, password: 'wrong-pass1' });
    const b = await request(app).post('/api/auth/login').send({ email: 'nobody@ems.local', password: 'wrong-pass1' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error.message).toBe(b.body.error.message);
  });

  test('invalid login payload is rejected with 400 and field details', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toEqual(expect.arrayContaining(['email', 'password']));
  });

  test('protected routes reject missing, malformed and forged tokens', async () => {
    expect((await request(app).get('/api/employees')).status).toBe(401);
    expect((await api('garbage').get('/api/employees')).status).toBe(401);
    const forged = jwt.sign({ sub: 1, role: 'Administrator' }, 'not-the-real-secret');
    expect((await api(forged).get('/api/users')).status).toBe(401);
  });

  test('refresh issues a new access token; logout revokes the refresh token', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: USERS.ethan, password: PASSWORD }).expect(200);
    const refreshed = await agent.post('/api/auth/refresh');
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toBeDefined();

    const oldCookie = refreshed.headers['set-cookie'][0].split(';')[0];
    await agent.post('/api/auth/logout').expect(204);
    // Replaying the old refresh token after logout must fail
    const replay = await request(app).post('/api/auth/refresh').set('Cookie', oldCookie);
    expect(replay.status).toBe(401);
  });

  test('GET /auth/me returns the current profile', async () => {
    const res = await api(await login('manager')).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(USERS.manager);
    expect(res.body.employee.name).toBe('Mark Manager');
  });
});
