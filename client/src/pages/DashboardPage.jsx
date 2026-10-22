import { useEffect, useState } from 'react';
import { Card, Col, Descriptions, Row, Statistic, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import api from '../api/client';

export default function DashboardPage() {
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({});

  useEffect(() => {
    const total = (url) => api.get(url).then((r) => r.data.total);
    Promise.all([
      can('leave:create') ? total('/leaves?view=mine&status=PENDING&pageSize=1') : null,
      can('leave:approve') ? total('/leaves?view=team&status=PENDING&pageSize=1') : null,
      can('employee:read:all') || can('employee:read:team') ? total('/employees?pageSize=1&status=ACTIVE') : null,
    ]).then(([myPending, toApprove, people]) => setStats({ myPending, toApprove, people }));
  }, [can]);

  const tiles = [
    stats.myPending != null && { title: 'My pending requests', value: stats.myPending, to: '/leaves' },
    stats.toApprove != null && { title: 'Awaiting my approval', value: stats.toApprove, to: '/approvals' },
    stats.people != null && { title: can('employee:read:all') ? 'Active employees' : 'Team (incl. me)', value: stats.people, to: '/employees' },
  ].filter(Boolean);

  return (
    <>
      <Typography.Title level={3}>Welcome, {user.employee?.name?.split(' ')[0] || user.email}</Typography.Title>
      <Row gutter={[16, 16]}>
        {tiles.map((t) => (
          <Col xs={24} sm={12} lg={8} key={t.title}>
            <Card hoverable onClick={() => navigate(t.to)}><Statistic title={t.title} value={t.value} /></Card>
          </Col>
        ))}
      </Row>
      {user.employee && (
        <Card title="My profile" style={{ marginTop: 16 }}>
          <Descriptions column={{ xs: 1, md: 2 }}>
            <Descriptions.Item label="Employee code">{user.employee.employeeCode}</Descriptions.Item>
            <Descriptions.Item label="Role">{user.role}</Descriptions.Item>
            <Descriptions.Item label="Job title">{user.employee.jobTitle}</Descriptions.Item>
            <Descriptions.Item label="Department">{user.employee.department}</Descriptions.Item>
            <Descriptions.Item label="Manager">{user.employee.manager || '—'}</Descriptions.Item>
            <Descriptions.Item label="Email">{user.email}</Descriptions.Item>
          </Descriptions>
        </Card>
      )}
    </>
  );
}
