import { useCallback, useEffect, useState } from 'react';
import { App, Button, Result } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { useAuth } from '../auth/AuthContext';
import api, { errorMessage } from '../api/client';
import { PageHeader } from '../components/common';
import ProfileCard from '../components/ProfileCard';
import EmployeeDrawer from './EmployeeDrawer';

export default function ProfilePage() {
  const { user, can } = useAuth();
  const { message } = App.useApp();
  const [employee, setEmployee] = useState(null);
  const [editing, setEditing] = useState(false);
  const employeeId = user.employee?.id;

  const load = useCallback(() => {
    api.get(`/employees/${employeeId}`).then((r) => setEmployee(r.data)).catch((err) => message.error(errorMessage(err)));
  }, [employeeId, message]);

  useEffect(() => { if (employeeId) load(); }, [employeeId, load]);

  if (!employeeId) return <Result status="info" title="No employee record is linked to this account." />;

  const canEdit = can('employee:update');

  return (
    <>
      <PageHeader
        title="My profile"
        subtitle="Your employee record and contact details"
        extra={canEdit && employee && <Button type="primary" icon={<EditOutlined />} onClick={() => setEditing(true)}>Edit contact details</Button>}
      />
      <ProfileCard employee={employee} />
      {editing && (
        <EmployeeDrawer
          employeeId={employeeId}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); load(); }}
        />
      )}
    </>
  );
}
