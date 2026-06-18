import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

const ROLES = [
  { value: 'field_staff', label: 'Field Staff', desc: 'Default role — can access AI Selector, catalog, dashboard' },
  { value: 'salesman', label: 'Salesman', desc: 'Can log visits, build quotations, view contract pricing' },
  { value: 'sales_admin', label: 'Sales Admin', desc: 'Can approve quotations, view revenue, manage deals' },
  { value: 'warehouse_staff', label: 'Warehouse Staff', desc: 'Can manage stock, inventory, trigger shipments' },
  { value: 'delivery_coordinator', label: 'Delivery Coordinator', desc: 'Can manage delivery runs and driver schedules' },
  { value: 'accounts_manager', label: 'Accounts Manager', desc: 'Can view revenue metrics, pricing, orders' },
  { value: 'compliance_admin', label: 'Compliance Admin', desc: 'Can manage MSDS docs and hygiene compliance' },
];

const ROLE_COLORS = {
  admin: 'bg-red-500/10 text-red-400 border-red-500/30',
  field_staff: 'bg-surface-500/10 text-surface-400 border-surface-500/30',
  salesman: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  sales_admin: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  warehouse_staff: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  delivery_coordinator: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  accounts_manager: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  compliance_admin: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
};

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  try { return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return dateStr; }
}

export default function UserRoleManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true); setError('');
      const res = await api.getAdminUsers();
      if (res.success) setUsers(res.data);
      else throw new Error(res.error || 'Failed to load users');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleRoleChange = async (uid, newRole) => {
    try {
      setUpdatingId(uid); setSuccessMsg('');
      const res = await api.updateUserRole(uid, newRole);
      if (res.success) {
        setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role: newRole } : u));
        const label = ROLES.find(r => r.value === newRole)?.label || newRole;
        setSuccessMsg('Role updated to ' + label);
        setTimeout(() => setSuccessMsg(''), 3000);
      } else throw new Error(res.error || 'Failed to update role');
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 4000);
    } finally { setUpdatingId(null); }
  };

  const filteredUsers = users.filter(u => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = (u.displayName || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      if (!name.includes(q) && !email.includes(q)) return false;
    }
    return true;
  });

  if (loading) return <LoadingState />;
  if (error && users.length === 0) return <ErrorState message={error} onRetry={fetchUsers} />;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-1.5 text-sm text-surface-400 hover:text-surface-200 transition-colors mb-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Admin
          </button>
          <h1 className="text-2xl font-bold text-surface-100">User Role Management</h1>
          <p className="text-sm text-surface-400 mt-1">
            {users.length} user{users.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <button
          onClick={fetchUsers}
          className="flex items-center gap-2 px-4 py-2 bg-surface-700/50 border border-surface-600/50 rounded-lg text-sm text-surface-300 hover:bg-surface-700 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Success banner */}
      {successMsg && (
        <div className="mb-4 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-3">
          <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-emerald-300">{successMsg}</p>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
          <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-800/80 border border-surface-700/50 rounded-lg text-sm text-surface-200 placeholder-surface-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="px-3 py-2 bg-surface-800/80 border border-surface-700/50 rounded-lg text-sm text-surface-200 focus:outline-none focus:border-cyan-500/50 transition-colors"
        >
          <option value="">All Roles</option>
          {ROLES.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
          <option value="admin">Administrator</option>
        </select>
        <span className="text-xs text-surface-500">
          {filteredUsers.length} of {users.length} shown
        </span>
      </div>

      {/* Users table */}
      <div className="bg-surface-800/40 border border-surface-700/50 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-700/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Provider</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Joined</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Current Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Change Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700/30">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-surface-500 text-sm">
                    {searchQuery || roleFilter ? 'No users match your filters.' : 'No users registered yet.'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const isAdminSystem = user.uid === 'admin';
                  const isUpdating = updatingId === user.uid;
                  return (
                    <tr key={user.uid} className="hover:bg-surface-700/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {user.photoURL ? (
                            <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full border-2 border-surface-600/50 object-cover" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-surface-700 flex items-center justify-center text-xs font-bold text-surface-400 border border-surface-600/50">
                              {getInitials(user.displayName)}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-surface-200">{user.displayName}</p>
                            {isAdminSystem && (
                              <span className="text-[10px] text-surface-500">System Administrator</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-surface-400">{user.email}</p>
                        {user.emailVerified === 0 && (
                          <span className="text-[10px] text-amber-400">Unverified</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-surface-500 capitalize">{user.provider || 'password'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-surface-500">{formatDate(user.createdAt)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ' + (ROLE_COLORS[user.role] || ROLE_COLORS.field_staff)}>
                          {ROLES.find(r => r.value === user.role)?.label || user.role || 'Field Staff'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isAdminSystem ? (
                          <span className="text-xs text-surface-600 italic">Protected</span>
                        ) : (
                          <div className="relative inline-block">
                            <select
                              value={user.role || 'field_staff'}
                              onChange={e => handleRoleChange(user.uid, e.target.value)}
                              disabled={isUpdating}
                              className={'px-2.5 py-1.5 bg-surface-800 border border-surface-600/50 rounded-lg text-xs text-surface-200 focus:outline-none focus:border-cyan-500/50 transition-colors ' + (isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-surface-500')}
                            >
                              {ROLES.map(r => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                              ))}
                            </select>
                            {isUpdating && (
                              <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cyan-400 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role descriptions */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider mb-3">Available Roles</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ROLES.map(role => (
            <div key={role.value} className="px-4 py-3 bg-surface-800/30 border border-surface-700/30 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <span className={'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ' + ROLE_COLORS[role.value]}>
                  {role.label}
                </span>
              </div>
              <p className="text-xs text-surface-500">{role.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
