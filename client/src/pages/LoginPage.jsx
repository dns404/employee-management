import { useState } from 'react';
import { Alert, Button, Form, Input, Typography } from 'antd';
import { LockOutlined, MailOutlined, SafetyCertificateOutlined, TeamOutlined, UserOutlined, CheckCircleFilled } from '@ant-design/icons';
import { useAuth } from '../auth/AuthContext';
import { errorMessage } from '../api/client';

const DEMO_PASSWORD = 'Password@123';
const DEMO = [
  { role: 'Administrator', email: 'admin@ems.local', desc: 'Full access, users & roles', icon: <SafetyCertificateOutlined />, color: '#4f46e5' },
  { role: 'Manager', email: 'manager@ems.local', desc: 'Team & leave approvals', icon: <TeamOutlined />, color: '#0891b2' },
  { role: 'Employee', email: 'employee@ems.local', desc: 'Own profile & leave', icon: <UserOutlined />, color: '#16a34a' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [form] = Form.useForm();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const email = Form.useWatch('email', form);

  const submit = async (values) => {
    setLoading(true);
    setError(null);
    try {
      await login(values.email, values.password);
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="login-hero">
        <div className="brand" style={{ padding: 0 }}>
          <div className="brand-mark">E</div>
          <div className="brand-name">EMS</div>
        </div>
        <div>
          <h2>People, leave and access —<br />managed in one place.</h2>
          <ul>
            {['Role-based access to every record', 'Leave requests with a full approval trail', 'Configurable roles & permissions'].map((t) => (
              <li key={t}><CheckCircleFilled style={{ color: '#a5b4fc', marginRight: 10 }} />{t}</li>
            ))}
          </ul>
        </div>
        <div style={{ color: '#a5b4fc', fontSize: 12 }}>Employee Management System</div>
      </div>

      <div className="login-form">
        <div className="login-form-inner">
          <Typography.Title level={2} style={{ marginBottom: 4 }}>Welcome back</Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 28 }}>Sign in to your account to continue.</Typography.Paragraph>

          {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 20 }} />}

          <Form form={form} layout="vertical" onFinish={submit} requiredMark={false} size="large">
            <Form.Item name="email" label="Work email" rules={[{ required: true, message: 'Enter your email' }, { type: 'email', message: 'Enter a valid email' }]}>
              <Input prefix={<MailOutlined style={{ color: '#94a3b8' }} />} placeholder="you@company.com" autoComplete="username" autoFocus />
            </Form.Item>
            <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Enter your password' }]}>
              <Input.Password prefix={<LockOutlined style={{ color: '#94a3b8' }} />} placeholder="••••••••" autoComplete="current-password" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading} style={{ marginTop: 4 }}>Sign in</Button>
          </Form>

          <div className="section-title" style={{ marginTop: 36 }}>Try a demo account</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {DEMO.map((d) => (
              <div
                key={d.role}
                role="button"
                tabIndex={0}
                className={`demo-card ${email === d.email ? 'active' : ''}`}
                onClick={() => { form.setFieldsValue({ email: d.email, password: DEMO_PASSWORD }); setError(null); }}
                onKeyDown={(e) => e.key === 'Enter' && form.setFieldsValue({ email: d.email, password: DEMO_PASSWORD })}
              >
                <div className="stat-icon" style={{ width: 36, height: 36, fontSize: 16, borderRadius: 8, background: `${d.color}1a`, color: d.color }}>{d.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500 }}>{d.role}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{d.desc}</div>
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>{d.email}</div>
              </div>
            ))}
          </div>
          <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 12 }}>
            Password for all demo accounts: <code>{DEMO_PASSWORD}</code>
          </Typography.Paragraph>
        </div>
      </div>
    </div>
  );
}
