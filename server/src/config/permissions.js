// Single source of truth for permission keys.
// Format: <resource>:<action>[:<scope>] where scope is all | team | own.
const PERMISSIONS = {
  'employee:read:all': 'View all employees',
  'employee:read:team': 'View direct reports',
  'employee:read:own': 'View own employee profile',
  'employee:create': 'Create employees (and their login)',
  'employee:update:all': 'Edit any employee (all fields)',
  'employee:update:team': 'Edit limited fields of direct reports',
  'employee:update:own': 'Edit own contact details',
  'employee:deactivate': 'Deactivate employees',
  'leave:create:own': 'Submit own leave requests',
  'leave:read:all': 'View all leave requests',
  'leave:read:team': 'View leave requests of direct reports',
  'leave:read:own': 'View own leave requests',
  'leave:approve:all': 'Approve/reject any leave request',
  'leave:approve:team': 'Approve/reject leave of direct reports',
  'leave:cancel:own': 'Cancel own pending leave requests',
  'user:manage': 'Manage user accounts and role assignment',
  'role:manage': 'Manage roles and their permissions',
};

const ROLE_PERMISSIONS = {
  Administrator: Object.keys(PERMISSIONS),
  Manager: [
    'employee:read:team', 'employee:read:own', 'employee:update:team', 'employee:update:own',
    'leave:create:own', 'leave:read:team', 'leave:read:own', 'leave:approve:team', 'leave:cancel:own',
  ],
  Employee: ['employee:read:own', 'employee:update:own', 'leave:create:own', 'leave:read:own', 'leave:cancel:own'],
};

// Field-level rules for employee updates, by scope
const EMPLOYEE_EDITABLE_FIELDS = {
  all: ['firstName', 'lastName', 'phone', 'address', 'jobTitle', 'hireDate', 'departmentId', 'managerId', 'status'],
  team: ['jobTitle'],
  own: ['phone', 'address'],
};

// Only roles holding one of these can have direct reports (be someone's "Reports to")
const MANAGER_PERMISSIONS = ['leave:approve:team', 'leave:approve:all'];

module.exports = { PERMISSIONS, ROLE_PERMISSIONS, EMPLOYEE_EDITABLE_FIELDS, MANAGER_PERMISSIONS };
