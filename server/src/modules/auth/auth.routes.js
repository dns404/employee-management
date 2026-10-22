const router = require('express').Router();
const Joi = require('joi');
const rateLimit = require('express-rate-limit');
const env = require('../../config/env');
const validate = require('../../middlewares/validate');
const authenticate = require('../../middlewares/authenticate');
const service = require('./auth.service');

const COOKIE = 'refreshToken';
const cookieOptions = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: 'strict',
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 1000 : 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { message: 'Too many login attempts, try again later' } },
});

const loginSchema = Joi.object({
  email: Joi.string().email({ tlds: false }).required(),
  password: Joi.string().min(1).max(128).required(),
});

router.post('/login', loginLimiter, validate({ body: loginSchema }), async (req, res) => {
  const { refreshToken, ...result } = await service.login(req.valid.body.email, req.valid.body.password);
  res.cookie(COOKIE, refreshToken, cookieOptions).json(result);
});

router.post('/refresh', async (req, res) => {
  const { refreshToken, ...result } = await service.refresh(req.cookies[COOKIE]);
  res.cookie(COOKIE, refreshToken, cookieOptions).json(result);
});

router.post('/logout', async (req, res) => {
  await service.logout(req.cookies[COOKIE]);
  res.clearCookie(COOKIE, { ...cookieOptions, maxAge: undefined }).status(204).end();
});

router.get('/me', authenticate, async (req, res) => {
  res.json(await service.me(req.user.id));
});

module.exports = router;
