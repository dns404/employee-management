import { useCallback, useEffect, useState } from 'react';
import { App, Button, Card, DatePicker, Form, Input, Modal, Popconfirm, Select, Space, Table, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api, { applyFieldErrors, errorMessage } from '../api/client';
import { LeaveHistoryDrawer, StatusTag, fmtDate, useLookups } from '../components/common';

export default function MyLeavesPage() {
  const { message } = App.useApp();
  const { leaveTypes } = useLookups();
  const [form] = Form.useForm();
  const [data, setData] = useState({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [historyId, setHistoryId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get('/leaves', { params: { view: 'mine', page, pageSize: 10 } });
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const submit = async ({ leaveTypeId, range, reason }) => {
    setSaving(true);
    try {
      await api.post('/leaves', {
        leaveTypeId, reason, startDate: range[0].format('YYYY-MM-DD'), endDate: range[1].format('YYYY-MM-DD'),
      });
      message.success('Leave request submitted');
      setApplying(false);
      form.resetFields();
      load();
    } catch (err) {
      if (!applyFieldErrors(form, err)) message.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (id) => {
    try {
      await api.post(`/leaves/${id}/cancel`);
      message.success('Request cancelled');
      load();
    } catch (err) {
      message.error(errorMessage(err));
    }
  };

  const columns = [
    { title: 'Type', render: (_, l) => l.leaveType.name },
    { title: 'From', render: (_, l) => fmtDate(l.startDate) },
    { title: 'To', render: (_, l) => fmtDate(l.endDate) },
    { title: 'Days', dataIndex: 'days', width: 70 },
    { title: 'Reason', dataIndex: 'reason', ellipsis: true, responsive: ['md'] },
    { title: 'Status', render: (_, l) => <StatusTag status={l.status} /> },
    {
      title: 'Actions',
      render: (_, l) => (
        <Space>
          <Button size="small" onClick={() => setHistoryId(l.id)}>History</Button>
          {l.status === 'PENDING' && (
            <Popconfirm title="Cancel this request?" onConfirm={() => cancel(l.id)}>
              <Button size="small" danger>Cancel</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>My leave requests</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setApplying(true)}>Apply for leave</Button>
      </Space>
      <Table
        rowKey="id" loading={loading} columns={columns} dataSource={data.items} scroll={{ x: true }}
        pagination={{ current: page, pageSize: 10, total: data.total, onChange: setPage }}
      />

      <Modal title="Apply for leave" open={applying} onOk={form.submit} onCancel={() => setApplying(false)} confirmLoading={saving} okText="Submit">
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item name="leaveTypeId" label="Leave type" rules={[{ required: true }]}>
            <Select options={leaveTypes.map((t) => ({ value: t.id, label: t.name }))} />
          </Form.Item>
          <Form.Item name="range" label="Dates" rules={[{ required: true, message: 'Select start and end dates' }]}>
            <DatePicker.RangePicker style={{ width: '100%' }} disabledDate={(d) => d.isBefore(dayjs(), 'day')} />
          </Form.Item>
          <Form.Item name="reason" label="Reason" rules={[{ required: true, min: 3, max: 500 }]}>
            <Input.TextArea rows={3} showCount maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
      <LeaveHistoryDrawer leaveId={historyId} onClose={() => setHistoryId(null)} />
    </Card>
  );
}
