import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signup(name, email, password);
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg[0] : msg || 'Signup failed');
      setLoading(false);
    }
  };

  const inputClass =
    'h-11 w-full rounded-2xl bg-surface-container-low pl-11 pr-4 text-sm text-on-surface outline-none transition-all placeholder:text-outline focus:bg-surface-container-lowest focus:shadow-md focus:ring-2 focus:ring-primary/30';

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-surface p-4 font-sans text-on-surface">
      <div className="relative flex w-full flex-col items-center justify-center py-4">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <div className="h-[620px] w-[620px] -translate-y-8 rounded-full bg-gradient-to-tr from-surface-tint/10 via-primary-fixed/20 to-transparent opacity-70 blur-3xl" />
          <div className="absolute h-[360px] w-[360px] translate-x-48 translate-y-32 rounded-full bg-secondary-fixed/20 opacity-40 blur-2xl" />
        </div>

        <div className="relative z-10 w-full max-w-[480px] px-4">
          {/* Brand header */}
          <div className="mb-4 flex flex-col items-center text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-surface-container-low px-4 py-1.5 shadow-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-on-primary shadow-md">
                <span className="material-symbols-outlined icon-filled text-[18px]">hub</span>
              </div>
              <span className="font-heading text-lg font-bold tracking-tight text-on-surface">
                ConnectHub
              </span>
            </div>
            <h1 className="mb-1 font-heading text-2xl font-semibold tracking-tight text-on-surface">
              Create account
            </h1>
            <p className="max-w-xs text-sm text-on-surface-variant">
              Join ConnectHub to share posts and track engagement.
            </p>
          </div>

          {/* Auth card */}
          <div className="relative overflow-hidden rounded-[2rem] bg-surface-container-lowest p-8 shadow-xl">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-surface-tint to-secondary-container" />

            {error && (
              <p className="mb-5 rounded-xl bg-error-container px-4 py-2.5 text-sm text-error">
                {error}
              </p>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Name */}
              <div className="flex flex-col gap-1 text-left">
                <label className="text-xs font-semibold text-on-surface" htmlFor="name">
                  Full Name
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined pointer-events-none absolute left-3.5 text-[20px] text-outline">
                    badge
                  </span>
                  <input
                    id="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1 text-left">
                <label className="text-xs font-semibold text-on-surface" htmlFor="email">
                  Work Email
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined pointer-events-none absolute left-3.5 text-[20px] text-outline">
                    alternate_email
                  </span>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1 text-left">
                <label className="text-xs font-semibold text-on-surface" htmlFor="password">
                  Password
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined pointer-events-none absolute left-3.5 text-[20px] text-outline">
                    lock
                  </span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="h-11 w-full rounded-2xl bg-surface-container-low pl-11 pr-12 text-sm tracking-wider text-on-surface outline-none transition-all placeholder:text-outline focus:bg-surface-container-lowest focus:shadow-md focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    type="button"
                    aria-label="Toggle password visibility"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 flex items-center justify-center rounded-full p-1 text-outline transition-colors hover:bg-surface-container-high hover:text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="flex h-12 w-full transform items-center justify-center gap-2 rounded-full bg-primary font-heading text-sm font-semibold text-on-primary shadow-lg shadow-primary/20 transition-all hover:bg-primary-container hover:shadow-primary/35 active:scale-[0.99] disabled:opacity-70"
              >
                {loading ? 'Creating account...' : 'Create Account'}
                {!loading && (
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-4 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="h-px w-full bg-surface-container-high" />
              </div>
              <span className="relative bg-surface-container-lowest px-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                Already a member?
              </span>
            </div>

            <Link
              to="/login"
              className="flex h-11 w-full items-center justify-center gap-2.5 rounded-2xl bg-surface-container-low text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container"
            >
              <span className="material-symbols-outlined icon-filled text-[20px] text-primary">
                login
              </span>
              Sign in instead
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
