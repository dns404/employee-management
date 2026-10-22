import { useEffect, useState } from 'react';
import { Alert, App, Button, Col, DatePicker, Drawer, Form, Input, Row, Select, Skeleton, Space } from 'antd';
import dayjs from 'dayjs';
import { useAuth } from '../auth/AuthContext';
import api, { applyFieldErrors, errorMessage } from '../api/client';
import { FieldLabel, PersonCell, StatusTag, useLookups } from '../components/common';

// Create (employeeId = null) or view/edit an employee.
// In edit mode the server returns `editableFields`; other fields are shown read-only with a lock.
export default function EmployeeDrawer({ employeeId, onClose, onSaved }) {
  const isNew = !employeeId;
  const { can } = useAuth();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const { departments } = useLookups();
  const [employee, setEmployee] = useState(null);
  const [managers, setManagers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [editable, setEditable] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (can('employee:create') || can('employee:update:all')) api.get('/lookups/managers').then((r) => setManagers(r.data));
    if (isNew) {
      api.get('/roles').then((r) => setRoles(r.data));
      return;
    }
    api.get(`/employees/${employeeId}`).then(({ data }) => {
      setEmployee(data);
      setEditable(data.editableFields);
      if (data.manager) setManagers((m) => (m.length ? m : [data.manager]));
    }).catch((err) => { message.error(errorMessage(err)); onClose(); });
  }, [employeeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const locked = (field) => !isNew && !editable.includes(field);
  const label = (text, field) => <FieldLabel text={text} locked={field ? locked(field) : !isNew} />;
  const readOnly = !isNew && editable.length === 0;

  const submit = async (values) => {
    const payload = { ...values, hireDate: values.hireDate?.format('YYYY-MM-DD') };
    // Only send fields this user may change - the API rejects anything else with 403
    const body = isNew ? payload : Object.fromEntries(Object.entries(payload).filter(([k]) => editable.includes(k)));
    setSaving(true);
    try {
      if (isNew) await api.post('/employees', body);
      else await api.patch(`/employees/${employeeId}`, body);
      message.success(isNew ? 'Employee created' : 'Changes saved');
      onSaved();
    } catch (err) {
      if (!applyFieldErrors(form, err)) message.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const loading = !isNew && !employee;

  return (
    <Drawer
      open
      width={640}
      onClose={onClose}
      title={isNew ? 'Add employee' : loading ? 'Employee' : (
        <Space size={12}>
          <PersonCell person={employee} sub={`${employee.employeeCode} · ${employee.jobTitle}`} size={40} />
          <StatusTag status={employee.status} />
        </Space>
      )}
      footer={!readOnly && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={saving} onClick={form.submit}>{isNew ? 'Create employee' : 'Save changes'}</Button>
        </div>
      )}
    >
      {loading ? <Skeleton active paragraph={{ rows: 10 }} /> : (
        <Form
          form={form}
          layout="vertical"
          onFinish={submit}
          requiredMark="optional"
          initialValues={employee && {
            ...employee, hireDate: dayjs(employee.hireDate.slice(0, 10)), email: employee.user.email, role: employee.user.role.name,
          }}
        >
          {readOnly && <Alert type="info" showIcon message="You have view-only access to this record." style={{ marginBottom: 20 }} />}
          {!isNew && !readOnly && editable.length < 9 && (
            <Alert type="info" showIcon style={{ marginBottom: 20 }} message="Fields marked with a lock can only be changed by an administrator." />
          )}

          <div className="section-title">Personal details</div>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="firstName" label={label('First name', 'firstName')} rules={[{ required: true, message: 'First name is required' }, { max: 60 }]}>
                <Input disabled={locked('firstName')} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="lastName" label={label('Last name', 'lastName')} rules={[{ required: true, message: 'Last name is required' }, { max: 60 }]}>
                <Input disabled={locked('lastName')} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="phone" label={label('Phone', 'phone')} rules={[{ pattern: /^[+\d][\d\s()-]{5,19}$/, message: 'Enter a valid phone number' }]}>
                <Input disabled={locked('phone')} placeholder="+1 555 0100" />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="address" label={label('Address', 'address')} rules={[{ max: 200 }]}>
                <Input.TextArea rows={2} disabled={locked('address')} />
              </Form.Item>
            </Col>
          </Row>

          <div className="section-title">Employment</div>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="jobTitle" label={label('Job title', 'jobTitle')} rules={[{ required: true, message: 'Job title is required' }, { min: 2, max: 80 }]}>
                <Input disabled={locked('jobTitle')} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="departmentId" label={label('Department', 'departmentId')} rules={[{ required: true, message: 'Select a department' }]}>
                <Select disabled={locked('departmentId')} options={departments.map((d) => ({ value: d.id, label: d.name }))} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="managerId" label={label('Reports to', 'managerId')}>
                <Select
                  allowClear showSearch optionFilterProp="label" disabled={locked('managerId')} placeholder="No manager"
                  options={managers.filter((m) => m.id !== employeeId).map((m) => ({ value: m.id, label: `${m.firstName} ${m.lastName}` }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="hireDate" label={label('Hire date', 'hireDate')} rules={[{ required: true, message: 'Select the hire date' }]}>
                <DatePicker style={{ width: '100%' }} format="D MMM YYYY" disabled={locked('hireDate')} disabledDate={(d) => d.isAfter(dayjs())} />
              </Form.Item>
            </Col>
          </Row>

          <div className="section-title">Account & access</div>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="email" label={label('Login email')} rules={[{ required: true, message: 'Email is required' }, { type: 'email', message: 'Enter a valid email' }]}>
                <Input disabled={!isNew} placeholder="name@company.com" />
              </Form.Item>
            </Col>
            {isNew ? (
              <>
                <Col xs={24} md={12}>
                  <Form.Item name="roleId" label="Role" rules={[{ required: true, message: 'Select a role' }]}>
                    <Select placeholder="Select role" options={roles.map((r) => ({ value: r.id, label: r.name }))} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="password" label="Temporary password" extra="At least 8 characters, with letters and numbers."
                    rules={[{ required: true, message: 'Set a temporary password' }, { min: 8, message: 'At least 8 characters' }, { pattern: /(?=.*[A-Za-z])(?=.*\d)/, message: 'Use letters and numbers' }]}
                  >
                    <Input.Password autoComplete="new-password" />
                  </Form.Item>
                </Col>
              </>
            ) : (
              <Col xs={24} md={12}>
                <Form.Item name="role" label={label('Role')} extra={can('user:manage') ? 'Change roles from the Users page.' : undefined}>
                  <Input disabled />
                </Form.Item>
              </Col>
            )}
          </Row>
        </Form>
      )}
    </Drawer>
  );
}
