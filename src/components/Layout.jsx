import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const navItem = ({ isActive }) =>
  `flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-colors ${
    isActive
      ? 'bg-primary-container text-on-primary shadow-sm'
      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
  }`;

const tabItem = ({ isActive }) =>
  `flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-semibold transition-colors ${
    isActive ? 'text-primary' : 'text-on-surface-variant'
  }`;

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const isAdmin = user?.role === 'admin';

  // A notification fetch that is still in flight can land after the user has
  // already marked something read, and would put the old unread badge back.
  // Every load and every local change bumps this counter, and a load only
  // applies its result if nothing superseded it.
  const notificationsRevision = useRef(0);

  const loadNotifications = async () => {
    const revision = ++notificationsRevision.current;
    try {
      const { data } = await api.get('/notifications/me');
      if (revision !== notificationsRevision.current) return;
      setNotifications(data);
      setUnreadCount(data.filter((notification) => !notification.readAt).length);
    } catch (error) {
      if (revision !== notificationsRevision.current) return;
      console.error('Could not load notifications', error);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [location.pathname]);

  // Close the mobile account sheet whenever the route changes
  useEffect(() => {
    setAccountOpen(false);
  }, [location.pathname]);

  const markNotificationRead = async (notification) => {
    if (notification.readAt) return;
    notificationsRevision.current += 1;
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
    notificationsRevision.current += 1;
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

  // Bottom tab bar destinations — profile for members, users for admins
  const tabs = [
    { to: '/', label: 'Home', icon: 'home', end: true },
    { to: '/posts', label: 'Posts', icon: 'dynamic_feed' },
    isAdmin
      ? { to: '/users', label: 'Users', icon: 'group' }
      : { to: '/profile', label: 'Profile', icon: 'person' },
  ];

  const avatar = (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-bold text-on-primary">
      {user?.avatarUrl ? (
        <img src={`${api.defaults.baseURL}${user.avatarUrl}`} alt={user?.name} className="h-full w-full object-cover" />
      ) : (
        user?.name?.[0]?.toUpperCase()
      )}
    </div>
  );

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
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">hub</span>
            </div>
            <span className="font-heading text-lg font-bold text-primary">ConnectHub</span>
          </NavLink>

          <nav className="flex flex-col gap-1">
            <NavLink to="/" end className={navItem}>
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">dashboard</span>
              Dashboard
            </NavLink>
            <NavLink to="/posts" className={navItem}>
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">dynamic_feed</span>
              Posts
            </NavLink>
            {isAdmin && (
              <NavLink to="/users" className={navItem}>
                <span aria-hidden="true" className="material-symbols-outlined text-[20px]">group</span>
                Users
              </NavLink>
            )}
            {!isAdmin && (
              <NavLink to="/profile" className={navItem}>
                <span aria-hidden="true" className="material-symbols-outlined text-[20px]">person</span>
                Profile
              </NavLink>
            )}
          </nav>
        </div>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-error transition-colors hover:bg-error-container"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">logout</span>
          Logout
        </button>
      </aside>

      <div className="md:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-2 bg-surface/80 px-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl md:px-6">
          {/* Brand (mobile only — desktop shows it in the sidebar) */}
          <NavLink
            to="/"
            end
            aria-label="ConnectHub dashboard"
            className="flex items-center gap-2 md:hidden"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary shadow-sm">
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">hub</span>
            </div>
            <span className="font-heading text-base font-bold text-primary">ConnectHub</span>
          </NavLink>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
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
                <span aria-hidden="true" className="material-symbols-outlined">notifications</span>
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

            {/* Name + role (hidden on phones — the account sheet shows them) */}
            <div className="hidden flex-col items-end sm:flex">
              <span className="max-w-[10rem] truncate text-xs font-semibold text-on-surface">{user?.name}</span>
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

            {/* Avatar (desktop only — mobile uses the bottom tab bar) */}
            <div className="hidden md:block">{avatar}</div>
          </div>
        </header>

        <main className="p-4 pb-24 md:p-6 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Bottom tab bar (mobile) */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant/30 bg-surface-container-lowest/95 backdrop-blur-xl md:hidden"
      >
        <div className="flex items-stretch pb-[calc(0.25rem+env(safe-area-inset-bottom,0px))]">
          {tabs.map((tab) => (
            <NavLink key={tab.to} to={tab.to} end={tab.end} className={tabItem}>
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
                      isActive ? 'bg-primary-fixed' : ''
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`material-symbols-outlined text-[22px] ${
                        isActive ? 'text-primary' : ''
                      }`}
                    >
                      {tab.icon}
                    </span>
                  </span>
                  <span>{tab.label}</span>
                </>
              )}
            </NavLink>
          ))}
          <button type="button" onClick={() => setAccountOpen(true)} className={`${tabItem({ isActive: false })} cursor-pointer`}>
            {avatar}
            <span>Account</span>
          </button>
        </div>
      </nav>

      {/* Account sheet (mobile) */}
      {accountOpen && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setAccountOpen(false)}>
          <div className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Account"
            className="absolute inset-x-0 bottom-0 flex flex-col gap-2 rounded-t-3xl bg-surface-container-lowest p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-outline-variant" />
            <div className="flex items-center gap-3 rounded-2xl bg-surface-container-low px-4 py-3">
              {avatar}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-on-surface">{user?.name}</p>
                <p className="truncate text-xs text-on-surface-variant">{user?.email}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  isAdmin
                    ? 'bg-primary-fixed text-primary'
                    : 'bg-secondary-container text-secondary'
                }`}
              >
                {isAdmin ? 'Admin' : 'User'}
              </span>
            </div>

            {isAdmin && (
              <NavLink
                to="/users"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-low"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-primary">group</span>
                Manage Users
              </NavLink>
            )}

            <button
              onClick={handleLogout}
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-error transition-colors hover:bg-error-container"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">logout</span>
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
