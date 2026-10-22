import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { AuthProvider } from './auth/AuthContext';
import App from './App';
import './styles.css';

dayjs.extend(relativeTime);

// Design tokens - one place to tune the look of every antd component
const theme = {
  token: {
    colorPrimary: '#4f46e5',
    colorSuccess: '#16a34a',
    colorWarning: '#d97706',
    colorError: '#dc2626',
    colorBgLayout: '#f5f6fa',
    colorTextBase: '#0f172a',
    borderRadius: 8,
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    controlHeight: 36,
  },
  components: {
    Layout: { siderBg: '#0f172a', headerBg: '#ffffff', headerHeight: 64, headerPadding: '0 24px' },
    Menu: {
      darkItemBg: '#0f172a',
      darkItemSelectedBg: '#4f46e5',
      darkItemColor: '#cbd5e1',
      itemBorderRadius: 8,
      itemMarginInline: 12,
    },
    Card: { borderRadiusLG: 12 },
    Table: { headerBg: '#f8fafc', rowHoverBg: '#f8fafc' },
    Drawer: { paddingLG: 24 },
  },
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider theme={theme}>
      <AntApp>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>,
);
