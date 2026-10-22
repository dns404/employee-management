import { useEffect, useState } from 'react';
import { Tag, Drawer, Timeline, Typography, Spin } from 'antd';
import api from '../api/client';

const STATUS_COLORS = { PENDING: 'gold', APPROVED: 'green', REJECTED: 'red', CANCELLED: 'default', ACTIVE: 'green', INACTIVE: 'default' };

export const StatusTag = ({ status }) => <Tag color={STATUS_COLORS[status]}>{status}</Tag>;

export const fmtDate = (iso) => (iso ? iso.slice(0, 10) : '');
export const fullName = (e) => (e ? `${e.firstName} ${e.lastName}` : '-');

// Reference data loader shared by forms
export function useLookups() {
  const [data, setData] = useState({ departments: [], leaveTypes: [] });
  useEffect(() => { api.get('/lookups').then((r) => setData(r.data)); }, []);
  return data;
}

// Approval history timeline for one leave request
export function LeaveHistoryDrawer({ leaveId, onClose }) {
  const [leave, setLeave] = useState(null);
  useEffect(() => {
    setLeave(null);
    if (leaveId) api.get(`/leaves/${leaveId}`).then((r) => setLeave(r.data));
  }, [leaveId]);

  return (
    <Drawer title="Request history" open={!!leaveId} onClose={onClose} width={420}>
      {!leave ? <Spin /> : (
        <>
          <Typography.Paragraph>
            <b>{fullName(leave.employee)}</b> — {leave.leaveType.name}, {fmtDate(leave.startDate)} → {fmtDate(leave.endDate)} ({leave.days} days)
            <br />Reason: {leave.reason}
          </Typography.Paragraph>
          <Timeline
            items={leave.history.map((h) => ({
              color: STATUS_COLORS[h.toStatus] === 'default' ? 'gray' : STATUS_COLORS[h.toStatus],
              children: (
                <>
                  <StatusTag status={h.toStatus} /> by {h.actor.employee ? fullName(h.actor.employee) : h.actor.email}
                  <div style={{ color: '#888', fontSize: 12 }}>{new Date(h.createdAt).toLocaleString()}</div>
                  {h.comment && <div>“{h.comment}”</div>}
                </>
              ),
            }))}
          />
        </>
      )}
    </Drawer>
  );
}
