const router = require('express').Router();
const Joi = require('joi');
const validate = require('../../middlewares/validate');
const { authorize } = require('../../middlewares/authorize');
const service = require('./leaves.service');

const id = Joi.object({ id: Joi.number().integer().positive().required() });
const status = Joi.string().valid('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

const listQuery = Joi.object({
  view: Joi.string().valid('mine', 'team'),
  status,
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
});

const createBody = Joi.object({
  leaveTypeId: Joi.number().integer().positive().required(),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).required()
    .messages({ 'date.min': 'endDate must be on or after startDate' }),
  reason: Joi.string().trim().min(3).max(500).required(),
});

const commentBody = Joi.object({ comment: Joi.string().trim().max(500).allow('') });
const rejectBody = Joi.object({ comment: Joi.string().trim().min(3).max(500).required() }); // reason is mandatory

router.get('/', authorize('leave:read'), validate({ query: listQuery }), async (req, res) => {
  res.json(await service.list(req.user, req.valid.query));
});

router.get('/:id', authorize('leave:read'), validate({ params: id }), async (req, res) => {
  res.json(await service.get(req.user, req.valid.params.id));
});

router.post('/', authorize('leave:create'), validate({ body: createBody }), async (req, res) => {
  res.status(201).json(await service.create(req.user, req.valid.body));
});

router.post('/:id/cancel', authorize('leave:cancel'), validate({ params: id, body: commentBody }), async (req, res) => {
  res.json(await service.cancel(req.user, req.valid.params.id, req.valid.body.comment));
});

router.post('/:id/approve', authorize('leave:approve'), validate({ params: id, body: commentBody }), async (req, res) => {
  res.json(await service.decide(req.user, req.valid.params.id, 'APPROVED', req.valid.body.comment));
});

router.post('/:id/reject', authorize('leave:approve'), validate({ params: id, body: rejectBody }), async (req, res) => {
  res.json(await service.decide(req.user, req.valid.params.id, 'REJECTED', req.valid.body.comment));
});

module.exports = router;
