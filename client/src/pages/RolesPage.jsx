import { useCallback, useEffect, useState } from 'react';
import { App, Button, Card, Checkbox, Form, Input, Modal, Space, Table, Tag, Tooltip } from 'antd';
import { DeleteOutlined, LockOutlined, PlusOutlined } from '@ant-design/icons';
import api, { applyFieldErrors, errorMessage } from '../api/client';
import { PageHeader } from '../components/common';

const GROUPS = [
  { key: 'employee', label: 'Employees' },
  { key: 'leave', label: 'Leave' },
  { key: 'admin', label: 'Administration', match: (k) => k.startsWith('user:') || k.startsWith('role:') },
];

// Permission matrix: rows = permissions (grouped by module), columns = roles. Saved per role.
export default function RolesPage() {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [draft, setDraft] = useState({}); // roleId -> Set of permission keys
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [r, p] = await Promise.all([api.get('/roles'), api.get('/roles/permissions')]);
    setRoles(r.data);
    setPermissions(p.data);
    setDraft(Object.fromEntries(r.data.map((role) => [role.id, new Set(role.permissions)])));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (roleId, key, checked) => {
    const next = new Set(draft[roleId]);
    if (checked) next.add(key); else next.delete(key);
    setDraft({ ...draft, [roleId]: next });
  };

  const isDirty = (role) => {
    const d = draft[role.id];
    return !!d && (d.size !== role.permissions.length || role.permissions.some((k) => !d.has(k)));
  };

  const save = async (role) => {
    try {
      await api.put(`/roles/${role.id}`, { permissions: [...draft[role.id]] });
      message.success(`${role.name} permissions saved`);
      load();
    } catch (err) {
      message.error(errorMessage(err));
    }
  };

  const remove = (role) => modal.confirm({
    title: `Delete the ${role.name} role?`,
    content: role.userCount ? `${role.userCount} user(s) still have this role - reassign them first.` : 'This cannot be undone.',
    okText: 'Delete',
    okButtonProps: { danger: true, disabled: role.userCount > 0 },
    onOk: async () => {
      try {
        await api.delete(`/roles/${role.id}`);
        message.success('Role deleted');
        load();
      } catch (err) {
        message.error(errorMessage(err));
      }
    },
  });

  const create = async (values) => {
    try {
      await api.post('/roles', { ...values, permissions: [] });
      message.success('Role created - tick the permissions it should have, then save');
      setCreating(false);
      form.resetFields();
      load();
    } catch (err) {
      if (!applyFieldErrors(form, err)) message.error(errorMessage(err));
    }
  };

  // Tree rows: one parent row per module, permissions as children
  const rows = GROUPS.map((g) => ({
    key: g.key,
    group: g.label,
    children: permissions
      .filter((p) => (g.match ? g.match(p.key) : p.key.startsWith(`${g.key}:`)))
      .map((p) => ({ ...p, key: p.key, permKey: p.key })),
  }));

  const columns = [
    {
      title: 'Permission',
      fixed: 'left',
      width: 300,
      render: (_, row) => (row.group ? <b>{row.group}</b> : (
        <div>
          <div>{row.description}</div>
          <code style={{ fontSize: 11, color: '#94a3b8' }}>{row.permKey}</code>
        </div>
      )),
    },
    ...roles.map((role) => ({
      key: role.id,
      align: 'center',
      width: 170,
      title: (
        <div style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>
          <span>
            {role.name}{' '}
            {role.isSystem && <Tooltip title="Built-in role - locked so no one can lock themselves out"><LockOutlined style={{ color: '#94a3b8' }} /></Tooltip>}
          </span>
          <Tag bordered={false} style={{ margin: 0 }}>{role.userCount} user{role.userCount === 1 ? '' : 's'}</Tag>
          {!role.isSystem && (
            <Space size={4}>
              <Button size="small" type="primary" disabled={!isDirty(role)} onClick={() => save(role)}>Save</Button>
              <Tooltip title="Delete role"><Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => remove(role)} /></Tooltip>
            </Space>
          )}
        </div>
      ),
      render: (_, row) => !row.group && (
        <Checkbox
          checked={draft[role.id]?.has(row.permKey)}
          disabled={role.isSystem}
          onChange={(e) => toggle(role.id, row.permKey, e.target.checked)}
          aria-label={`${role.name}: ${row.permKey}`}
        />
      ),
    })),
  ];

  const dirtyCount = roles.filter(isDirty).length;

  return (
    <>
      <PageHeader
        title="Roles & permissions"
        subtitle="Control what each role can see and do. Changes apply to users immediately after saving."
        extra={<Button icon={<PlusOutlined />} onClick={() => setCreating(true)}>New role</Button>}
      />
      <Card>
        {dirtyCount > 0 && (
          <div style={{ marginBottom: 12, color: '#d97706' }}>
            You have unsaved changes in {dirtyCount} role{dirtyCount > 1 ? 's' : ''} - use the Save button in the column header.
          </div>
        )}
        <Table
          loading={loading}
          columns={columns}
          dataSource={permissions.length ? rows : []}
          pagination={false}
          scroll={{ x: true }}
          size="middle"
          expandable={{ defaultExpandAllRows: true, expandRowByClick: true }}
          key={permissions.length} // remount once loaded so defaultExpandAllRows applies
        />
      </Card>

      <Modal title="New role" open={creating} onOk={form.submit} onCancel={() => setCreating(false)} okText="Create role" destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={create} requiredMark={false}>
          <Form.Item name="name" label="Role name" rules={[{ required: true, message: 'Give the role a name' }, { min: 2, max: 40 }]}>
            <Input placeholder="e.g. HR Auditor" />
          </Form.Item>
          <Form.Item name="description" label="Description" rules={[{ max: 200 }]}>
            <Input placeholder="What is this role for?" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
