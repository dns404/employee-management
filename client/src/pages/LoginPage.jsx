import { useState } from 'react';
import { Alert, Button, Card, Form, Input, Space, Typography } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { useAuth } from '../auth/AuthContext';
import { errorMessage } from '../api/client';

const DEMO = [
  ['Administrator', 'admin@ems.local'],
  ['Manager', 'manager@ems.local'],
  ['Employee', 'employee@ems.local'],
];

export default function LoginPage() {
  const { login } = useAuth();
  const [form] = Form.useForm();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async ({ email, password }) => {
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f5f7fb', padding: 16 }}>
      <Card style={{ width: '100%', maxWidth: 380 }}>
        <Typography.Title level={3} style={{ marginTop: 0 }}>Employee Management</Typography.Title>
        <Typography.Paragraph type="secondary">Sign in to continue</Typography.Paragraph>
        {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}
        <Form form={form} layout="vertical" onFinish={submit} requiredMark={false}>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input prefix={<MailOutlined />} autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true }]}>
            <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>Sign in</Button>
        </Form>
        <Typography.Paragraph type="secondary" style={{ marginTop: 24, marginBottom: 8, fontSize: 12 }}>
          Demo accounts (password <code>Password@123</code>):
        </Typography.Paragraph>
        <Space wrap>
          {DEMO.map(([role, email]) => (
            <Button key={role} size="small" onClick={() => form.setFieldsValue({ email, password: 'Password@123' })}>{role}</Button>
          ))}
        </Space>
      </Card>
    </div>
  );
}
