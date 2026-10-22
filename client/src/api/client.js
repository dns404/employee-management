import axios from 'axios';

// Access token lives in memory only (not localStorage) to limit XSS exposure.
// The refresh token is an httpOnly cookie the browser sends to /api/auth automatically.
let accessToken = null;
let onSessionExpired = () => {};
let refreshing = null;

export const setAccessToken = (token) => { accessToken = token; };
export const setSessionExpiredHandler = (fn) => { onSessionExpired = fn; };

const api = axios.create({ baseURL: '/api', withCredentials: true });

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// Single-flight refresh: concurrent 401s wait for one refresh call, then retry once
export const refreshSession = () => {
  refreshing ??= axios.post('/api/auth/refresh', {}, { withCredentials: true })
    .then(({ data }) => { setAccessToken(data.accessToken); return data; })
    .finally(() => { refreshing = null; });
  return refreshing;
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error;
    if (response?.status === 401 && !config._retry && !config.url.startsWith('/auth/')) {
      config._retry = true;
      try {
        await refreshSession();
        return api(config);
      } catch {
        onSessionExpired();
      }
    }
    return Promise.reject(error);
  },
);

export const errorMessage = (err) => err?.response?.data?.error?.message || err.message || 'Something went wrong';

// Maps server-side Joi validation details onto antd form fields
export const applyFieldErrors = (form, err) => {
  const details = err?.response?.data?.error?.details;
  if (!details) return false;
  form.setFields(details.map((d) => ({ name: d.field, errors: [d.message] })));
  return true;
};

export default api;
