import { Navigate, Route, Routes } from 'react-router-dom';
import { Result, Spin } from 'antd';
import { useAuth } from './auth/AuthContext';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import EmployeesPage from './pages/EmployeesPage';
import MyLeavesPage from './pages/MyLeavesPage';
import ApprovalsPage from './pages/ApprovalsPage';
import UsersPage from './pages/UsersPage';
import RolesPage from './pages/RolesPage';

function RequirePermission({ perm, children }) {
  const { can } = useAuth();
  return can(perm) ? children : <Result status="403" title="403" subTitle="You are not authorized to view this page." />;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <Spin fullscreen />;
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="employees" element={<RequirePermission perm="employee:read"><EmployeesPage /></RequirePermission>} />
        <Route path="leaves" element={<RequirePermission perm="leave:create"><MyLeavesPage /></RequirePermission>} />
        <Route path="approvals" element={<RequirePermission perm="leave:approve"><ApprovalsPage /></RequirePermission>} />
        <Route path="users" element={<RequirePermission perm="user:manage"><UsersPage /></RequirePermission>} />
        <Route path="roles" element={<RequirePermission perm="role:manage"><RolesPage /></RequirePermission>} />
        <Route path="login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Result status="404" title="404" subTitle="Page not found." />} />
      </Route>
    </Routes>
  );
}
