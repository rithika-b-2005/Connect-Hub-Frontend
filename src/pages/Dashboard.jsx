import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api from '../api/axios';
import { toUserMessage } from '../api/errors';
import { useAuth } from '../context/AuthContext';

function StatCard({ label, value, icon, tone }) {
  const tones = {
    primary: 'bg-surface-container-high text-primary',
    error: 'bg-error-container/60 text-error',
    secondary: 'bg-secondary-container/60 text-secondary',
    neutral: 'bg-primary-fixed text-primary',
  };
  return (
    <div className="flex flex-col justify-between rounded-2xl bg-surface-container-lowest p-4 shadow-[0_4px_20px_-2px_rgba(67,56,202,0.06)] transition-shadow hover:shadow-[0_10px_30px_-4px_rgba(67,56,202,0.10)] sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-on-surface-variant">{label}</span>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 ${tones[tone]}`}>
          <span aria-hidden="true" className="material-symbols-outlined text-[22px] sm:text-[24px]">{icon}</span>
        </div>
      </div>
      <div className="font-heading text-3xl font-bold leading-none text-on-surface sm:text-4xl">
        {value}
      </div>
    </div>
  );
}

function LikesChart({ data, title, subtitle }) {
  const chartData = data.map((p) => ({
    name: p.title.length > 14 ? `${p.title.slice(0, 14)}…` : p.title,
    likes: p.likes,
  }));
  return (
    <div className="rounded-2xl bg-surface-container-lowest p-4 shadow-[0_4px_20px_-2px_rgba(67,56,202,0.06)] sm:p-6 lg:col-span-7">
      <div className="mb-4">
        <h2 className="font-heading text-lg font-semibold text-on-surface sm:text-xl">{title}</h2>
        <p className="text-xs text-on-surface-variant">{subtitle}</p>
      </div>
      {chartData.length === 0 ? (
        <p className="py-16 text-center text-sm text-on-surface-variant">
          No posts yet — data appears once posts exist.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e7ff" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#464554' }} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#464554' }} width={30} />
            <Tooltip
              cursor={{ fill: '#f2f3ff' }}
              contentStyle={{ borderRadius: 12, border: '1px solid #e2e7ff' }}
            />
            <Bar dataKey="likes" fill="#2a14b4" radius={[8, 8, 0, 0]} maxBarSize={42} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function PostList({ posts, title, subtitle, showAuthor }) {
  return (
    <div className="flex flex-col justify-between rounded-2xl bg-surface-container-lowest p-4 shadow-[0_4px_20px_-2px_rgba(67,56,202,0.06)] sm:p-6 lg:col-span-5">
      <div>
        <div className="mb-4">
          <h2 className="font-heading text-lg font-semibold text-on-surface sm:text-xl">{title}</h2>
          <p className="text-xs text-on-surface-variant">{subtitle}</p>
        </div>
        <div className="flex flex-col gap-1">
          {posts.length === 0 && (
            <p className="py-10 text-center text-sm text-on-surface-variant">No posts yet.</p>
          )}
          {posts.map((p) => (
            <div
              key={p.id}
              className="group flex items-center justify-between gap-2 rounded-xl p-2 transition-colors hover:bg-surface-container-low"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-primary transition-colors group-hover:bg-primary group-hover:text-on-primary">
                  <span aria-hidden="true" className="material-symbols-outlined text-[20px]">article</span>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-on-surface group-hover:text-primary">
                    {p.title}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {showAuthor ? p.authorName : new Date(p.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-xs font-semibold">
                <span className="flex items-center gap-1 text-on-surface">
                  <span aria-hidden="true" className="material-symbols-outlined icon-filled text-[16px] text-error">
                    favorite
                  </span>
                  {p.likes}
                </span>
                <span className="flex items-center gap-1 text-on-surface-variant">
                  <span aria-hidden="true" className="material-symbols-outlined text-[16px]">visibility</span>
                  {p.views}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Link
        to="/posts"
        className="mt-4 flex w-full items-center justify-center gap-1 rounded-xl bg-surface-container-low py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-surface-container-high"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">dynamic_feed</span>
        View All Posts
      </Link>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    api
      .get('/analytics/summary')
      .then((res) => {
        if (active) setData(res.data);
      })
      .catch((err) => {
        if (!active) return;
        setError(toUserMessage(err, 'Could not load analytics. Please try again.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [attempt]);

  if (loading) {
    return <p className="py-20 text-center text-sm text-on-surface-variant">Loading analytics...</p>;
  }

  if (error) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-20 text-center">
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
        <button
          onClick={() => setAttempt((current) => current + 1)}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data) return null;

  const isAdmin = data.role === 'admin';

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* Header */}
      <div className="sticky top-16 z-30 -mx-4 flex flex-col justify-between gap-4 bg-surface/95 px-4 pb-4 pt-2 backdrop-blur-xl md:-mx-6 md:flex-row md:items-end md:px-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-container px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-secondary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-secondary" />
              Live Analytics
            </span>
          </div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-on-surface sm:text-3xl md:text-4xl">
            Welcome back, {user?.name}
          </h1>
          <p className="max-w-xl text-sm text-on-surface-variant">
            {isAdmin
              ? 'Platform-wide overview of posts, engagement and members.'
              : 'Your personal content performance and engagement.'}
          </p>
        </div>
        {!isAdmin && (
          <Link
            to="/posts"
            className="flex items-center gap-1 self-start rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary shadow-[0_4px_16px_rgba(42,20,180,0.22)] transition-all hover:bg-primary-container md:self-auto"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">add</span>
            Create Post
          </Link>
        )}
      </div>

      {/* Stat cards */}
      {isAdmin ? (
        <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Posts" value={data.stats.totalPosts} icon="dynamic_feed" tone="primary" />
          <StatCard label="Total Likes" value={data.stats.totalLikes} icon="favorite" tone="error" />
          <StatCard label="Total Views" value={data.stats.totalViews} icon="visibility" tone="secondary" />
          <StatCard label="Total Users" value={data.stats.totalUsers} icon="group" tone="neutral" />
        </div>
      ) : (
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <StatCard label="My Posts" value={data.stats.myPosts} icon="edit_note" tone="primary" />
          <StatCard label="Likes Received" value={data.stats.likesReceived} icon="favorite" tone="error" />
          <StatCard label="Views Received" value={data.stats.viewsReceived} icon="visibility" tone="secondary" />
        </div>
      )}

      {/* Chart + list */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <LikesChart
          data={data.likesPerPost}
          title={isAdmin ? 'Likes per Post' : 'My Posts Performance'}
          subtitle={
            isAdmin
              ? 'Most liked posts across the platform'
              : 'Likes generated per publication'
          }
        />
        <PostList
          posts={isAdmin ? data.topPosts : data.recentPosts}
          title={isAdmin ? 'Top Posts' : 'My Recent Posts'}
          subtitle={isAdmin ? 'Highest engagement content' : 'Your latest publications'}
          showAuthor={isAdmin}
        />
      </div>
    </div>
  );
}
