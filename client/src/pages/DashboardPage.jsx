import { useEffect, useState } from 'react';
import { Button, Card, Col, Empty, Row, Skeleton } from 'antd';
import { CalendarOutlined, CheckSquareOutlined, ClockCircleOutlined, PlusOutlined, TeamOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { useAuth } from '../auth/AuthContext';
import api from '../api/client';
import { PageHeader, PersonCell, StatCard, StatusTag, fmtRange } from '../components/common';
import ProfileCard from '../components/ProfileCard';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export default function DashboardPage() {
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const canApprove = can('leave:approve');
  const canApply = can('leave:create');
  const seesOthers = can('employee:read:all') || can('employee:read:team');
  const profileId = user.employee?.id;

  useEffect(() => {
    const get = (url, params) => api.get(url, { params }).then((r) => r.data);
    Promise.all([
      canApply ? get('/leaves', { view: 'mine', pageSize: 100 }) : null,
      canApprove ? get('/leaves', { view: 'team', status: 'PENDING', pageSize: 5 }) : null,
      seesOthers ? get('/employees', { status: 'ACTIVE', pageSize: 1 }) : null,
      profileId && can('employee:read') ? get(`/employees/${profileId}`) : null,
    ]).then(([mine, approvals, people, profile]) => setData({ mine, approvals, people, profile }));
  }, [canApply, canApprove, seesOthers, profileId, can]);

  const today = dayjs().format('YYYY-MM-DD');
  const myItems = data?.mine?.items || [];
  const upcoming = myItems
    .filter((l) => ['PENDING', 'APPROVED'].includes(l.status) && l.endDate.slice(0, 10) >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 5);
  const daysTakenThisYear = myItems
    .filter((l) => l.status === 'APPROVED' && l.startDate.startsWith(String(new Date().getFullYear())))
    .reduce((s, l) => s + l.days, 0);

  const stats = [
    canApply && { icon: <ClockCircleOutlined />, color: '#d97706', label: 'My pending requests', value: myItems.filter((l) => l.status === 'PENDING').length, to: '/leaves' },
    canApply && { icon: <CalendarOutlined />, color: '#16a34a', label: `Approved days in ${new Date().getFullYear()}`, value: daysTakenThisYear, to: '/leaves' },
    canApprove && { icon: <CheckSquareOutlined />, color: '#4f46e5', label: 'Awaiting my approval', value: data?.approvals?.total ?? 0, to: '/approvals' },
    seesOthers && { icon: <TeamOutlined />, color: '#0891b2', label: can('employee:read:all') ? 'Active employees' : 'Team members (incl. me)', value: data?.people?.total ?? 0, to: '/employees' },
  ].filter(Boolean);

  const first = user.employee?.name?.split(' ')[0];

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${first || user.email}`}
        subtitle={dayjs().format('dddd, D MMMM YYYY')}
        extra={canApply && <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/leaves?apply=1')}>Request leave</Button>}
      />

      <Row gutter={[16, 16]}>
        {stats.map((s) => (
          <Col xs={24} sm={12} xl={24 / Math.min(stats.length, 4)} key={s.label}>
            <StatCard {...s} loading={!data} onClick={() => navigate(s.to)} />
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {canApprove && (
          <Col xs={24} lg={12}>
            <Card title="Awaiting your approval" extra={<Button type="link" onClick={() => navigate('/approvals')}>View all <ArrowRightOutlined /></Button>} style={{ height: '100%' }}>
              {!data ? <Skeleton active /> : data.approvals.items.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="You're all caught up" />
              ) : data.approvals.items.map((l) => (
                <div className="list-row" key={l.id}>
                  <PersonCell person={l.employee} sub={`${l.leaveType.name} · ${fmtRange(l.startDate, l.endDate)} · ${l.days}d`} />
                  <Button size="small" onClick={() => navigate('/approvals')}>Review</Button>
                </div>
              ))}
            </Card>
          </Col>
        )}
        {canApply && (
          <Col xs={24} lg={canApprove ? 12 : 24}>
            <Card title="My upcoming leave" extra={<Button type="link" onClick={() => navigate('/leaves')}>View all <ArrowRightOutlined /></Button>} style={{ height: '100%' }}>
              {!data ? <Skeleton active /> : upcoming.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No upcoming leave">
                  <Button onClick={() => navigate('/leaves?apply=1')}>Request leave</Button>
                </Empty>
              ) : upcoming.map((l) => (
                <div className="list-row" key={l.id}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{l.leaveType.name} leave</div>
                    <div className="person-sub">{fmtRange(l.startDate, l.endDate)} · {l.days} working day{l.days > 1 ? 's' : ''}</div>
                  </div>
                  <StatusTag status={l.status} />
                </div>
              ))}
            </Card>
          </Col>
        )}
        {user.employee && can('employee:read') && (
          <Col xs={24}>
            <ProfileCard
              title="My profile"
              employee={data?.profile}
              extra={<Button type="link" onClick={() => navigate('/profile')}>View profile <ArrowRightOutlined /></Button>}
            />
          </Col>
        )}
      </Row>
    </>
  );
}
