import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Card, Col, DatePicker, Drawer, Empty, Form, Input, Radio, Row, Segmented, Table } from 'antd';
import { CalendarOutlined, CheckCircleOutlined, ClockCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import api, { applyFieldErrors, errorMessage } from '../api/client';
import { LeaveHistoryDrawer, PageHeader, StatCard, StatusTag, fmtRange, useLookups, workingDays } from '../components/common';

export default function MyLeavesPage() {
  const { message, modal } = App.useApp();
  const { leaveTypes } = useLookups();
  const [form] = Form.useForm();
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [historyId, setHistoryId] = useState(null);
  const applying = params.get('apply') === '1';
  const range = Form.useWatch('range', form);

  const setApplying = (open) => setParams(open ? { apply: '1' } : {}, { replace: true });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems((await api.get('/leaves', { params: { view: 'mine', pageSize: 100 } })).data.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const year = String(new Date().getFullYear());
  const summary = useMemo(() => ({
    pending: items.filter((l) => l.status === 'PENDING').length,
    approvedDays: items.filter((l) => l.status === 'APPROVED' && l.startDate.startsWith(year)).reduce((s, l) => s + l.days, 0),
    total: items.length,
  }), [items, year]);

  const visible = filter === 'ALL' ? items : items.filter((l) => l.status === filter);
  const previewDays = range?.[0] && range?.[1] ? workingDays(range[0], range[1]) : null;

  const submit = async ({ leaveTypeId, range: [start, end], reason }) => {
    setSaving(true);
    try {
      await api.post('/leaves', { leaveTypeId, reason, startDate: start.format('YYYY-MM-DD'), endDate: end.format('YYYY-MM-DD') });
      message.success('Leave request submitted for approval');
      setApplying(false);
      form.resetFields();
      load();
    } catch (err) {
      if (!applyFieldErrors(form, err)) message.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const cancel = (l) => modal.confirm({
    title: 'Cancel this leave request?',
    content: `${l.leaveType.name} leave, ${fmtRange(l.startDate, l.endDate)}`,
    okText: 'Cancel request',
    okButtonProps: { danger: true },
    cancelText: 'Keep it',
    onOk: async () => {
      try {
        await api.post(`/leaves/${l.id}/cancel`);
        message.success('Request cancelled');
        load();
      } catch (err) {
        message.error(errorMessage(err));
      }
    },
  });

  const columns = [
    {
      title: 'Leave',
      render: (_, l) => (
        <div>
          <div style={{ fontWeight: 500 }}>{l.leaveType.name}</div>
          <div className="person-sub">{fmtRange(l.startDate, l.endDate)}</div>
        </div>
      ),
    },
    { title: 'Days', dataIndex: 'days', width: 80, align: 'center' },
    { title: 'Reason', dataIndex: 'reason', ellipsis: true, responsive: ['md'] },
    { title: 'Submitted', responsive: ['lg'], render: (_, l) => <span title={dayjs(l.createdAt).format('D MMM YYYY HH:mm')}>{dayjs(l.createdAt).fromNow()}</span> },
    { title: 'Status', render: (_, l) => <StatusTag status={l.status} /> },
    {
      title: '',
      align: 'right',
      render: (_, l) => (
        <>
          <Button type="link" size="small" onClick={() => setHistoryId(l.id)}>Details</Button>
          {l.status === 'PENDING' && <Button type="link" size="small" danger onClick={() => cancel(l)}>Cancel</Button>}
        </>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="My leave"
        subtitle="Request time off and track approvals"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setApplying(true)}>Request leave</Button>}
      />
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><StatCard icon={<ClockCircleOutlined />} color="#d97706" label="Pending approval" value={summary.pending} loading={loading} /></Col>
        <Col xs={24} sm={8}><StatCard icon={<CheckCircleOutlined />} color="#16a34a" label={`Approved days in ${year}`} value={summary.approvedDays} loading={loading} /></Col>
        <Col xs={24} sm={8}><StatCard icon={<CalendarOutlined />} color="#4f46e5" label="Total requests" value={summary.total} loading={loading} /></Col>
      </Row>
      <Card>
        <div className="toolbar">
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { label: 'All', value: 'ALL' }, { label: 'Pending', value: 'PENDING' }, { label: 'Approved', value: 'APPROVED' },
              { label: 'Rejected', value: 'REJECTED' }, { label: 'Cancelled', value: 'CANCELLED' },
            ]}
          />
        </div>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={visible}
          scroll={{ x: true }}
          pagination={visible.length > 10 && { pageSize: 10, showSizeChanger: false }}
          locale={{
            emptyText: (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={filter === 'ALL' ? "You haven't requested any leave yet" : 'No requests with this status'}>
                {filter === 'ALL' && <Button type="primary" onClick={() => setApplying(true)}>Request leave</Button>}
              </Empty>
            ),
          }}
        />
      </Card>

      <Drawer
        title="Request leave"
        open={applying}
        onClose={() => setApplying(false)}
        width={480}
        footer={(
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setApplying(false)}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={form.submit} disabled={previewDays === 0}>Submit request</Button>
          </div>
        )}
      >
        <Form form={form} layout="vertical" onFinish={submit} requiredMark={false}>
          <Form.Item name="leaveTypeId" label="Leave type" rules={[{ required: true, message: 'Choose a leave type' }]}>
            <Radio.Group optionType="button" buttonStyle="solid" options={leaveTypes.map((t) => ({ value: t.id, label: t.name }))} />
          </Form.Item>
          <Form.Item name="range" label="Dates" rules={[{ required: true, message: 'Select the first and last day' }]}>
            <DatePicker.RangePicker style={{ width: '100%' }} format="D MMM YYYY" disabledDate={(d) => d.isBefore(dayjs(), 'day')} />
          </Form.Item>
          {previewDays != null && (
            <Alert
              style={{ marginBottom: 24 }}
              showIcon
              type={previewDays ? 'info' : 'warning'}
              message={previewDays
                ? `${previewDays} working day${previewDays > 1 ? 's' : ''} will be requested`
                : 'This range only covers a weekend - pick at least one working day'}
              description={previewDays ? 'Weekends are not counted.' : undefined}
            />
          )}
          <Form.Item name="reason" label="Reason" rules={[{ required: true, message: 'Add a short reason' }, { min: 3, max: 500 }]}>
            <Input.TextArea rows={4} showCount maxLength={500} placeholder="e.g. Family trip" />
          </Form.Item>
          <Alert type="success" showIcon={false} style={{ background: '#f8fafc', border: 0 }} message="Your request goes to your manager for approval. You can cancel it while it's pending." />
        </Form>
      </Drawer>
      <LeaveHistoryDrawer leaveId={historyId} onClose={() => setHistoryId(null)} />
    </>
  );
}
