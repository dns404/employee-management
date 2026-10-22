const router = require('express').Router();
const Joi = require('joi');
const validate = require('../../middlewares/validate');
const { authorize } = require('../../middlewares/authorize');
const service = require('./employees.service');

const id = Joi.object({ id: Joi.number().integer().positive().required() });
const name = Joi.string().trim().min(1).max(60);
const phone = Joi.string().trim().pattern(/^[+\d][\d\s()-]{5,19}$/).allow('', null)
  .messages({ 'string.pattern.base': 'phone must be a valid phone number' });

const listQuery = Joi.object({
  q: Joi.string().trim().max(60).allow(''),
  departmentId: Joi.number().integer().positive(),
  status: Joi.string().valid('ACTIVE', 'INACTIVE'),
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
});

const createBody = Joi.object({
  firstName: name.required(),
  lastName: name.required(),
  email: Joi.string().email({ tlds: false }).max(120).required(),
  password: Joi.string().min(8).max(128).pattern(/(?=.*[A-Za-z])(?=.*\d)/).required()
    .messages({ 'string.pattern.base': 'password must contain letters and numbers' }),
  roleId: Joi.number().integer().positive().required(),
  jobTitle: Joi.string().trim().min(2).max(80).required(),
  departmentId: Joi.number().integer().positive().required(),
  managerId: Joi.number().integer().positive().allow(null),
  hireDate: Joi.date().iso().max('now').required(),
  phone,
  address: Joi.string().trim().max(200).allow('', null),
});

const updateBody = Joi.object({
  firstName: name,
  lastName: name,
  jobTitle: Joi.string().trim().min(2).max(80),
  departmentId: Joi.number().integer().positive(),
  managerId: Joi.number().integer().positive().allow(null),
  hireDate: Joi.date().iso().max('now'),
  status: Joi.string().valid('ACTIVE', 'INACTIVE'),
  phone,
  address: Joi.string().trim().max(200).allow('', null),
}).min(1);

router.get('/', authorize('employee:read'), validate({ query: listQuery }), async (req, res) => {
  res.json(await service.list(req.user, req.valid.query));
});

router.get('/:id', authorize('employee:read'), validate({ params: id }), async (req, res) => {
  const employee = await service.getVisible(req.user, req.valid.params.id);
  // Tell the UI which fields this user may edit on this record
  res.json({ ...employee, editableFields: service.editableFields(req.user, employee) });
});

router.post('/', authorize('employee:create'), validate({ body: createBody }), async (req, res) => {
  res.status(201).json(await service.create(req.valid.body));
});

router.patch('/:id', authorize('employee:update'), validate({ params: id, body: updateBody }), async (req, res) => {
  res.json(await service.update(req.user, req.valid.params.id, req.valid.body));
});

router.delete('/:id', authorize('employee:deactivate'), validate({ params: id }), async (req, res) => {
  res.json(await service.deactivate(req.user, req.valid.params.id));
});

module.exports = router;
