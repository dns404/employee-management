import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Input, Select, Switch, Table, Tag, Tooltip } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useAuth } from '../auth/AuthContext';
import api, { errorMessage } from '../api/client';
import { PageHeader, PersonCell } from '../components/common';

export default function UsersPage() {
  const { user: me } = useAuth();
  const { message, modal } = App.useApp();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [u, r] = await Promise.all([api.get('/users'), api.get('/roles')]);
      setUsers(u.data);
      setRoles(r.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = async (u, body, success) => {
    try {
      await api.patch(`/users/${u.id}`, body);
      message.success(success);
    } catch (err) {
      message.error(errorMessage(err));
    }
    load();
  };

  const changeRole = (u, roleId) => {
    const role = roles.find((r) => r.id === roleId);
    modal.confirm({
      title: `Change ${u.employee?.firstName || u.email}'s role to ${role.name}?`,
      content: 'Their permissions change immediately and they will need to sign in again.',
      okText: 'Change role',
      onOk: () => update(u, { roleId }, `Role changed to ${role.name}`),
    });
  };

  const toggleActive = (u, isActive) => {
    if (isActive) return update(u, { isActive }, 'Account activated');
    modal.confirm({
      title: `Deactivate ${u.email}?`,
      content: 'They will be signed out and unable to log in until reactivated.',
      okText: 'Deactivate',
      okButtonProps: { danger: true },
      onOk: () => update(u, { isActive }, 'Account deactivated'),
    });
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u) => !q || u.email.toLowerCase().includes(q)
      || `${u.employee?.firstName} ${u.employee?.lastName}`.toLowerCase().includes(q));
  }, [users, search]);

  const columns = [
    {
      title: 'User',
      render: (_, u) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <PersonCell person={u.employee} sub={u.email} />
          {u.id === me.id && <Tag color="purple" bordered={false}>You</Tag>}
        </span>
      ),
    },
    { title: 'Code', responsive: ['md'], render: (_, u) => <span style={{ color: '#64748b' }}>{u.employee?.employeeCode}</span> },
    {
      title: 'Role',
      render: (_, u) => (
        <Tooltip title={u.id === me.id ? "You can't change your own role" : undefined}>
          <Select
            value={u.role.id}
            style={{ width: 180 }}
            disabled={u.id === me.id}
            options={roles.map((r) => ({ value: r.id, label: r.name }))}
            onChange={(roleId) => changeRole(u, roleId)}
          />
        </Tooltip>
      ),
    },
    {
      title: 'Login enabled',
      render: (_, u) => (
        <Tooltip title={u.id === me.id ? "You can't deactivate yourself" : undefined}>
          <Switch checked={u.isActive} disabled={u.id === me.id} onChange={(v) => toggleActive(u, v)} />
        </Tooltip>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Users" subtitle="Assign roles and control who can sign in. New users are added from the Employees page." />
      <Card>
        <div className="toolbar">
          <Input
            allowClear
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            placeholder="Search by name or email"
            style={{ width: 280, maxWidth: '100%' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: 13 }}>
            {users.filter((u) => u.isActive).length} active · {users.length} total
          </span>
        </div>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filtered}
          scroll={{ x: true }}
          pagination={filtered.length > 10 && { pageSize: 10, showSizeChanger: false }}
          rowClassName={(u) => (u.isActive ? '' : 'row-inactive')}
        />
      </Card>
    </>
  );
}
