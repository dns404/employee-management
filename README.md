# Employee Management System (RBAC)

A full-stack Employee Management System with **Role-Based Access Control** enforced on the backend. It covers four modules: Employee Management, Leave Management, Leave Approval, and User & Role Management.

| Layer | Technology |
|---|---|
| Frontend | React 18 (Vite), Ant Design 5, React Router, Axios |
| Backend | Node.js, Express 5, Joi validation, JWT auth, bcrypt |
| Database | PostgreSQL 16 (Docker) via Prisma ORM |
| Testing | Jest + Supertest (API integration tests against a real test database) |

---

## Quick start

**Prerequisites:** Node.js 20+ and Docker.

```bash
npm run setup   # install deps, start PostgreSQL (port 5434), run migrations, seed demo data
npm run dev     # API on http://localhost:4000, UI on http://localhost:5173
npm test        # 44 API tests (uses a separate employee_mgmt_test database)
```

Open **http://localhost:5173**. All demo accounts use the password **`Password@123`**. The login page has one-click buttons for the first three.

| Role | Email | Who |
|---|---|---|
| Administrator | `admin@ems.local` | Alice Admin, HR Director (top of the hierarchy) |
| Manager | `manager@ems.local` | Mark Manager, who manages Emma & Ethan |
| Manager | `sara@ems.local` | Sara Sales, who manages Sam (a different team) |
| Employee | `employee@ems.local` | Emma Employee, who reports to Mark |
| Employee | `ethan@ems.local`, `sam@ems.local` | |

To re-seed the demo data at any time, run `npm --prefix server run db:seed`.

<details>
<summary>Manual setup (without the root scripts)</summary>

```bash
docker compose up -d
cd server && npm install && cp .env.example .env && npx prisma migrate deploy && npm run db:seed && npm run dev
cd client && npm install && npm run dev
```
</details>

---

## Architecture

```
React SPA (Vite) ──/api proxy──▶ Express API ──Prisma──▶ PostgreSQL
  in-memory access token          helmet · cors · rate-limit (login)
  httpOnly refresh cookie         authenticate  → verify JWT, load user + permissions from DB
  menu/routes hidden by perms     authorize()   → route-level permission check
  (UX only)                       validate()    → Joi schema, unknown fields rejected
                                  service layer → row-level scope + field-level rules + business rules
                                  errorHandler  → consistent JSON errors, no stack traces leaked
```

The backend is a **layered modular monolith**. Each feature module (`auth`, `employees`, `leaves`, `users`, `roles`, `lookups`) owns its routes, validation schemas and service logic. Microservices would be over-engineering at this scale. The module boundaries are clear enough to split out later if that's ever needed.

```
server/
  prisma/            schema.prisma, migrations/, seed.js
  src/
    config/          env.js, permissions.js  (permission catalogue + default role mapping)
    middlewares/     authenticate, authorize, validate, errorHandler
    modules/<name>/  <name>.routes.js (+ <name>.service.js where there is real business logic)
    utils/ApiError.js
    app.js, server.js
  tests/             auth, employees, leaves, admin (RBAC + unauthorized-access scenarios)
client/src/
  api/client.js      axios instance, token refresh, server-error → form-field mapping
  auth/              AuthContext (user, can(perm), login/logout)
  components/        AppLayout (role-aware menu), shared UI bits
  pages/             Login, Dashboard, Employees, MyLeaves, Approvals, Users, Roles
```

### RBAC design

Permissions are stored in the database (`permissions`, `role_permissions`), so roles are configurable and can be edited in the **Roles & Permissions** screen. Permission keys follow the format `resource:action[:scope]`, where the scope is `all`, `team` or `own`.

Access is enforced in **three layers**, all on the server:

1. **Route level:** `authorize('leave:approve')` passes if the user holds `leave:approve` or any scoped variant of it (`leave:approve:team`, …).
2. **Row level:** services resolve the user's broadest scope with `scopeOf()` and filter queries accordingly. `all` returns everything, `team` returns self plus direct reports (`manager_id = me`), and `own` returns only self. A record outside your scope returns **404, not 403**, so its existence isn't leaked.
3. **Field level:** for employee updates, *which fields* you may change depends on your relationship to the record. The API returns `editableFields` so the UI can disable the other inputs. Sending a forbidden field returns 403.

Permissions are re-read from the database on **every request**, so role changes and deactivations take effect immediately rather than when the token expires. This costs one indexed query per request.

#### Default permission matrix

| Capability | Administrator | Manager | Employee |
|---|---|---|---|
| View employees | All | Self + direct reports | Self |
| Edit employee | All fields | Job title of direct reports; own phone/address | Own phone/address |
| Create / deactivate employees | ✅ | ❌ | ❌ |
| Submit / cancel own leave | ✅ | ✅ | ✅ |
| View leave | All | Own + direct reports | Own |
| Approve / reject leave | All (except own) | Direct reports only (never own) | ❌ |
| Manage users & role assignment | ✅ | ❌ | ❌ |
| Manage roles & permissions | ✅ | ❌ | ❌ |

### Authentication

- Login returns a **short-lived access JWT (15 min)**, which the SPA keeps in memory only (never in localStorage, which limits XSS exposure). It also sets a **refresh JWT (7 days)** as an `httpOnly; SameSite=Strict` cookie scoped to `/api/auth`.
- The Axios interceptor refreshes the access token transparently on a 401. Concurrent 401s share a single refresh call.
- **Revocation:** each user has a `token_version`. Logout, role change, password reset and deactivation increment it, which invalidates every outstanding refresh token.
- Passwords are hashed with bcrypt. Login failures return the same message whether the user is unknown, the password is wrong, or the account is inactive, which prevents account enumeration. The login route is rate-limited (10 attempts per 15 minutes).

---

## Database schema

```
roles ─< role_permissions >─ permissions
  │
users (email unique, password_hash, is_active, token_version)
  │ 1:1
employees (employee_code unique, manager_id → employees.id, department_id → departments)
  │ 1:N                                  └── self-referencing reporting line
leave_requests (employee_id, leave_type_id, start_date, end_date, days, status)
  │ 1:N
leave_request_history (from_status, to_status, actor_user_id → users, comment, created_at)
```

The full schema is in [`server/prisma/schema.prisma`](server/prisma/schema.prisma), and the SQL is in [`server/prisma/migrations`](server/prisma/migrations).

**Database-level constraints.** These provide defence in depth: the API checks the same rules first and returns friendly errors.

- `leave_no_overlap`: a PostgreSQL **exclusion constraint** (`btree_gist`) that prevents overlapping PENDING/APPROVED leave for the same employee, even under concurrent requests.
- `CHECK (end_date >= start_date)`, `CHECK (days > 0)`, and `CHECK (manager_id <> id)`.
- Unique constraints on email and employee code. Foreign keys on every relationship.

**Business rules** (in the service layer):

- Nobody can approve their own leave, including administrators.
- Managers act only on their direct reports.
- Status transitions are atomic (`UPDATE … WHERE status = 'PENDING'`), so double approval returns 409.
- Every transition writes a history row: who did it, when, and with what comment.
- Rejection requires a reason.
- Leave cannot start in the past, and the day count is working days only.
- Reporting cycles (A → B → A) are rejected.
- Admins cannot change their own role or deactivate themselves.
- The last active administrator cannot be removed.
- The system Administrator role is locked against edits, to prevent lock-out.
- A role still assigned to users cannot be deleted.

---

## API overview

All routes are under `/api`, and everything except `/auth/login|refresh|logout` requires `Authorization: Bearer <token>`.

| Method | Route | Permission |
|---|---|---|
| POST | `/auth/login`, `/auth/refresh`, `/auth/logout`; GET `/auth/me` | public / authenticated |
| GET | `/employees?q=&departmentId=&status=&page=&pageSize=` | `employee:read` (row-scoped) |
| GET | `/employees/:id` (includes `editableFields`) | `employee:read` (row-scoped) |
| POST | `/employees` (creates employee + login) | `employee:create` |
| PATCH | `/employees/:id` | `employee:update` (field-level) |
| DELETE | `/employees/:id` (deactivate) | `employee:deactivate` |
| GET | `/leaves?view=mine\|team&status=` · `/leaves/:id` (with history) | `leave:read` (row-scoped) |
| POST | `/leaves` · `/leaves/:id/cancel` | `leave:create` · `leave:cancel` |
| POST | `/leaves/:id/approve` · `/leaves/:id/reject` | `leave:approve` (team/all) |
| GET/PATCH | `/users`, `/users/:id` (role, active, password) | `user:manage` |
| GET/POST/PUT/DELETE | `/roles`, `/roles/:id`, GET `/roles/permissions` | `role:manage` |
| GET | `/lookups` · `/lookups/managers` | authenticated · `employee:create` or `employee:update:all` |

Errors always have the shape `{ "error": { "message": "...", "details": [{ "field", "message" }] } }`. The status codes used are 400 (validation), 401 (unauthenticated), 403 (forbidden), 404 (missing or out of scope) and 409 (conflict).

---

## Testing

`npm test` runs **44 integration tests** with Jest and Supertest against a real PostgreSQL test database. The test database is migrated and re-seeded before each run. The tests focus on **unauthorized-access scenarios**:

- **Authentication:** missing, malformed and forged tokens get 401. Logout revokes refresh tokens (a replayed token fails). Login responses don't enumerate accounts.
- **Employees:**
  - Row scoping per role.
  - An employee or manager reading out-of-scope records gets 404.
  - Non-admins creating employees get 403.
  - An employee escalating their own job title or manager gets 403.
  - A manager editing a report's personal fields gets 403.
  - Reporting cycles get 400.
  - Unknown fields (mass assignment) get 400.
- **Leaves:**
  - An employee approving gets 403.
  - Another team's manager gets 404.
  - Self-approval (manager or admin) gets 403.
  - Approving twice gets 409.
  - Cancelling someone else's request gets 404.
  - Overlaps get 409, and the DB constraint blocks them even when the API is bypassed.
  - Past or invalid date ranges get 400.
- **Admin:**
  - Non-admins managing users or roles get 403.
  - An admin cannot demote or deactivate themselves.
  - The system role is locked.
  - Unknown permission keys are rejected.
  - A role change applies to an **already-issued token** immediately.
  - A deactivated user is locked out at once.

---

## Assumptions & trade-offs

- **One role per user.** This keeps the model and UI simple. Permissions, not role names, drive every check, so moving to multiple roles per user would be a schema-only change.
- **Every user is an employee.** Creating an employee also creates their login in one transaction, which keeps users and employees consistent.
- **"Team" means direct reports.** It does not include the full subtree. A recursive CTE could extend this if skip-level managers need access.
- **Leave balances and accrual are out of scope.** Days are counted as working days (Mon–Fri), and public holidays are ignored.
- **Approver.** A request is approved by the employee's direct manager, or by anyone holding `leave:approve:all` (Administrator).
- **JavaScript over TypeScript, and Express over NestJS.** This trades compile-time safety for delivery speed within the 1–2 day window. Joi validation at every API boundary and the integration test suite make up for the missing types.
- **Permission lookup on every request.** This costs one indexed DB query per request but means revocation is instant. At larger scale it could be cached with a short TTL.
- **Not production-hardened:** no HTTPS termination, audit export, password reset by email, or CSRF tokens. CSRF exposure is limited because the refresh cookie is `SameSite=Strict` and path-scoped, and all other routes use bearer tokens rather than cookies.
