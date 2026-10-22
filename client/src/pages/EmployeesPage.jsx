import { useCallback, useEffect, useState } from 'react';
import { App, Button, Card, Dropdown, Empty, Input, Segmented, Select, Table, Tag } from 'antd';
import { MoreOutlined, PlusOutlined, SearchOutlined, StopOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { useAuth } from '../auth/AuthContext';
import api, { errorMessage } from '../api/client';
import { PageHeader, PersonCell, StatusTag, fmtDate, fullName, useLookups } from '../components/common';
import EmployeeDrawer from './EmployeeDrawer';

export default function EmployeesPage() {
  const { can, user } = useAuth();
  const { message, modal } = App.useApp();
  const { departments } = useLookups();
  const [data, setData] = useState({ items: [], total: 0 });
  const [query, setQuery] = useState({ page: 1, pageSize: 10, q: '', status: 'ACTIVE', departmentId: undefined });
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null); // null | 'new' | employeeId

  const isAll = can('employee:read:all');
  const isTeam = !isAll && can('employee:read:team');
  const showFilters = isAll || isTeam;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { ...query, status: query.status === 'ALL' ? undefined : query.status };
      setData((await api.get('/employees', { params })).data);
    } catch (err) {
      message.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [query, message]);

  useEffect(() => { load(); }, [load]);

  const set = (patch) => setQuery((q) => ({ ...q, ...patch, page: 1 }));

  const deactivate = (e) => modal.confirm({
    title: `Deactivate ${fullName(e)}?`,
    content: 'Their login will be disabled immediately. Their records and history are kept.',
    okText: 'Deactivate',
    okButtonProps: { danger: true },
    onOk: async () => {
      try {
        await api.delete(`/employees/${e.id}`);
        message.success(`${fullName(e)} deactivated`);
        load();
      } catch (err) {
        message.error(errorMessage(err));
      }
    },
  });

  const columns = [
    {
      title: 'Employee',
      render: (_, e) => <PersonCell person={e} sub={e.user.email} />,
    },
    { title: 'Code', dataIndex: 'employeeCode', width: 100, responsive: ['md'], render: (c) => <span style={{ color: '#64748b' }}>{c}</span> },
    {
      title: 'Role & department',
      responsive: ['md'],
      render: (_, e) => (
        <div>
          <div>{e.jobTitle}</div>
          <div className="person-sub">{e.department.name}</div>
        </div>
      ),
    },
    { title: 'Manager', responsive: ['lg'], render: (_, e) => (e.manager ? fullName(e.manager) : <span style={{ color: '#94a3b8' }}>—</span>) },
    { title: 'Access', responsive: ['lg'], render: (_, e) => <Tag bordered={false}>{e.user.role.name}</Tag> },
    { title: 'Joined', responsive: ['xl'], render: (_, e) => fmtDate(e.hireDate) },
    { title: 'Status', render: (_, e) => <StatusTag status={e.status} /> },
    {
      title: '',
      width: 56,
      align: 'right',
      render: (_, e) => {
        // Menu renders in a portal, but React still bubbles clicks to the row - stop that
        const act = (fn) => ({ domEvent }) => { domEvent.stopPropagation(); fn(); };
        const items = [
          { key: 'open', icon: can('employee:update') ? <EditOutlined /> : <EyeOutlined />, label: can('employee:update') ? 'View & edit' : 'View', onClick: act(() => setEditing(e.id)) },
          can('employee:deactivate') && e.status === 'ACTIVE' && e.id !== user.employee?.id && {
            key: 'deactivate', icon: <StopOutlined />, label: 'Deactivate', danger: true, onClick: act(() => deactivate(e)),
          },
        ].filter(Boolean);
        return (
          <Dropdown menu={{ items }} trigger={['click']}>
            <Button type="text" icon={<MoreOutlined />} aria-label="Actions" onClick={(ev) => ev.stopPropagation()} />
          </Dropdown>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title={isAll ? 'Employees' : isTeam ? 'My team' : 'My profile'}
        subtitle={isAll ? 'Everyone in the organisation' : isTeam ? 'You and your direct reports' : 'Your employee record'}
        extra={can('employee:create') && <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing('new')}>Add employee</Button>}
      />
      <Card>
        {showFilters && (
          <div className="toolbar">
            <Input
              allowClear
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Search by name, code or title"
              style={{ width: 280, maxWidth: '100%' }}
              onChange={(e) => !e.target.value && set({ q: '' })}
              onPressEnter={(e) => set({ q: e.target.value })}
            />
            {isAll && (
              <Select
                allowClear
                placeholder="All departments"
                style={{ width: 200 }}
                value={query.departmentId}
                onChange={(departmentId) => set({ departmentId })}
                options={departments.map((d) => ({ value: d.id, label: d.name }))}
              />
            )}
            <Segmented
              value={query.status}
              onChange={(status) => set({ status })}
              options={[{ label: 'Active', value: 'ACTIVE' }, { label: 'Inactive', value: 'INACTIVE' }, { label: 'All', value: 'ALL' }]}
            />
            <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: 13 }}>{data.total} {data.total === 1 ? 'person' : 'people'}</span>
          </div>
        )}
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data.items}
          scroll={{ x: true }}
          onRow={(e) => ({ onClick: () => setEditing(e.id), style: { cursor: 'pointer' } })}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No employees match these filters" /> }}
          pagination={data.total > query.pageSize && {
            current: query.page, pageSize: query.pageSize, total: data.total, showSizeChanger: false,
            onChange: (page) => setQuery({ ...query, page }),
          }}
        />
      </Card>
      {editing && (
        <EmployeeDrawer
          employeeId={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </>
  );
}
