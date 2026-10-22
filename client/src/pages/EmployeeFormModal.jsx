import { useEffect, useState } from 'react';
import { Alert, App, Col, DatePicker, Form, Input, Modal, Row, Select, Spin } from 'antd';
import dayjs from 'dayjs';
import { useAuth } from '../auth/AuthContext';
import api, { applyFieldErrors, errorMessage } from '../api/client';
import { useLookups } from '../components/common';

// Create (employeeId = null) or view/edit an employee.
// In edit mode the server returns `editableFields`; everything else is read-only.
export default function EmployeeFormModal({ employeeId, onClose, onSaved }) {
  const isNew = !employeeId;
  const { can } = useAuth();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const { departments } = useLookups();
  const [managers, setManagers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [editable, setEditable] = useState(isNew ? null : []);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (can('employee:create') || can('employee:update:all')) api.get('/lookups/managers').then((r) => setManagers(r.data));
    if (isNew) api.get('/roles').then((r) => setRoles(r.data));
    if (!isNew) {
      api.get(`/employees/${employeeId}`).then(({ data }) => {
        form.setFieldsValue({ ...data, hireDate: dayjs(data.hireDate.slice(0, 10)), email: data.user.email, role: data.user.role.name });
        if (!managers.length && data.manager) setManagers((m) => (m.length ? m : [data.manager]));
        setEditable(data.editableFields);
        setLoading(false);
      }).catch((err) => { message.error(errorMessage(err)); onClose(); });
    }
  }, [employeeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const canEdit = (field) => isNew || editable.includes(field);
  const readOnly = !isNew && editable.length === 0;

  const submit = async (values) => {
    const payload = { ...values, hireDate: values.hireDate?.format('YYYY-MM-DD') };
    // Only send fields this user may change - the API rejects anything else with 403
    const body = isNew ? payload : Object.fromEntries(Object.entries(payload).filter(([k]) => editable.includes(k)));
    setSaving(true);
    try {
      if (isNew) await api.post('/employees', body);
      else await api.patch(`/employees/${employeeId}`, body);
      message.success(isNew ? 'Employee created' : 'Employee updated');
      onSaved();
    } catch (err) {
      if (!applyFieldErrors(form, err)) message.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      width={720}
      title={isNew ? 'Add employee' : 'Employee details'}
      okText={isNew ? 'Create' : 'Save'}
      onOk={form.submit}
      onCancel={onClose}
      confirmLoading={saving}
      okButtonProps={{ disabled: readOnly }}
      destroyOnClose
    >
      {loading ? <Spin /> : (
        <Form form={form} layout="vertical" onFinish={submit}>
          {readOnly && <Alert type="info" showIcon message="You have read-only access to this record." style={{ marginBottom: 16 }} />}
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="firstName" label="First name" rules={[{ required: true, max: 60 }]}><Input disabled={!canEdit('firstName')} /></Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="lastName" label="Last name" rules={[{ required: true, max: 60 }]}><Input disabled={!canEdit('lastName')} /></Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="email" label="Login email" rules={[{ required: true, type: 'email' }]}><Input disabled={!isNew} /></Form.Item>
            </Col>
            {isNew ? (
              <>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="password" label="Initial password"
                    rules={[{ required: true, min: 8 }, { pattern: /(?=.*[A-Za-z])(?=.*\d)/, message: 'Must contain letters and numbers' }]}
                  >
                    <Input.Password />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="roleId" label="Role" rules={[{ required: true }]}>
                    <Select options={roles.map((r) => ({ value: r.id, label: r.name }))} />
                  </Form.Item>
                </Col>
              </>
            ) : (
              <Col xs={24} md={12}><Form.Item name="role" label="Role"><Input disabled /></Form.Item></Col>
            )}
            <Col xs={24} md={12}>
              <Form.Item name="jobTitle" label="Job title" rules={[{ required: true, min: 2, max: 80 }]}><Input disabled={!canEdit('jobTitle')} /></Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="departmentId" label="Department" rules={[{ required: true }]}>
                <Select disabled={!canEdit('departmentId')} options={departments.map((d) => ({ value: d.id, label: d.name }))} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="managerId" label="Reports to">
                <Select
                  allowClear showSearch optionFilterProp="label" disabled={!canEdit('managerId')}
                  options={managers.filter((m) => m.id !== employeeId).map((m) => ({ value: m.id, label: `${m.firstName} ${m.lastName}` }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="hireDate" label="Hire date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} disabled={!canEdit('hireDate')} disabledDate={(d) => d.isAfter(dayjs())} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="phone" label="Phone" rules={[{ pattern: /^[+\d][\d\s()-]{5,19}$/, message: 'Enter a valid phone number' }]}>
                <Input disabled={!canEdit('phone')} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="address" label="Address" rules={[{ max: 200 }]}><Input.TextArea rows={2} disabled={!canEdit('address')} /></Form.Item>
            </Col>
          </Row>
        </Form>
      )}
    </Modal>
  );
}
