import axios from 'axios';

const apiBaseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '');

const api = axios.create({
  baseURL: apiBaseUrl,
  // Without a timeout a stalled request waits forever, and the session check
  // would leave the whole app stuck on "Verifying your session...".
  timeout: 30_000,
});

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    // Remember that this request was authenticated, so a 401 can be read as
    // "the session is gone" rather than "the form was wrong".
    config.hadAuthToken = true;
  }
  return config;
});

// Auto-logout on expired/invalid token
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const wasAuthenticated = err.config?.hadAuthToken === true;
    const optedOut = err.config?.skipAuthRedirect === true;

    // Only an authenticated request that the server rejected ends the
    // session. A 401 from a request that never carried a token (sign in,
    // sign up) or from one that opted out — changing your password answers
    // 401 when the current password is wrong — is a form error, and must not
    // sign the user out.
    if (status === 401 && wasAuthenticated && !optedOut && window.location.pathname !== '/login') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export default api;
