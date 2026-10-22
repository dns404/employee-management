const { prisma, login, api } = require('./helpers');

let t = {};
let annualId;
// Fixed far-future weekdays so tests don't depend on today's date
const range = (start, end) => ({ startDate: start, endDate: end });

beforeAll(async () => {
  for (const who of ['admin', 'manager', 'sara', 'employee', 'ethan']) t[who] = await login(who);
  annualId = (await prisma.leaveType.findUnique({ where: { name: 'Annual' } })).id;
});
afterAll(() => prisma.$disconnect());

const submit = (token, dates, reason = 'Holiday') =>
  api(token).post('/api/leaves', { leaveTypeId: annualId, reason, ...dates });

describe('Leave submission', () => {
  test('employee submits a leave request; working days are calculated', async () => {
    const res = await submit(t.employee, range('2030-03-04', '2030-03-10')); // Mon..Sun
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
    expect(res.body.days).toBe(5);
  });

  test('overlapping request is rejected with 409', async () => {
    expect((await submit(t.employee, range('2030-03-06', '2030-03-12'))).status).toBe(409);
  });

  test('past dates, reversed ranges and weekend-only ranges are rejected with 400', async () => {
    expect((await submit(t.employee, range('2020-01-06', '2020-01-07'))).status).toBe(400);
    expect((await submit(t.employee, range('2030-04-10', '2030-04-08'))).status).toBe(400);
    expect((await submit(t.employee, range('2030-03-16', '2030-03-17'))).status).toBe(400); // Sat-Sun
  });

  test('database constraint blocks overlaps even if the API check is bypassed', async () => {
    const emp = await prisma.employee.findFirst({ where: { firstName: 'Emma' } });
    await expect(prisma.leaveRequest.create({
      data: { employeeId: emp.id, leaveTypeId: annualId, startDate: new Date('2030-03-05'), endDate: new Date('2030-03-05'), days: 1, reason: 'x' },
    })).rejects.toThrow(/leave_no_overlap/);
  });
});

describe('Leave visibility', () => {
  test('employee only sees their own requests', async () => {
    const res = await api(t.employee).get('/api/leaves');
    const names = new Set(res.body.items.map((l) => l.employee.firstName));
    expect([...names]).toEqual(['Emma']);
  });

  test('manager team view contains only direct reports', async () => {
    const res = await api(t.manager).get('/api/leaves?view=team');
    const names = new Set(res.body.items.map((l) => l.employee.firstName));
    expect([...names].sort()).toEqual(expect.arrayContaining(['Emma']));
    expect(names.has('Sam')).toBe(false);
  });

  test('employee cannot request the team view (403)', async () => {
    expect((await api(t.employee).get('/api/leaves?view=team')).status).toBe(403);
  });
});

describe('Leave approval workflow', () => {
  let leaveId;
  beforeAll(async () => {
    leaveId = (await submit(t.ethan, range('2030-05-06', '2030-05-07'))).body.id;
  });

  test('employees cannot approve leave (403)', async () => {
    expect((await api(t.employee).post(`/api/leaves/${leaveId}/approve`)).status).toBe(403);
  });

  test('manager of another team cannot see or approve it (404)', async () => {
    expect((await api(t.sara).post(`/api/leaves/${leaveId}/approve`)).status).toBe(404);
  });

  test('reject requires a reason', async () => {
    expect((await api(t.manager).post(`/api/leaves/${leaveId}/reject`, {})).status).toBe(400);
  });

  test('direct manager approves; history records the transition and actor', async () => {
    const res = await api(t.manager).post(`/api/leaves/${leaveId}/approve`, { comment: 'Enjoy' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('APPROVED');
    const last = res.body.history.at(-1);
    expect(last).toMatchObject({ fromStatus: 'PENDING', toStatus: 'APPROVED', comment: 'Enjoy' });
    expect(last.actor.email).toBe('manager@ems.local');
  });

  test('an already-decided request cannot be approved/rejected/cancelled again (409)', async () => {
    expect((await api(t.manager).post(`/api/leaves/${leaveId}/reject`, { comment: 'Changed mind' })).status).toBe(409);
    expect((await api(t.ethan).post(`/api/leaves/${leaveId}/cancel`)).status).toBe(409);
  });

  test('manager cannot approve their own leave', async () => {
    const own = await submit(t.manager, range('2030-06-03', '2030-06-04'));
    expect((await api(t.manager).post(`/api/leaves/${own.body.id}/approve`)).status).toBe(403);
    // ...but their own manager (admin) can
    expect((await api(t.admin).post(`/api/leaves/${own.body.id}/approve`)).status).toBe(200);
  });

  test('admin cannot approve their own leave either', async () => {
    const own = await submit(t.admin, range('2030-07-01', '2030-07-02'));
    expect((await api(t.admin).post(`/api/leaves/${own.body.id}/approve`)).status).toBe(403);
  });

  test('employee can cancel own pending request but not someone else\'s', async () => {
    const mine = await submit(t.ethan, range('2030-08-05', '2030-08-06'));
    expect((await api(t.employee).post(`/api/leaves/${mine.body.id}/cancel`)).status).toBe(404);
    const res = await api(t.ethan).post(`/api/leaves/${mine.body.id}/cancel`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
  });
});
