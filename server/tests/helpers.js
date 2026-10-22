const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');

const PASSWORD = 'Password@123';
const USERS = {
  admin: 'admin@ems.local',
  manager: 'manager@ems.local', // Mark - manages Emma & Ethan
  sara: 'sara@ems.local', // Sara - manages Sam (other team)
  employee: 'employee@ems.local', // Emma
  ethan: 'ethan@ems.local',
  sam: 'sam@ems.local',
};

async function login(who) {
  const res = await request(app).post('/api/auth/login').send({ email: USERS[who], password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed for ${who}: ${res.status}`);
  return res.body.accessToken;
}

const employeeIdOf = async (who) => (await prisma.user.findUnique({ where: { email: USERS[who] }, include: { employee: true } })).employee.id;
const userIdOf = async (who) => (await prisma.user.findUnique({ where: { email: USERS[who] } })).id;

// Authenticated request helper: api(token).get('/api/...')
const api = (token) => ({
  get: (url) => request(app).get(url).set('Authorization', `Bearer ${token}`),
  post: (url, body = {}) => request(app).post(url).set('Authorization', `Bearer ${token}`).send(body),
  patch: (url, body = {}) => request(app).patch(url).set('Authorization', `Bearer ${token}`).send(body),
  put: (url, body = {}) => request(app).put(url).set('Authorization', `Bearer ${token}`).send(body),
  delete: (url) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
});

module.exports = { app, prisma, request, login, api, employeeIdOf, userIdOf, PASSWORD, USERS };
