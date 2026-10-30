import { useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

const errMsg = (err, fallback) => {
  const msg = err.response?.data?.message;
  return Array.isArray(msg) ? msg[0] : msg || fallback;
};

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [issued, setIssued] = useState(null); // { email, password }

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/users", { params: { search, role } });
      setUsers(data);
      setError("");
    } catch (err) {
      setError(errMsg(err, "Could not load users"));
    } finally {
      setLoading(false);
    }
  };

  // Debounce so we don't hit the API on every keystroke
  useEffect(() => {
    const t = setTimeout(fetchUsers, 300);
    return () => clearTimeout(t);
  }, [search, role]);

  const changeRole = async (u, nextRole) => {
    if (nextRole === u.role) return;
    setBusyId(u.id);
    setError("");
    try {
      const { data } = await api.patch(`/users/${u.id}`, { role: nextRole });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? data : x)));
    } catch (err) {
      setError(errMsg(err, "Could not change role"));
      fetchUsers();
    } finally {
      setBusyId(null);
    }
  };

  const resetPassword = async (u) => {
    if (
      !window.confirm(
        `Reset the password for ${u.name}? They will be signed out.`,
      )
    )
      return;
    setBusyId(u.id);
    setError("");
    try {
      const { data } = await api.post(`/users/${u.id}/reset-password`, {});
      setIssued({ email: u.email, password: data.tempPassword });
    } catch (err) {
      setError(errMsg(err, "Could not reset password"));
    } finally {
      setBusyId(null);
    }
  };

  const removeUser = async (u) => {
    if (!window.confirm(`Delete ${u.name}? Their posts will be removed too.`))
      return;
    setBusyId(u.id);
    setError("");
    try {
      await api.delete(`/users/${u.id}`);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } catch (err) {
      setError(errMsg(err, "Could not delete user"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="mb-6 flex flex-col gap-1 pt-2">
        <span className="w-fit rounded-full bg-primary-fixed px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
          Member Directory
        </span>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-on-surface">
          Users
        </h1>
        <p className="text-sm text-on-surface-variant">
          Search members, filter by role and manage access.
        </p>
      </div>

      {/* Search + role filter */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex w-full items-center sm:max-w-xs">
          <span className="material-symbols-outlined pointer-events-none absolute left-3.5 text-[20px] text-outline">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full rounded-2xl bg-surface-container-lowest py-2.5 pl-11 pr-4 text-sm text-on-surface shadow-sm outline-none transition-all placeholder:text-outline focus:shadow-[0_0_0_3px_rgba(67,56,202,0.15)]"
          />
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-2xl bg-surface-container-lowest px-4 py-2.5 text-sm text-on-surface shadow-sm outline-none transition-all focus:shadow-[0_0_0_3px_rgba(67,56,202,0.15)]"
        >
          <option value="">All roles</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>
      </div>

      {error && (
        <p className="mb-4 rounded-xl bg-error-container px-4 py-2.5 text-sm text-error">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl bg-surface-container-lowest shadow-[0_4px_20px_-2px_rgba(67,56,202,0.06)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-outline-variant/40 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            <tr>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Joined</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan="5"
                  className="px-6 py-10 text-center text-on-surface-variant"
                >
                  Loading...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td
                  colSpan="5"
                  className="px-6 py-10 text-center text-on-surface-variant"
                >
                  No users found
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const isSelf = u.id === me?.id;
                const busy = busyId === u.id;
                return (
                  <tr
                    key={u.id}
                    className="border-b border-outline-variant/20 transition-colors last:border-0 hover:bg-surface-container-low/50"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3 font-semibold text-on-surface">
                        <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary-fixed text-xs font-bold text-primary">
                          {u.avatarUrl ? (
                            <img
                              src={`${api.defaults.baseURL}${u.avatarUrl}`}
                              alt={u.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            u.name[0]?.toUpperCase()
                          )}
                        </span>
                        <span className="flex items-center gap-2">
                          {u.name}
                          {isSelf && (
                            <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-bold text-on-surface-variant">
                              You
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant">
                      {u.email}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={u.role}
                        disabled={isSelf || busy}
                        onChange={(e) => changeRole(u, e.target.value)}
                        title={
                          isSelf
                            ? "You cannot change your own role"
                            : "Change role"
                        }
                        className={`rounded-xl bg-surface-container-high px-3 py-1.5 text-xs font-bold capitalize outline-none transition-colors focus:shadow-[0_0_0_3px_rgba(67,56,202,0.15)] ${
                          isSelf
                            ? "cursor-not-allowed opacity-60"
                            : "cursor-pointer"
                        } ${u.role === "admin" ? "text-primary" : "text-on-surface-variant"}`}
                      >
                        <option value="admin">Admin</option>
                        <option value="user">User</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => resetPassword(u)}
                          disabled={busy}
                          title="Reset password"
                          className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary disabled:opacity-40"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            key
                          </span>
                        </button>
                        <button
                          onClick={() => removeUser(u)}
                          disabled={isSelf || busy}
                          title={
                            isSelf
                              ? "You cannot delete your own account"
                              : "Delete user"
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-error-container hover:text-error disabled:opacity-40"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            delete
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* One-time password display after an admin reset */}
      {issued && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/40 p-4 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setIssued(null)} />
          <div className="relative z-10 w-full max-w-md rounded-[2rem] bg-surface-container-lowest p-8 shadow-2xl">
            <h3 className="font-heading text-xl font-bold text-on-surface">
              Password reset
            </h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              New password for{" "}
              <span className="font-semibold text-on-surface">
                {issued.email}
              </span>
              . It is shown once. Share it securely; the user must sign in
              again.
            </p>
            <p className="mt-4 select-all break-all rounded-xl bg-surface-container-low px-4 py-3 font-mono text-sm text-on-surface">
              {issued.password}
            </p>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setIssued(null)}
                className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-on-primary shadow-md transition-colors hover:bg-primary-container"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
