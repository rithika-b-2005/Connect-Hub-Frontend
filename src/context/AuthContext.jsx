import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/axios';
import { toUserMessage } from '../api/errors';

const AuthContext = createContext(null);

function getStoredUser() {
  const token = localStorage.getItem('token');
  const saved = localStorage.getItem('user');
  if (!token || !saved) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return null;
  }

  try {
    const user = JSON.parse(saved);
    if (user && typeof user === 'object' && ['admin', 'user'].includes(user.role)) {
      return user;
    }
  } catch {
    // Discard malformed client-side session data and let the user sign in again.
  }

  localStorage.removeItem('token');
  localStorage.removeItem('user');
  return null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser);
  const [isCheckingSession, setIsCheckingSession] = useState(() =>
    Boolean(localStorage.getItem('token')),
  );
  const [sessionError, setSessionError] = useState('');
  const [sessionCheck, setSessionCheck] = useState(0);

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      setIsCheckingSession(false);
      return undefined;
    }

    const controller = new AbortController();
    let active = true;
    setIsCheckingSession(true);
    setSessionError('');

    // The session check blocks the whole app, so a single slow or dropped
    // request should not be the end of it: give it one more go before
    // showing the retry panel.
    const verify = (attempt) =>
      api.get('/users/me', { signal: controller.signal }).then(
        ({ data }) => {
          if (!active) return;
          localStorage.setItem('user', JSON.stringify(data));
          setUser(data);
          setIsCheckingSession(false);
        },
        (err) => {
          if (!active) return;

          if (err.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
            setIsCheckingSession(false);
            return;
          }

          // No response at all means the request never landed, and a 5xx
          // means the server had a bad moment. Both are worth one retry.
          const retryable = !err.response || err.response.status >= 500;
          if (retryable && attempt < 2) {
            verify(attempt + 1);
            return;
          }

          setSessionError(
            toUserMessage(err, 'Could not verify your session. Check your connection and try again.'),
          );
          setIsCheckingSession(false);
        },
      );

    verify(1);

    return () => {
      active = false;
      controller.abort();
    };
  }, [sessionCheck]);

  const saveSession = ({ accessToken, user }) => {
    localStorage.setItem('token', accessToken);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
    setSessionError('');
  };

  const login = async (email, password) => {
    // A rejected sign in is a form error, not an expired session.
    const { data } = await api.post(
      '/auth/login',
      { email, password },
      { skipAuthRedirect: true },
    );
    saveSession(data);
  };

  const signup = async (name, email, password) => {
    const { data } = await api.post(
      '/auth/signup',
      { name, email, password },
      { skipAuthRedirect: true },
    );
    saveSession(data);
  };

  const updateUser = (changes) => {
    setUser((prev) => {
      const next = { ...prev, ...changes };
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // token may already be expired; local cleanup is what matters
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const retrySessionCheck = () => setSessionCheck((check) => check + 1);

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        signup,
        logout,
        updateUser,
        isCheckingSession,
        sessionError,
        retrySessionCheck,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
