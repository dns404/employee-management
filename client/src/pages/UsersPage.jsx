import { useCallback, useEffect, useState } from 'react';
import { App, Card, Select, Switch, Table, Tag, Typography } from 'antd';
import { useAuth } from '../auth/AuthContext';
import api, { errorMessage } from '../api/client';
import { fullName } from '../components/common';

export default function UsersPage() {
  const { user: me } = useAuth();
  const { message } = App.useApp();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([api.get('/users'), api.get('/roles')]);
      setUsers(u.data);
      setRoles(r.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = async (id, body, success) => {
    try {
      await api.patch(`/users/${id}`, body);
      message.success(success);
    } catch (err) {
      message.error(errorMessage(err));
    }
    load();
  };

  const columns = [
    { title: 'Email', dataIndex: 'email', render: (email, u) => <>{email} {u.id === me.id && <Tag>you</Tag>}</> },
    { title: 'Employee', render: (_, u) => (u.employee ? `${fullName(u.employee)} (${u.employee.employeeCode})` : '-'), responsive: ['md'] },
    {
      title: 'Role',
      render: (_, u) => (
        <Select
          value={u.role.id}
          style={{ width: 170 }}
          disabled={u.id === me.id}
          options={roles.map((r) => ({ value: r.id, label: r.name }))}
          onChange={(roleId) => update(u.id, { roleId }, 'Role updated - takes effect immediately')}
        />
      ),
    },
    {
      title: 'Active',
      render: (_, u) => (
        <Switch
          checked={u.isActive}
          disabled={u.id === me.id}
          onChange={(isActive) => update(u.id, { isActive }, isActive ? 'User activated' : 'User deactivated')}
        />
      ),
    },
  ];

  return (
    <Card>
      <Typography.Title level={4} style={{ marginTop: 0 }}>Users</Typography.Title>
      <Typography.Paragraph type="secondary">
        Assign roles and enable/disable logins. New users are created together with their employee record on the Employees page.
      </Typography.Paragraph>
      <Table rowKey="id" loading={loading} columns={columns} dataSource={users} scroll={{ x: true }} />
    </Card>
  );
}
