import { useEffect, useState } from 'react';
import api from '../api/axios';
import { toUserMessage } from '../api/errors';
import { useAuth } from '../context/AuthContext';

const ACCEPTED_PHOTO = 'image/jpeg,image/png,image/gif,image/webp';

// Uploaded files are served by the API, not the frontend dev server
const mediaSrc = (url) => `${api.defaults.baseURL}${url}`;

export default function Profile() {
  const { user, updateUser } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [profile, setProfile] = useState(null);

  // Account form
  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState(null); // {ok, text}

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPass, setSavingPass] = useState(false);
  const [passMsg, setPassMsg] = useState(null);

  // Photo uploads
  const [uploadingPhoto, setUploadingPhoto] = useState(null); // 'avatar' | 'cover' | null

  const uploadPhoto = (kind) => async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingPhoto(kind);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post(`/users/me/${kind}`, form);
      setProfile(data);
      if (kind === 'avatar') updateUser({ avatarUrl: data.avatarUrl });
    } catch (err) {
      window.alert(toUserMessage(err, 'Upload failed'));
    } finally {
      setUploadingPhoto(null);
    }
  };

  useEffect(() => {
    api.get('/users/me').then((res) => {
      setProfile(res.data);
      setName(res.data.name);
    });
  }, []);

  const saveName = async (e) => {
    e.preventDefault();
    setNameMsg(null);
    setSavingName(true);
    try {
      const { data } = await api.patch('/users/me', { name });
      setProfile(data);
      updateUser({ name: data.name });
      setNameMsg({ ok: true, text: 'Name updated' });
    } catch (err) {
      setNameMsg({ ok: false, text: toUserMessage(err, 'Could not update your name') });
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPassMsg(null);
    setSavingPass(true);
    try {
      // The API answers 401 when the current password is wrong. That is a
      // form error, not an expired session, so keep the user signed in.
      await api.patch('/users/me', { currentPassword, newPassword }, { skipAuthRedirect: true });
      setCurrentPassword('');
      setNewPassword('');
      setPassMsg({ ok: true, text: 'Password changed' });
    } catch (err) {
      setPassMsg({ ok: false, text: toUserMessage(err, 'Could not change your password') });
    } finally {
      setSavingPass(false);
    }
  };

  const inputClass =
    'w-full rounded-2xl bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition-all placeholder:text-outline focus:bg-surface-container-lowest focus:shadow-[0_0_0_3px_rgba(67,56,202,0.15)]';

  const Msg = ({ msg }) =>
    msg && (
      <p
        // Errors must be announced; a plain <p> is silent for screen readers.
        role={msg.ok ? 'status' : 'alert'}
        className={`rounded-xl px-4 py-2.5 text-sm ${
          msg.ok ? 'bg-secondary-container/50 text-secondary' : 'bg-error-container text-error'
        }`}
      >
        {msg.text}
      </p>
    );

  if (!profile) {
    return <p className="py-20 text-center text-sm text-on-surface-variant">Loading profile...</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {/* Banner card */}
      <section className="relative overflow-hidden rounded-[2rem] bg-surface-container-lowest shadow-[0_4px_20px_-2px_rgba(67,56,202,0.06)]">
        {/* Cover photo (falls back to gradient) */}
        <div className="relative h-36 w-full overflow-hidden bg-gradient-to-r from-primary via-primary-container to-secondary sm:h-44">
          {profile.coverUrl ? (
            <img
              src={mediaSrc(profile.coverUrl)}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <>
              <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] opacity-20 [background-size:16px_16px]" />
              <div className="pointer-events-none absolute -right-16 -top-20 h-80 w-80 rounded-full bg-secondary-container/20 blur-3xl" />
            </>
          )}
          <label
            htmlFor="cover-upload"
            className="absolute bottom-3 right-3 z-10 flex cursor-pointer items-center gap-1.5 rounded-full bg-on-surface/60 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-on-surface/80"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">photo_camera</span>
            {uploadingPhoto === 'cover'
              ? 'Uploading...'
              : profile.coverUrl
                ? 'Change cover'
                : 'Add cover'}
          </label>
          <input
            id="cover-upload"
            type="file"
            accept={ACCEPTED_PHOTO}
            onChange={uploadPhoto('cover')}
            className="hidden"
          />
        </div>

        <div className="relative px-6 pb-6 sm:px-10">
          <div className="-mt-14 flex flex-col justify-between gap-4 sm:-mt-16 md:flex-row md:items-end">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end">
              <div className="relative">
                <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-primary font-heading text-4xl font-bold text-on-primary shadow-xl ring-4 ring-surface-container-lowest sm:h-32 sm:w-32">
                  {profile.avatarUrl ? (
                    <img
                      src={mediaSrc(profile.avatarUrl)}
                      alt={profile.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    profile.name[0]?.toUpperCase()
                  )}
                </div>
                <label
                  htmlFor="avatar-upload"
                  title={uploadingPhoto === 'avatar' ? 'Uploading...' : 'Change profile photo'}
                  className="absolute bottom-1 right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-primary text-on-primary shadow-md ring-2 ring-surface-container-lowest transition-colors hover:bg-primary-container"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                    {uploadingPhoto === 'avatar' ? 'hourglass_top' : 'photo_camera'}
                  </span>
                </label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept={ACCEPTED_PHOTO}
                  onChange={uploadPhoto('avatar')}
                  className="hidden"
                />
              </div>
              <div className="flex translate-y-2 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-heading text-2xl font-semibold tracking-tight text-on-surface sm:text-3xl">
                    {profile.name}
                  </h1>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      isAdmin ? 'bg-primary-fixed text-primary' : 'bg-secondary-container text-secondary'
                    }`}
                  >
                    {profile.role}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant">
                  <span className="font-semibold text-on-surface">{profile.email}</span>
                  <span className="flex items-center gap-1">
                    <span aria-hidden="true" className="material-symbols-outlined text-[16px]">calendar_today</span>
                    Member since{' '}
                    {new Date(profile.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="contents">
          {/* Personal information */}
          <section className="flex flex-col gap-4 rounded-[2rem] bg-surface-container-lowest p-6 shadow-[0_4px_20px_-2px_rgba(67,56,202,0.06)] sm:p-8">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="material-symbols-outlined text-[22px] text-primary">badge</span>
              <h2 className="font-heading text-lg font-semibold text-on-surface">Personal Information</h2>
            </div>

            <form onSubmit={saveName} className="flex flex-col gap-4">
              <Msg msg={nameMsg} />
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant" htmlFor="name">
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant" htmlFor="email">
                  Email Address
                </label>
                <input id="email" type="email" value={profile.email} disabled className={`${inputClass} cursor-not-allowed opacity-60`} />
              </div>
              <button
                type="submit"
                disabled={savingName || name === profile.name}
                className="self-start rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-on-primary shadow-md transition-all hover:bg-primary-container disabled:opacity-50"
              >
                {savingName ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </section>

          {/* Security */}
          <section className="flex flex-col gap-4 rounded-[2rem] bg-surface-container-lowest p-6 shadow-[0_4px_20px_-2px_rgba(67,56,202,0.06)] sm:p-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="material-symbols-outlined text-[22px] text-primary">security</span>
                <h2 className="font-heading text-lg font-semibold text-on-surface">Security</h2>
              </div>
              <span className="rounded-full bg-secondary-container px-2.5 py-0.5 text-[10px] font-bold text-secondary">
                Protected
              </span>
            </div>

            <form onSubmit={savePassword} className="flex flex-col gap-4">
              <Msg msg={passMsg} />
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant" htmlFor="current-pass">
                  Current Password
                </label>
                <input
                  id="current-pass"
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant" htmlFor="new-pass">
                  New Password
                </label>
                <input
                  id="new-pass"
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={savingPass}
                className="self-start rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-on-primary shadow-md transition-all hover:bg-primary-container disabled:opacity-50"
              >
                {savingPass ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </section>
        </div>

      </div>
    </div>
  );
}
