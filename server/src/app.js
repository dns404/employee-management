const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const authenticate = require('./middlewares/authenticate');
const { errorHandler, notFound } = require('./middlewares/errorHandler');

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
if (!env.isTest) app.use(morgan('dev'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', require('./modules/auth/auth.routes'));

// Everything below requires a valid access token
app.use('/api', authenticate);
app.use('/api/lookups', require('./modules/lookups/lookups.routes'));
app.use('/api/employees', require('./modules/employees/employees.routes'));
app.use('/api/leaves', require('./modules/leaves/leaves.routes'));
app.use('/api/users', require('./modules/users/users.routes'));
app.use('/api/roles', require('./modules/roles/roles.routes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
