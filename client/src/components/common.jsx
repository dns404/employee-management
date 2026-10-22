import { useEffect, useState } from 'react';
import { Avatar, Card, Descriptions, Drawer, Skeleton, Tag, Timeline, Tooltip } from 'antd';
import {
  CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, MinusCircleOutlined, LockOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/client';

const STATUS = {
  PENDING: { color: 'gold', icon: <ClockCircleOutlined />, label: 'Pending' },
  APPROVED: { color: 'green', icon: <CheckCircleOutlined />, label: 'Approved' },
  REJECTED: { color: 'red', icon: <CloseCircleOutlined />, label: 'Rejected' },
  CANCELLED: { color: 'default', icon: <MinusCircleOutlined />, label: 'Cancelled' },
  ACTIVE: { color: 'green', icon: <CheckCircleOutlined />, label: 'Active' },
  INACTIVE: { color: 'default', icon: <MinusCircleOutlined />, label: 'Inactive' },
};

export const StatusTag = ({ status }) => {
  const s = STATUS[status] || {};
  return <Tag color={s.color} icon={s.icon} bordered={false}>{s.label || status}</Tag>;
};

export const fmtDate = (iso) => (iso ? dayjs(iso.slice(0, 10)).format('D MMM YYYY') : '—');
export const fmtRange = (a, b) => (a.slice(0, 10) === b.slice(0, 10) ? fmtDate(a) : `${fmtDate(a)} – ${fmtDate(b)}`);
export const fullName = (e) => (e ? `${e.firstName} ${e.lastName}` : '—');

// Working days (Mon-Fri) inclusive - mirrors the server calculation for live previews
export function workingDays(start, end) {
  let n = 0;
  for (let d = start.startOf('day'); !d.isAfter(end, 'day'); d = d.add(1, 'day')) {
    if (d.day() !== 0 && d.day() !== 6) n++;
  }
  return n;
}

const AVATAR_COLORS = ['#4f46e5', '#0891b2', '#16a34a', '#d97706', '#db2777', '#7c3aed', '#0d9488', '#ea580c'];
export function UserAvatar({ first = '', last = '', size = 36 }) {
  const initials = `${first[0] || ''}${last[0] || ''}`.toUpperCase() || '?';
  const color = AVATAR_COLORS[[...(first + last)].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
  return <Avatar size={size} style={{ background: color, flexShrink: 0, fontWeight: 600, fontSize: size * 0.38 }}>{initials}</Avatar>;
}

export function PersonCell({ person, sub, size }) {
  if (!person) return <span style={{ color: '#94a3b8' }}>—</span>;
  return (
    <div className="person">
      <UserAvatar first={person.firstName} last={person.lastName} size={size} />
      <div className="person-text">
        <div className="person-name">{fullName(person)}</div>
        {sub && <div className="person-sub">{sub}</div>}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, extra }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {extra}
    </div>
  );
}

export function StatCard({ icon, color, label, value, onClick, loading }) {
  return (
    <Card className="stat-card" hoverable={!!onClick} onClick={onClick}>
      <div className="stat-icon" style={{ background: `${color}1a`, color }}>{icon}</div>
      <div>
        {loading ? <Skeleton.Button active size="small" /> : <div className="stat-value">{value}</div>}
        <div className="stat-label">{label}</div>
      </div>
    </Card>
  );
}

// Field label that shows a lock when the current user can't edit the field
export const FieldLabel = ({ text, locked }) => (
  <span>
    {text}
    {locked && (
      <Tooltip title="You don't have permission to change this field">
        <LockOutlined style={{ marginLeft: 6, color: '#94a3b8' }} />
      </Tooltip>
    )}
  </span>
);

// Reference data loader shared by forms
export function useLookups() {
  const [data, setData] = useState({ departments: [], leaveTypes: [] });
  useEffect(() => { api.get('/lookups').then((r) => setData(r.data)); }, []);
  return data;
}

// Request details + approval history timeline
export function LeaveHistoryDrawer({ leaveId, onClose }) {
  const [leave, setLeave] = useState(null);
  useEffect(() => {
    setLeave(null);
    if (leaveId) api.get(`/leaves/${leaveId}`).then((r) => setLeave(r.data));
  }, [leaveId]);

  const dotColor = { PENDING: 'orange', APPROVED: 'green', REJECTED: 'red', CANCELLED: 'gray' };

  return (
    <Drawer title="Leave request" open={!!leaveId} onClose={onClose} width={440}>
      {!leave ? <Skeleton active /> : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <PersonCell person={leave.employee} sub={leave.employee.employeeCode} size={44} />
            <StatusTag status={leave.status} />
          </div>
          <Descriptions column={1} size="small" bordered style={{ marginBottom: 24 }}>
            <Descriptions.Item label="Type">{leave.leaveType.name}</Descriptions.Item>
            <Descriptions.Item label="Dates">{fmtRange(leave.startDate, leave.endDate)}</Descriptions.Item>
            <Descriptions.Item label="Working days">{leave.days}</Descriptions.Item>
            <Descriptions.Item label="Reason">{leave.reason}</Descriptions.Item>
          </Descriptions>
          <div className="section-title">Activity</div>
          <Timeline
            items={leave.history.map((h) => ({
              color: dotColor[h.toStatus],
              children: (
                <>
                  <div>
                    <b>{STATUS[h.toStatus].label}</b> by {h.actor.employee ? fullName(h.actor.employee) : h.actor.email}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>{dayjs(h.createdAt).format('D MMM YYYY, HH:mm')}</div>
                  {h.comment && <div style={{ marginTop: 4, padding: '6px 10px', background: '#f8fafc', borderRadius: 6 }}>{h.comment}</div>}
                </>
              ),
            }))}
          />
        </>
      )}
    </Drawer>
  );
}

// Lets pages ask the layout to refresh badge counts after an action
export const notifyCountsChanged = () => window.dispatchEvent(new Event('ems:counts'));
