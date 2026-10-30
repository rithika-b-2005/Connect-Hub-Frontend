import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Posts from './pages/Posts';
import Profile from './pages/Profile';
import Signup from './pages/Signup';
import Users from './pages/Users';
import { useAuth } from './context/AuthContext';

export default function App() {
  const { isCheckingSession, sessionError, retrySessionCheck } = useAuth();

  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface p-4 text-sm text-on-surface-variant">
        Verifying your session...
      </main>
    );
  }

  if (sessionError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface p-4 text-center">
        <p role="alert" className="text-sm text-error">
          {sessionError}
        </p>
        <button
          onClick={retrySessionCheck}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary"
        >
          Retry
        </button>
      </main>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/posts" element={<Posts />} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute roles={['user']}>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute roles={['admin']}>
              <Users />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
