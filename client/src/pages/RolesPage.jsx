import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, App, Avatar, Button, Card, Col, Empty, Form, Input, Modal, Progress, Row, Segmented, Select, Skeleton,
  Switch, Table, Tag, Tooltip, Typography,
} from 'antd';
import {
  CheckOutlined, DeleteOutlined, LockOutlined, PlusOutlined, SafetyOutlined, TeamOutlined, CalendarOutlined,
  MinusOutlined,
} from '@ant-design/icons';
import { useAuth } from '../auth/AuthContext';
import api, { applyFieldErrors, errorMessage } from '../api/client';
import { PageHeader, UserAvatar } from '../components/common';

// Human-friendly capabilities mapped onto permission keys. Scoped capabilities expose Own / Team / All.
const CAPABILITIES = [
  {
    group: 'Employees', icon: <TeamOutlined />, color: '#0891b2',
    items: [
      { label: 'View employees', desc: 'See employee records', scopes: { own: 'employee:read:own', team: 'employee:read:team', all: 'employee:read:all' } },
      { label: 'Edit employees', desc: 'Own: phone & address · Team: job title of direct reports · All: every field', scopes: { own: 'employee:update:own', team: 'employee:update:team', all: 'employee:update:all' } },
      { label: 'Add employees', desc: 'Create employees together with their login', key: 'employee:create' },
      { label: 'Deactivate employees', desc: 'Disable an employee and their login', key: 'employee:deactivate' },
    ],
  },
  {
    group: 'Leave', icon: <CalendarOutlined />, color: '#16a34a',
    items: [
      { label: 'Request leave', desc: 'Submit own leave requests', key: 'leave:create:own' },
      { label: 'Cancel own requests', desc: 'Withdraw own requests while pending', key: 'leave:cancel:own' },
      { label: 'View leave', desc: 'See leave requests and their approval history', scopes: { own: 'leave:read:own', team: 'leave:read:team', all: 'leave:read:all' } },
      { label: 'Approve / reject leave', desc: 'Team: direct reports only. Required for members to have direct reports.', scopes: { team: 'leave:approve:team', all: 'leave:approve:all' } },
    ],
  },
  {
    group: 'Administration', icon: <SafetyOutlined />, color: '#4f46e5',
    items: [
      { label: 'Manage users', desc: 'Assign roles and enable or disable logins', key: 'user:manage' },
      { label: 'Manage roles & permissions', desc: 'Create roles and change what they can do', key: 'role:manage' },
    ],
  },
];

const SCOPE_LABELS = { own: 'Own', team: 'Team', all: 'All' };

// Turning a permission on also grants what it needs to work (e.g. you can't approve what you can't see)
const REQUIRES = {
  'employee:update:own': ['employee:read:own'],
  'employee:update:team': ['employee:read:team'],
  'employee:update:all': ['employee:read:all'],
  'employee:deactivate': ['employee:read:all'],
  'leave:create:own': ['leave:read:own'],
  'leave:cancel:own': ['leave:read:own'],
  'leave:approve:team': ['leave:read:team'],
  'leave:approve:all': ['leave:read:all'],
};

const allKeys = CAPABILITIES.flatMap((g) => g.items.flatMap((i) => (i.key ? [i.key] : Object.values(i.scopes))));

function withDependencies(set, key, on, describe) {
  const next = new Set(set);
  const notes = [];
  if (on) {
    next.add(key);
    for (const dep of REQUIRES[key] || []) {
      if (!next.has(dep)) { next.add(dep); notes.push(`Also enabled "${describe(dep)}" - it's required.`); }
    }
  } else {
    next.delete(key);
    for (const [dependent, deps] of Object.entries(REQUIRES)) {
      if (deps.includes(key) && next.has(dependent)) { next.delete(dependent); notes.push(`Also disabled "${describe(dependent)}" - it needs this.`); }
    }
  }
  return { next, notes };
}

const sameSet = (a, b) => a.size === b.size && [...a].every((k) => b.has(k));

export default function RolesPage() {
  const { can } = useAuth();
  const { message, modal } = App.useApp();
  const [createForm] = Form.useForm();
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null); // { name, description, permissions: Set }
  const [notes, setNotes] = useState([]);
  const [view, setView] = useState('edit');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (selectId) => {
    const [r, u] = await Promise.all([api.get('/roles'), can('user:manage') ? api.get('/users') : { data: [] }]);
    setRoles(r.data);
    setUsers(u.data);
    setLoading(false);
    setSelectedId((cur) => selectId ?? cur ?? r.data[0]?.id);
  }, [can]);

  useEffect(() => { load(); }, [load]);

  const role = roles.find((r) => r.id === selectedId);

  // Reset the editor whenever another role is selected or data reloads
  useEffect(() => {
    if (role) setDraft({ name: role.name, description: role.description || '', permissions: new Set(role.permissions) });
    setNotes([]);
  }, [role]);

  const describe = useCallback((key) => {
    for (const g of CAPABILITIES) {
      for (const i of g.items) {
        if (i.key === key) return i.label;
        const scope = i.scopes && Object.keys(i.scopes).find((s) => i.scopes[s] === key);
        if (scope) return `${i.label} · ${SCOPE_LABELS[scope]}`;
      }
    }
    return key;
  }, []);

  const dirty = !!role && !!draft && (
    draft.name !== role.name || draft.description !== (role.description || '') || !sameSet(draft.permissions, new Set(role.permissions))
  );
  const locked = role?.isSystem;

  const toggle = (key, on) => {
    const { next, notes: n } = withDependencies(draft.permissions, key, on, describe);
    setDraft({ ...draft, permissions: next });
    setNotes(n);
  };

  const guardUnsaved = (fn) => {
    if (!dirty) return fn();
    modal.confirm({
      title: 'Discard unsaved changes?',
      content: `Your changes to ${role.name} haven't been saved.`,
      okText: 'Discard',
      okButtonProps: { danger: true },
      onOk: fn,
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/roles/${role.id}`, {
        name: draft.name.trim(),
        description: draft.description.trim(),
        permissions: [...draft.permissions],
      });
      message.success(`${draft.name} saved - members get the new access immediately`);
      await load(role.id);
    } catch (err) {
      message.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = () => modal.confirm({
    title: `Delete the ${role.name} role?`,
    content: role.userCount
      ? `${role.userCount} user(s) still have this role. Move them to another role on the Users page first.`
      : 'This cannot be undone.',
    okText: 'Delete role',
    okButtonProps: { danger: true, disabled: role.userCount > 0 },
    onOk: async () => {
      try {
        await api.delete(`/roles/${role.id}`);
        message.success('Role deleted');
        setSelectedId(null);
        load(roles.find((r) => r.id !== role.id)?.id);
      } catch (err) {
        message.error(errorMessage(err));
      }
    },
  });

  const create = async ({ name, description, copyFrom }) => {
    try {
      const permissions = copyFrom ? roles.find((r) => r.id === copyFrom).permissions : [];
      const { data } = await api.post('/roles', { name, description, permissions });
      message.success(`${name} created`);
      setCreating(false);
      createForm.resetFields();
      setView('edit');
      load(data.id);
    } catch (err) {
      if (!applyFieldErrors(createForm, err)) message.error(errorMessage(err));
    }
  };

  const members = useMemo(() => users.filter((u) => u.role.id === selectedId), [users, selectedId]);

  if (loading) return <><PageHeader title="Roles & permissions" /><Card><Skeleton active paragraph={{ rows: 8 }} /></Card></>;

  return (
    <>
      <PageHeader
        title="Roles & permissions"
        subtitle="Decide what each role can do, and whose records it applies to."
        extra={(
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Segmented value={view} onChange={(v) => guardUnsaved(() => setView(v))} options={[{ label: 'Edit role', value: 'edit' }, { label: 'Compare roles', value: 'compare' }]} />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>New role</Button>
          </div>
        )}
      />

      {view === 'compare' ? <CompareMatrix roles={roles} /> : (
        <Row gutter={[16, 16]} align="top">
          <Col xs={24} lg={7}>
            <div style={{ display: 'grid', gap: 8 }}>
              {roles.map((r) => {
                const count = r.permissions.filter((k) => allKeys.includes(k)).length;
                return (
                  <div
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    className={`role-item ${r.id === selectedId ? 'active' : ''}`}
                    onClick={() => r.id !== selectedId && guardUnsaved(() => setSelectedId(r.id))}
                    onKeyDown={(e) => e.key === 'Enter' && r.id !== selectedId && guardUnsaved(() => setSelectedId(r.id))}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600 }}>{r.name} {r.isSystem && <LockOutlined style={{ color: '#94a3b8', fontSize: 12 }} />}</span>
                      <Tag bordered={false} style={{ margin: 0 }}>{r.userCount} {r.userCount === 1 ? 'user' : 'users'}</Tag>
                    </div>
                    {r.description && <div className="person-sub" style={{ marginTop: 2 }}>{r.description}</div>}
                    <Progress percent={Math.round((count / allKeys.length) * 100)} size="small" showInfo={false} strokeColor="#4f46e5" style={{ margin: '8px 0 0' }} />
                    <div className="person-sub">{count} of {allKeys.length} permissions</div>
                  </div>
                );
              })}
            </div>
          </Col>

          <Col xs={24} lg={17}>
            {!role || !draft ? <Card><Empty description="Select a role" /></Card> : (
              <Card>
                <div className="role-editor-head">
                  <div style={{ flex: 1, minWidth: 220 }}>
                    {locked ? (
                      <>
                        <Typography.Title level={4} style={{ margin: 0 }}>{role.name} <LockOutlined style={{ fontSize: 16, color: '#94a3b8' }} /></Typography.Title>
                        <div className="person-sub" style={{ fontSize: 14 }}>{role.description}</div>
                      </>
                    ) : (
                      <>
                        <Input
                          value={draft.name}
                          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                          maxLength={40}
                          variant="borderless"
                          className="role-name-input"
                          aria-label="Role name"
                        />
                        <Input
                          value={draft.description}
                          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                          maxLength={200}
                          variant="borderless"
                          placeholder="Add a description"
                          style={{ paddingLeft: 0, color: '#64748b' }}
                          aria-label="Role description"
                        />
                      </>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {members.length > 0 && (
                      <Avatar.Group max={{ count: 4 }} size="small">
                        {members.map((m) => (
                          <Tooltip key={m.id} title={m.employee ? `${m.employee.firstName} ${m.employee.lastName}` : m.email}>
                            <span><UserAvatar first={m.employee?.firstName} last={m.employee?.lastName} size={24} /></span>
                          </Tooltip>
                        ))}
                      </Avatar.Group>
                    )}
                    {!locked && (
                      <Tooltip title={role.userCount ? 'Reassign its users before deleting' : 'Delete role'}>
                        <Button danger type="text" icon={<DeleteOutlined />} onClick={remove} aria-label="Delete role" />
                      </Tooltip>
                    )}
                  </div>
                </div>

                {locked && (
                  <Alert
                    type="info"
                    showIcon
                    icon={<LockOutlined />}
                    style={{ marginBottom: 16 }}
                    message="Built-in role - view only"
                    description="The Administrator role always keeps full access so the system can't be locked out. Create a new role to customise access."
                  />
                )}
                {notes.length > 0 && (
                  <Alert type="warning" showIcon closable onClose={() => setNotes([])} style={{ marginBottom: 16 }} message={notes.map((n) => <div key={n}>{n}</div>)} />
                )}

                {CAPABILITIES.map((g) => (
                  <div key={g.group} className="cap-group">
                    <div className="cap-group-title">
                      <span className="stat-icon" style={{ width: 28, height: 28, fontSize: 14, borderRadius: 7, background: `${g.color}1a`, color: g.color }}>{g.icon}</span>
                      {g.group}
                    </div>
                    {g.items.map((item) => (
                      <div key={item.label} className="cap-row">
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 500 }}>{item.label}</div>
                          <div className="person-sub" style={{ whiteSpace: 'normal' }}>{item.desc}</div>
                        </div>
                        {item.key ? (
                          <Switch
                            checked={draft.permissions.has(item.key)}
                            disabled={locked}
                            onChange={(on) => toggle(item.key, on)}
                            aria-label={item.label}
                          />
                        ) : (
                          <div className="scope-toggle" role="group" aria-label={item.label}>
                            {Object.entries(item.scopes).map(([scope, key]) => {
                              const on = draft.permissions.has(key);
                              return (
                                <button
                                  type="button"
                                  key={scope}
                                  disabled={locked}
                                  aria-pressed={on}
                                  className={on ? 'on' : ''}
                                  onClick={() => toggle(key, !on)}
                                >
                                  {on && <CheckOutlined style={{ fontSize: 10, marginRight: 4 }} />}{SCOPE_LABELS[scope]}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}

                {dirty && !locked && (
                  <div className="save-bar">
                    <span>You have unsaved changes</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button onClick={() => { setDraft({ name: role.name, description: role.description || '', permissions: new Set(role.permissions) }); setNotes([]); }}>Discard</Button>
                      <Button type="primary" loading={saving} disabled={draft.name.trim().length < 2} onClick={save}>Save changes</Button>
                    </div>
                  </div>
                )}
              </Card>
            )}
          </Col>
        </Row>
      )}

      <Modal title="New role" open={creating} onOk={createForm.submit} onCancel={() => setCreating(false)} okText="Create role" destroyOnHidden>
        <Form form={createForm} layout="vertical" onFinish={create} requiredMark={false}>
          <Form.Item name="name" label="Role name" rules={[{ required: true, message: 'Give the role a name' }, { min: 2, max: 40 }]}>
            <Input placeholder="e.g. HR Auditor" />
          </Form.Item>
          <Form.Item name="description" label="Description" rules={[{ max: 200 }]}>
            <Input placeholder="What is this role for?" />
          </Form.Item>
          <Form.Item name="copyFrom" label="Start with permissions from" extra="Optional - you can adjust everything after creating it.">
            <Select allowClear placeholder="Start empty" options={roles.map((r) => ({ value: r.id, label: r.name }))} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// Read-only side-by-side overview of every role
function CompareMatrix({ roles }) {
  const rows = CAPABILITIES.map((g) => ({
    key: g.group,
    group: g.group,
    children: g.items.map((i) => ({ key: i.label, item: i })),
  }));

  const cell = (role, item) => {
    if (item.key) {
      return role.permissions.includes(item.key)
        ? <CheckOutlined style={{ color: '#16a34a' }} aria-label="Allowed" />
        : <MinusOutlined style={{ color: '#cbd5e1' }} aria-label="Not allowed" />;
    }
    const granted = Object.entries(item.scopes).filter(([, k]) => role.permissions.includes(k)).map(([s]) => SCOPE_LABELS[s]);
    return granted.length
      ? granted.map((s) => <Tag key={s} color="purple" bordered={false} style={{ marginInlineEnd: 4 }}>{s}</Tag>)
      : <MinusOutlined style={{ color: '#cbd5e1' }} aria-label="Not allowed" />;
  };

  const columns = [
    {
      title: 'Capability', width: 260, fixed: 'left',
      render: (_, r) => (r.group ? <b>{r.group}</b> : r.item.label),
    },
    ...roles.map((role) => ({
      key: role.id,
      align: 'center',
      title: <span>{role.name} {role.isSystem && <LockOutlined style={{ color: '#94a3b8' }} />}</span>,
      render: (_, r) => (r.group ? null : cell(role, r.item)),
    })),
  ];

  return (
    <Card>
      <Table
        columns={columns}
        dataSource={rows}
        pagination={false}
        scroll={{ x: true }}
        size="middle"
        expandable={{ defaultExpandAllRows: true }}
      />
    </Card>
  );
}
