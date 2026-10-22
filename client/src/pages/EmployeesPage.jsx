import { useCallback, useEffect, useState } from 'react';
import { App, Button, Card, Input, Popconfirm, Space, Table, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useAuth } from '../auth/AuthContext';
import api, { errorMessage } from '../api/client';
import { StatusTag, fmtDate, fullName } from '../components/common';
import EmployeeFormModal from './EmployeeFormModal';

export default function EmployeesPage() {
  const { can, user } = useAuth();
  const { message } = App.useApp();
  const [data, setData] = useState({ items: [], total: 0 });
  const [query, setQuery] = useState({ page: 1, pageSize: 10, q: '' });
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null); // null | 'new' | employeeId

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get('/employees', { params: query });
      setData(res);
    } catch (err) {
      message.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [query, message]);

  useEffect(() => { load(); }, [load]);

  const deactivate = async (id) => {
    try {
      await api.delete(`/employees/${id}`);
      message.success('Employee deactivated');
      load();
    } catch (err) {
      message.error(errorMessage(err));
    }
  };

  const columns = [
    { title: 'Code', dataIndex: 'employeeCode', width: 100 },
    { title: 'Name', render: (_, e) => fullName(e) },
    { title: 'Job title', dataIndex: 'jobTitle', responsive: ['md'] },
    { title: 'Department', render: (_, e) => e.department.name, responsive: ['lg'] },
    { title: 'Manager', render: (_, e) => fullName(e.manager), responsive: ['lg'] },
    { title: 'Role', render: (_, e) => e.user.role.name, responsive: ['md'] },
    { title: 'Hired', render: (_, e) => fmtDate(e.hireDate), responsive: ['xl'] },
    { title: 'Status', render: (_, e) => <StatusTag status={e.status} /> },
    {
      title: 'Actions',
      render: (_, e) => (
        <Space>
          <Button size="small" onClick={() => setEditing(e.id)}>{can('employee:update') ? 'View / Edit' : 'View'}</Button>
          {can('employee:deactivate') && e.status === 'ACTIVE' && e.id !== user.employee?.id && (
            <Popconfirm title="Deactivate this employee and disable their login?" onConfirm={() => deactivate(e.id)}>
              <Button size="small" danger>Deactivate</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <Typography.Title level={4} style={{ margin: 0 }}>Employees</Typography.Title>
        <Space wrap>
          {data.total > 1 && (
            <Input.Search allowClear placeholder="Search name, code, title" onSearch={(q) => setQuery({ ...query, q, page: 1 })} style={{ width: 240 }} />
          )}
          {can('employee:create') && <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing('new')}>Add employee</Button>}
        </Space>
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={data.items}
        scroll={{ x: true }}
        pagination={{
          current: query.page, pageSize: query.pageSize, total: data.total,
          onChange: (page, pageSize) => setQuery({ ...query, page, pageSize }),
        }}
      />
      {editing && (
        <EmployeeFormModal
          employeeId={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </Card>
  );
}
