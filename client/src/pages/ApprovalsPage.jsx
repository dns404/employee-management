import { useCallback, useEffect, useState } from 'react';
import { App, Button, Card, Form, Input, Modal, Segmented, Space, Table, Typography } from 'antd';
import { useAuth } from '../auth/AuthContext';
import api, { errorMessage } from '../api/client';
import { LeaveHistoryDrawer, StatusTag, fmtDate, fullName } from '../components/common';

const FILTERS = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'ALL'];

export default function ApprovalsPage() {
  const { user } = useAuth();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [status, setStatus] = useState('PENDING');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [decision, setDecision] = useState(null); // { leave, action: 'approve' | 'reject' }
  const [saving, setSaving] = useState(false);
  const [historyId, setHistoryId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { view: 'team', page, pageSize: 10, ...(status !== 'ALL' && { status }) };
      setData((await api.get('/leaves', { params })).data);
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => { load(); }, [load]);

  const decide = async ({ comment }) => {
    setSaving(true);
    try {
      await api.post(`/leaves/${decision.leave.id}/${decision.action}`, { comment });
      message.success(`Request ${decision.action === 'approve' ? 'approved' : 'rejected'}`);
      setDecision(null);
      form.resetFields();
      load();
    } catch (err) {
      message.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { title: 'Employee', render: (_, l) => `${fullName(l.employee)} (${l.employee.employeeCode})` },
    { title: 'Type', render: (_, l) => l.leaveType.name },
    { title: 'Dates', render: (_, l) => `${fmtDate(l.startDate)} → ${fmtDate(l.endDate)}` },
    { title: 'Days', dataIndex: 'days', width: 70 },
    { title: 'Reason', dataIndex: 'reason', ellipsis: true, responsive: ['lg'] },
    { title: 'Status', render: (_, l) => <StatusTag status={l.status} /> },
    {
      title: 'Actions',
      render: (_, l) => {
        const own = l.employee.id === user.employee?.id;
        return (
          <Space>
            <Button size="small" onClick={() => setHistoryId(l.id)}>History</Button>
            {l.status === 'PENDING' && !own && (
              <>
                <Button size="small" type="primary" onClick={() => setDecision({ leave: l, action: 'approve' })}>Approve</Button>
                <Button size="small" danger onClick={() => setDecision({ leave: l, action: 'reject' })}>Reject</Button>
              </>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <Card>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <Typography.Title level={4} style={{ margin: 0 }}>Leave approvals</Typography.Title>
        <Segmented options={FILTERS} value={status} onChange={(v) => { setStatus(v); setPage(1); }} />
      </Space>
      <Table
        rowKey="id" loading={loading} columns={columns} dataSource={data.items} scroll={{ x: true }}
        pagination={{ current: page, pageSize: 10, total: data.total, onChange: setPage }}
      />

      <Modal
        open={!!decision}
        title={decision?.action === 'approve' ? 'Approve leave request' : 'Reject leave request'}
        okText={decision?.action === 'approve' ? 'Approve' : 'Reject'}
        okButtonProps={{ danger: decision?.action === 'reject' }}
        onOk={form.submit}
        onCancel={() => { setDecision(null); form.resetFields(); }}
        confirmLoading={saving}
      >
        {decision && (
          <Typography.Paragraph>
            {fullName(decision.leave.employee)} — {decision.leave.leaveType.name}, {fmtDate(decision.leave.startDate)} → {fmtDate(decision.leave.endDate)} ({decision.leave.days} days)
          </Typography.Paragraph>
        )}
        <Form form={form} layout="vertical" onFinish={decide}>
          <Form.Item
            name="comment"
            label={decision?.action === 'reject' ? 'Reason for rejection' : 'Comment (optional)'}
            rules={decision?.action === 'reject' ? [{ required: true, min: 3, message: 'Please give a reason (min 3 characters)' }] : []}
          >
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>
      <LeaveHistoryDrawer leaveId={historyId} onClose={() => setHistoryId(null)} />
    </Card>
  );
}
