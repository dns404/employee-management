import { useCallback, useEffect, useState } from 'react';
import { App, Button, Card, Checkbox, Form, Input, Modal, Popconfirm, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { DeleteOutlined, LockOutlined, PlusOutlined } from '@ant-design/icons';
import api, { applyFieldErrors, errorMessage } from '../api/client';

// Permission matrix: rows = permissions, columns = roles. Changes are saved per role.
export default function RolesPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [draft, setDraft] = useState({}); // roleId -> Set of permission keys
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const [r, p] = await Promise.all([api.get('/roles'), api.get('/roles/permissions')]);
    setRoles(r.data);
    setPermissions(p.data);
    setDraft(Object.fromEntries(r.data.map((role) => [role.id, new Set(role.permissions)])));
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (roleId, key, checked) => {
    const next = new Set(draft[roleId]);
    if (checked) next.add(key); else next.delete(key);
    setDraft({ ...draft, [roleId]: next });
  };

  const isDirty = (role) => {
    const d = draft[role.id];
    return d && (d.size !== role.permissions.length || role.permissions.some((k) => !d.has(k)));
  };

  const save = async (role) => {
    try {
      await api.put(`/roles/${role.id}`, { permissions: [...draft[role.id]] });
      message.success(`${role.name} updated`);
      load();
    } catch (err) {
      message.error(errorMessage(err));
    }
  };

  const remove = async (role) => {
    try {
      await api.delete(`/roles/${role.id}`);
      message.success('Role deleted');
      load();
    } catch (err) {
      message.error(errorMessage(err));
    }
  };

  const create = async (values) => {
    try {
      await api.post('/roles', { ...values, permissions: [] });
      message.success('Role created - now tick its permissions');
      setCreating(false);
      form.resetFields();
      load();
    } catch (err) {
      if (!applyFieldErrors(form, err)) message.error(errorMessage(err));
    }
  };

  const columns = [
    {
      title: 'Permission', fixed: 'left', width: 260,
      render: (_, p) => <><code>{p.key}</code><div style={{ color: '#888', fontSize: 12 }}>{p.description}</div></>,
    },
    ...roles.map((role) => ({
      key: role.id,
      align: 'center',
      title: (
        <Space direction="vertical" size={4}>
          <span>
            {role.name} {role.isSystem && <Tooltip title="System role - locked to prevent lock-out"><LockOutlined /></Tooltip>}
          </span>
          <Tag>{role.userCount} users</Tag>
          {!role.isSystem && (
            <Space size={4}>
              <Button size="small" type="primary" disabled={!isDirty(role)} onClick={() => save(role)}>Save</Button>
              <Popconfirm title={`Delete role ${role.name}?`} onConfirm={() => remove(role)}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Space>
          )}
        </Space>
      ),
      render: (_, p) => (
        <Checkbox
          checked={draft[role.id]?.has(p.key)}
          disabled={role.isSystem}
          onChange={(e) => toggle(role.id, p.key, e.target.checked)}
        />
      ),
    })),
  ];

  return (
    <Card>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Roles & permissions</Typography.Title>
        <Button icon={<PlusOutlined />} onClick={() => setCreating(true)}>New role</Button>
      </Space>
      <Table rowKey="key" columns={columns} dataSource={permissions} pagination={false} scroll={{ x: true }} size="small" />

      <Modal title="New role" open={creating} onOk={form.submit} onCancel={() => setCreating(false)} okText="Create">
        <Form form={form} layout="vertical" onFinish={create}>
          <Form.Item name="name" label="Name" rules={[{ required: true, min: 2, max: 40 }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description" rules={[{ max: 200 }]}><Input /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
