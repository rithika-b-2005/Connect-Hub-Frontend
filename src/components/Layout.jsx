import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const navItem = ({ isActive }) =>
  `flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-colors ${
    isActive
      ? 'bg-primary-container text-on-primary shadow-sm'
      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
  }`;

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const isAdmin = user?.role === 'admin';

  const loadNotifications = async () => {
    try {
      const { data } = await api.get('/notifications/me');
      setNotifications(data);
      setUnreadCount(data.filter((notification) => !notification.readAt).length);
    } catch (error) {
      console.error('Could not load notifications', error);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [location.pathname]);

  const markNotificationRead = async (notification) => {
    if (notification.readAt) return;
    try {
      const readAt = new Date().toISOString();
      await api.patch(`/notifications/${notification.id}/read`);
      setNotifications((current) =>
        current.map((item) => (item.id === notification.id ? { ...item, readAt } : item)),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (error) {
      console.error('Could not mark notification as read', error);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await api.patch('/notifications/me/read-all');
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((item) => ({ ...item, readAt })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Could not mark notifications as read', error);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-surface font-sans text-on-surface">
      {/* Sidebar (desktop) */}
      <aside className="fixed left-0 top-0 z-50 hidden h-full w-64 flex-col justify-between bg-surface-container-lowest px-4 py-6 shadow-[0_1px_8px_rgba(0,0,0,0.04)] md:flex">
        <div className="flex flex-col gap-6">
          <NavLink
            to="/"
            end
            aria-label="ConnectHub dashboard"
            className="flex cursor-pointer items-center gap-2 rounded-xl px-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-on-primary shadow-sm">
              <span className="material-symbols-outlined text-[20px]">hub</span>
            </div>
            <span className="font-heading text-lg font-bold text-primary">ConnectHub</span>
          </NavLink>

          <nav className="flex flex-col gap-1">
            <NavLink to="/" end className={navItem}>
              <span className="material-symbols-outlined text-[20px]">dashboard</span>
              Dashboard
            </NavLink>
            <NavLink to="/posts" className={navItem}>
              <span className="material-symbols-outlined text-[20px]">dynamic_feed</span>
              Posts
            </NavLink>
            {isAdmin && (
              <NavLink to="/users" className={navItem}>
                <span className="material-symbols-outlined text-[20px]">group</span>
                Users
              </NavLink>
            )}
            {!isAdmin && (
              <NavLink to="/profile" className={navItem}>
                <span className="material-symbols-outlined text-[20px]">person</span>
                Profile
              </NavLink>
            )}
          </nav>
        </div>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-error transition-colors hover:bg-error-container"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
          Logout
        </button>
      </aside>

      <div className="md:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between bg-surface/80 px-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl md:px-6">
          {/* Mobile nav */}
          <nav className="flex items-center gap-4 md:hidden">
            <NavLink to="/" end className="text-sm font-semibold text-on-surface-variant [&.active]:text-primary">
              Dashboard
            </NavLink>
            <NavLink to="/posts" className="text-sm font-semibold text-on-surface-variant [&.active]:text-primary">
              Posts
            </NavLink>
            {isAdmin && (
              <NavLink to="/users" className="text-sm font-semibold text-on-surface-variant [&.active]:text-primary">
                Users
              </NavLink>
            )}
            <button onClick={handleLogout} className="text-sm font-semibold text-error">
              Logout
            </button>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  const opening = !notificationsOpen;
                  setNotificationsOpen(opening);
                  if (opening) loadNotifications();
                }}
                aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
                aria-expanded={notificationsOpen}
                className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container"
              >
                <span className="material-symbols-outlined">notifications</span>
                {unreadCount > 0 && (
                  <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[9px] font-bold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <section
                  aria-label="Notifications"
                  className="absolute right-0 top-12 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-surface-container-lowest shadow-xl ring-1 ring-outline-variant/30"
                >
                  <header className="flex items-center justify-between border-b border-outline-variant/30 px-4 py-3">
                    <h2 className="text-sm font-bold text-on-surface">Notifications</h2>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllNotificationsRead}
                        className="cursor-pointer text-xs font-semibold text-primary hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </header>
                  {notifications.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-on-surface-variant">You’re all caught up.</p>
                  ) : (
                    <ul className="max-h-[min(65vh,28rem)] overflow-y-auto">
                      {notifications.map((notification) => (
                        <li key={notification.id}>
                          <button
                            type="button"
                            onClick={() => markNotificationRead(notification)}
                            className={`flex w-full cursor-pointer items-start gap-3 border-b border-outline-variant/20 px-4 py-3 text-left transition-colors hover:bg-surface-container-low ${
                              notification.readAt ? '' : 'bg-primary-fixed/20'
                            }`}
                          >
                            <span
                              className={`material-symbols-outlined mt-0.5 ${
                                notification.type === 'post_restored' ? 'text-secondary' : 'text-primary'
                              }`}
                            >
                              {notification.type === 'post_restored' ? 'visibility' : 'gavel'}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block whitespace-pre-wrap break-words text-sm text-on-surface">
                                {notification.message}
                              </span>
                              <time className="mt-1.5 block text-[11px] text-on-surface-variant">
                                {new Date(notification.createdAt).toLocaleString()}
                              </time>
                            </span>
                            {!notification.readAt && (
                              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs font-semibold text-on-surface">{user?.name}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  isAdmin
                    ? 'bg-primary-fixed text-primary'
                    : 'bg-secondary-container text-secondary'
                }`}
              >
                {isAdmin ? 'Admin' : 'User'}
              </span>
            </div>
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-bold text-on-primary">
              {user?.avatarUrl ? (
                <img
                  src={`${api.defaults.baseURL}${user.avatarUrl}`}
                  alt={user?.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                user?.name?.[0]?.toUpperCase()
              )}
            </div>
          </div>
        </header>
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
