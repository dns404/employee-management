import { useCallback, useEffect, useState } from 'react';
import { App, Button, Card, Descriptions, Empty, Form, Input, Modal, Segmented, Table, Tooltip } from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined, LockOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '../auth/AuthContext';
import api, { errorMessage } from '../api/client';
import { LeaveHistoryDrawer, PageHeader, PersonCell, StatusTag, fmtRange, notifyCountsChanged } from '../components/common';

const FILTERS = [
  { label: 'Pending', value: 'PENDING' }, { label: 'Approved', value: 'APPROVED' }, { label: 'Rejected', value: 'REJECTED' },
  { label: 'Cancelled', value: 'CANCELLED' }, { label: 'All', value: 'ALL' },
];

export default function ApprovalsPage() {
  const { user, can } = useAuth();
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

  const closeDecision = () => { setDecision(null); form.resetFields(); };

  const decide = async ({ comment }) => {
    setSaving(true);
    try {
      await api.post(`/leaves/${decision.leave.id}/${decision.action}`, { comment });
      message.success(`Request from ${decision.leave.employee.firstName} ${decision.action === 'approve' ? 'approved' : 'rejected'}`);
      closeDecision();
      load();
      notifyCountsChanged();
    } catch (err) {
      message.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { title: 'Employee', render: (_, l) => <PersonCell person={l.employee} sub={l.employee.employeeCode} /> },
    {
      title: 'Leave',
      render: (_, l) => (
        <div>
          <div style={{ fontWeight: 500 }}>{l.leaveType.name} · {l.days} day{l.days > 1 ? 's' : ''}</div>
          <div className="person-sub">{fmtRange(l.startDate, l.endDate)}</div>
        </div>
      ),
    },
    { title: 'Reason', dataIndex: 'reason', ellipsis: true, responsive: ['lg'] },
    { title: 'Requested', responsive: ['md'], render: (_, l) => dayjs(l.createdAt).fromNow() },
    { title: 'Status', render: (_, l) => <StatusTag status={l.status} /> },
    {
      title: 'Actions',
      align: 'right',
      fixed: 'right',
      width: 250,
      render: (_, l) => {
        const own = l.employee.id === user.employee?.id;
        const name = l.employee.firstName;
        return (
          <div className="row-actions">
            {l.status === 'PENDING' && (own ? (
              <Tooltip title="Someone else must review your own request">
                <span className="own-request"><LockOutlined /> Your request</span>
              </Tooltip>
            ) : (
              <>
                <Button
                  className="act-btn act-approve" icon={<CheckOutlined />} aria-label={`Approve ${name}'s request`}
                  onClick={() => setDecision({ leave: l, action: 'approve' })}
                >Approve</Button>
                <Button
                  className="act-btn act-reject" icon={<CloseOutlined />} aria-label={`Reject ${name}'s request`}
                  onClick={() => setDecision({ leave: l, action: 'reject' })}
                >Reject</Button>
              </>
            ))}
            <Tooltip title="View details & history">
              <Button className="act-btn act-details" icon={<EyeOutlined />} aria-label={`View ${name}'s request details`} onClick={() => setHistoryId(l.id)} />
            </Tooltip>
          </div>
        );
      },
    },
  ];

  const approving = decision?.action === 'approve';

  return (
    <>
      <PageHeader
        title="Leave approvals"
        subtitle={can('leave:approve:all') ? 'Review leave requests across the organisation' : 'Review leave requests from your direct reports'}
      />
      <Card>
        <div className="toolbar">
          <Segmented options={FILTERS} value={status} onChange={(v) => { setStatus(v); setPage(1); }} />
        </div>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data.items}
          scroll={{ x: true }}
          locale={{
            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={status === 'PENDING' ? "Nothing waiting for you - you're all caught up" : 'No requests with this status'} />,
          }}
          pagination={data.total > 10 && { current: page, pageSize: 10, total: data.total, onChange: setPage, showSizeChanger: false }}
        />
      </Card>

      <Modal
        open={!!decision}
        title={approving ? 'Approve leave request' : 'Reject leave request'}
        okText={approving ? 'Approve' : 'Reject request'}
        okButtonProps={{ color: approving ? 'green' : 'danger', variant: 'solid', icon: approving ? <CheckOutlined /> : <CloseOutlined /> }}
        onOk={form.submit}
        onCancel={closeDecision}
        confirmLoading={saving}
        destroyOnHidden
      >
        {decision && (
          <>
            <div style={{ margin: '16px 0' }}><PersonCell person={decision.leave.employee} sub={decision.leave.employee.employeeCode} size={40} /></div>
            <Descriptions column={1} size="small" bordered style={{ marginBottom: 20 }}>
              <Descriptions.Item label="Type">{decision.leave.leaveType.name}</Descriptions.Item>
              <Descriptions.Item label="Dates">{fmtRange(decision.leave.startDate, decision.leave.endDate)}</Descriptions.Item>
              <Descriptions.Item label="Working days">{decision.leave.days}</Descriptions.Item>
              <Descriptions.Item label="Reason">{decision.leave.reason}</Descriptions.Item>
            </Descriptions>
          </>
        )}
        <Form form={form} layout="vertical" onFinish={decide} requiredMark={false}>
          <Form.Item
            name="comment"
            label={approving ? 'Note to employee (optional)' : 'Reason for rejection'}
            rules={approving ? [] : [{ required: true, message: 'Let the employee know why' }, { min: 3, message: 'At least 3 characters' }]}
          >
            <Input.TextArea rows={3} maxLength={500} showCount placeholder={approving ? 'e.g. Enjoy your time off' : 'e.g. Release week - please pick other dates'} />
          </Form.Item>
        </Form>
      </Modal>
      <LeaveHistoryDrawer leaveId={historyId} onClose={() => setHistoryId(null)} />
    </>
  );
}
