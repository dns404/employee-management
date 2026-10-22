import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Dropdown, Grid, Layout, Menu, Tag } from 'antd';
import {
  AppstoreOutlined, TeamOutlined, CalendarOutlined, CheckSquareOutlined, UserOutlined, SafetyOutlined,
  LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined, DownOutlined, IdcardOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import api from '../api/client';
import { UserAvatar } from './common';

const { Header, Sider, Content } = Layout;

export default function AppLayout() {
  const { user, can, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.lg;
  const [collapsed, setCollapsed] = useState(false);
  const [pending, setPending] = useState(0);

  // Badge count for the approvals menu item; pages fire 'ems:counts' after actions
  const loadCounts = useCallback(() => {
    if (!can('leave:approve')) return;
    api.get('/leaves', { params: { view: 'team', status: 'PENDING', pageSize: 1 } })
      .then((r) => setPending(r.data.total)).catch(() => {});
  }, [can]);

  useEffect(() => {
    loadCounts();
    window.addEventListener('ems:counts', loadCounts);
    return () => window.removeEventListener('ems:counts', loadCounts);
  }, [loadCounts]);

  useEffect(() => { if (isMobile) setCollapsed(true); }, [isMobile, pathname]);

  const [first = '', last = ''] = (user.employee?.name || user.email).split(' ');

  // Only modules the role grants are shown (the API enforces the same rules)
  const groups = [
    {
      type: 'group', label: 'Workspace',
      children: [
        { key: '/', icon: <AppstoreOutlined />, label: 'Dashboard' },
        (can('employee:read:all') || can('employee:read:team')) && {
          key: '/employees', icon: <TeamOutlined />, label: can('employee:read:all') ? 'Employees' : 'My Team',
        },
        can('employee:read') && { key: '/profile', icon: <IdcardOutlined />, label: 'My Profile' },
        can('leave:create') && { key: '/leaves', icon: <CalendarOutlined />, label: 'My Leaves' },
        can('leave:approve') && {
          key: '/approvals', icon: <CheckSquareOutlined />,
          label: (
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Approvals <Badge count={pending} size="small" style={{ boxShadow: 'none' }} />
            </span>
          ),
        },
      ].filter(Boolean),
    },
    (can('user:manage') || can('role:manage')) && {
      type: 'group', label: 'Administration',
      children: [
        can('user:manage') && { key: '/users', icon: <UserOutlined />, label: 'Users' },
        can('role:manage') && { key: '/roles', icon: <SafetyOutlined />, label: 'Roles & Permissions' },
      ].filter(Boolean),
    },
  ].filter(Boolean);

  const keys = groups.flatMap((g) => g.children.map((c) => c.key));
  const selected = keys.find((k) => k !== '/' && pathname.startsWith(k)) || '/';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={240}
        collapsedWidth={isMobile ? 0 : 72}
        collapsed={collapsed}
        trigger={null}
        style={{ position: 'sticky', top: 0, height: '100vh', zIndex: 20 }}
      >
        <div className="brand">
          <div className="brand-mark">E</div>
          {!collapsed && (
            <div>
              <div className="brand-name">EMS</div>
              <div className="brand-sub">Employee Management</div>
            </div>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selected]}
          items={groups}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #eef0f4', position: 'sticky', top: 0, zIndex: 10 }}>
          <Button
            type="text"
            aria-label="Toggle navigation"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                { key: 'who', disabled: true, label: <div style={{ color: '#64748b' }}>{user.email}</div> },
                { type: 'divider' },
                can('employee:read') && user.employee && { key: 'profile', icon: <IdcardOutlined />, label: 'My profile', onClick: () => navigate('/profile') },
                { key: 'logout', icon: <LogoutOutlined />, label: 'Sign out', danger: true, onClick: logout },
              ].filter(Boolean),
            }}
          >
            <Button type="text" style={{ height: 48, display: 'flex', alignItems: 'center', gap: 10 }}>
              <UserAvatar first={first} last={last} size={32} />
              {screens.sm && (
                <span style={{ textAlign: 'left', lineHeight: 1.2 }}>
                  <div style={{ fontWeight: 500 }}>{user.employee?.name || user.email}</div>
                  <Tag color="purple" bordered={false} style={{ margin: 0, fontSize: 11, lineHeight: '16px' }}>{user.role}</Tag>
                </span>
              )}
              <DownOutlined style={{ fontSize: 10, color: '#94a3b8' }} />
            </Button>
          </Dropdown>
        </Header>
        <Content style={{ padding: isMobile ? 16 : 28 }}>
          <div className="page"><Outlet /></div>
        </Content>
      </Layout>
    </Layout>
  );
}
