import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { refreshSession, setAccessToken, setSessionExpiredHandler } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clear = useCallback(() => { setAccessToken(null); setUser(null); }, []);

  // Restore the session from the refresh cookie on page load
  useEffect(() => {
    setSessionExpiredHandler(clear);
    refreshSession().then((data) => setUser(data.user)).catch(clear).finally(() => setLoading(false));
  }, [clear]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
  };

  const logout = async () => {
    await api.post('/auth/logout').catch(() => {});
    clear();
  };

  // Mirrors the server's matching: 'leave:approve' matches 'leave:approve:team'.
  // UI checks are for UX only - the API enforces every permission itself.
  const can = useCallback(
    (perm) => !!user?.permissions.some((p) => p === perm || p.startsWith(`${perm}:`)),
    [user],
  );

  const value = useMemo(() => ({ user, loading, login, logout, can }), [user, loading, can]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
