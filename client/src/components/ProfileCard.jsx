import { Card, Col, Divider, Row, Skeleton, Tag } from 'antd';
import { StatusTag, UserAvatar, fmtDate, fullName } from './common';

const Field = ({ label, children, span }) => (
  <Col xs={24} sm={12} lg={span || 8}>
    <div className="field-label">{label}</div>
    <div className="field-value">{children || <span style={{ color: '#94a3b8' }}>Not provided</span>}</div>
  </Col>
);

// Read-only profile summary for one employee (shape of GET /employees/:id)
export default function ProfileCard({ employee, title, extra }) {
  if (!employee) return <Card title={title}><Skeleton avatar active paragraph={{ rows: 4 }} /></Card>;

  return (
    <Card title={title} extra={extra}>
      <div className="profile-head">
        <UserAvatar first={employee.firstName} last={employee.lastName} size={72} />
        <div style={{ minWidth: 0 }}>
          <div className="profile-name">{fullName(employee)}</div>
          <div className="person-sub" style={{ fontSize: 14 }}>{employee.jobTitle} · {employee.department.name}</div>
          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <StatusTag status={employee.status} />
            <Tag color="purple" bordered={false}>{employee.user.role.name}</Tag>
          </div>
        </div>
      </div>
      <Divider style={{ margin: '20px 0' }} />
      <Row gutter={[24, 20]}>
        <Field label="Employee code">{employee.employeeCode}</Field>
        <Field label="Email">{employee.user.email}</Field>
        <Field label="Phone">{employee.phone}</Field>
        <Field label="Department">{employee.department.name}</Field>
        <Field label="Reports to">{employee.manager && fullName(employee.manager)}</Field>
        <Field label="Joined">{fmtDate(employee.hireDate)}</Field>
        <Field label="Address" span={24}>{employee.address}</Field>
      </Row>
    </Card>
  );
}
