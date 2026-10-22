import { Layout, Menu, Dropdown, Avatar, Space, Typography, Tag } from 'antd';
import {
  DashboardOutlined, TeamOutlined, CalendarOutlined, CheckSquareOutlined, UserOutlined, SafetyOutlined, LogoutOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const { Header, Sider, Content } = Layout;

export default function AppLayout() {
  const { user, can, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Menu only shows modules the user's role grants
  const items = [
    { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
    can('employee:read') && {
      key: '/employees', icon: <TeamOutlined />,
      label: can('employee:read:all') ? 'Employees' : can('employee:read:team') ? 'My Team' : 'My Profile',
    },
    can('leave:create') && { key: '/leaves', icon: <CalendarOutlined />, label: 'My Leaves' },
    can('leave:approve') && { key: '/approvals', icon: <CheckSquareOutlined />, label: 'Leave Approvals' },
    can('user:manage') && { key: '/users', icon: <UserOutlined />, label: 'Users' },
    can('role:manage') && { key: '/roles', icon: <SafetyOutlined />, label: 'Roles & Permissions' },
  ].filter(Boolean);

  const selected = items.find((i) => i.key !== '/' && pathname.startsWith(i.key))?.key || '/';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth="0" theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
        <div style={{ padding: '18px 24px', fontWeight: 700, fontSize: 16 }}>EMS</div>
        <Menu mode="inline" selectedKeys={[selected]} items={items} onClick={({ key }) => navigate(key)} style={{ borderInlineEnd: 0 }} />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'flex-end', borderBottom: '1px solid #f0f0f0' }}>
          <Dropdown
            menu={{ items: [{ key: 'logout', icon: <LogoutOutlined />, label: 'Log out', onClick: logout }] }}
          >
            <Space style={{ cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} />
              <Typography.Text>{user.employee?.name || user.email}</Typography.Text>
              <Tag color="blue">{user.role}</Tag>
            </Space>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
