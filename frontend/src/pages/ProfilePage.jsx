import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export default function ProfilePage() {
  const { user, updateProfile, logout } = useAuth();
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(user?.phone || '');
  const [age, setAge] = useState(user?.age ? String(user.age) : '');
  const [gender, setGender] = useState(user?.gender || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Email verification
  const { resendVerification } = useAuth();
  const [verifying, setVerifying] = useState(false);

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleResendVerification = async () => {
    setVerifying(true);
    setMessage('');
    try {
      const res = await resendVerification();
      setMessage(res.message || 'Verification email sent!');
    } catch (err) {
      setMessage('Failed: ' + (err.message || 'Unknown error'));
    } finally {
      setVerifying(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      await updateProfile({ phone: phone.trim(), age: age ? Number(age) : null, gender });
      setMessage('Profile updated successfully!');
      setEditing(false);
    } catch (err) {
      setMessage('Failed to update: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleCancel = () => {
    setPhone(user?.phone || '');
    setAge(user?.age ? String(user.age) : '');
    setGender(user?.gender || '');
    setEditing(false);
    setMessage('');
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE' || deleting) return;
    setDeleting(true);
    try {
      await api.deleteAccount();
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      setMessage('Failed to delete account: ' + (err.message || 'Unknown error'));
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (!user) return null;

  const initials = user.displayName
    ? user.displayName.split(' ').map(s => s[0]).join('').toUpperCase().slice(0, 2)
    : user.email?.slice(0, 2).toUpperCase() || 'U';

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="mb-8">
        <button onClick={() => navigate(-1)} className="text-surface-400 hover:text-surface-200 transition-colors mb-4 flex items-center gap-1.5 text-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h1 className="text-2xl font-bold text-surface-100">My Profile</h1>
        <p className="text-surface-400 mt-1">View and manage your account details</p>
      </div>

      <div className="card p-6 mb-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-xl font-bold text-white shadow-lg shadow-cyan-500/20">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="w-16 h-16 rounded-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-surface-100">{user.displayName || 'User'}</h2>
            <p className="text-sm text-surface-400">{user.email}</p>              <span className="inline-block mt-1.5 text-[11px] px-2.5 py-0.5 rounded-full bg-surface-700 text-surface-400 border border-surface-600">
                {user.provider === 'google' ? 'Google Account' : 'Email Account'}
              </span>
              {/* Email Verification Badge */}
              {user.provider !== 'google' && (
                <span className={`inline-block mt-1.5 ml-2 text-[11px] px-2.5 py-0.5 rounded-full border ${
                  user.emailVerified
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}>
                  {user.emailVerified ? '✓ Verified' : '○ Unverified'}
                </span>
              )}
          </div>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-semibold text-surface-100">Account Details</h3>
          {!editing ? (
            <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/20 text-sm font-medium transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Profile
            </button>
          ) : (
            <span className="text-xs text-cyan-400 font-medium">Editing...</span>
          )}
        </div>

        {message && (
          <div className="mb-5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-000/20 text-emerald-300 text-sm flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {message}
          </div>
        )}

        <div className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1.5">Display Name</label>
            <div className="px-4 py-2.5 rounded-xl bg-surface-800/50 border border-surface-700/50 text-surface-200 text-sm">{user.displayName || 'User'}</div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1.5">Email</label>
            <div className="px-4 py-2.5 rounded-xl bg-surface-800/50 border border-surface-700/50 text-surface-200 text-sm">{user.email}</div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1.5">Phone Number</label>
            {editing ? (
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91-9876543210" className="w-full px-4 py-2.5 rounded-xl bg-surface-800 border border-surface-600/50 text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50 transition-all text-sm" />
            ) : (
              <div className="px-4 py-2.5 rounded-xl bg-surface-800/50 border border-surface-700/50 text-surface-200 text-sm">{user.phone || 'N/A'}</div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1.5">Age</label>
            {editing ? (
              <input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="25" min={10} max={120} className="w-full px-4 py-2.5 rounded-xl bg-surface-800 border border-surface-600/50 text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50 transition-all text-sm" />
            ) : (
              <div className="px-4 py-2.5 rounded-xl bg-surface-800/50 border border-surface-700/50 text-surface-200 text-sm">{user.age || 'N/A'}</div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1.5">Gender</label>
            {editing ? (
              <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-surface-800 border border-surface-600/50 text-surface-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50 transition-all text-sm appearance-none cursor-pointer">
                <option value="" className="text-surface-500">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            ) : (
              <div className="px-4 py-2.5 rounded-xl bg-surface-800/50 border border-surface-700/50 text-surface-200 text-sm capitalize">{user.gender ? user.gender.replace(/_/g, ' ') : 'N/A'}</div>
            )}
          </div>
        </div>

        {editing && (
          <div className="flex items-center gap-3 mt-8 pt-6 border-t border-surface-700">
            <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 text-white font-semibold hover:from-cyan-500 hover:to-emerald-500 transition-all duration-200 shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </span>
              ) : (
                'Save Changes'
              )}
            </button>
            <button onClick={handleCancel} disabled={saving} className="px-6 py-2.5 rounded-xl border border-surface-600 text-surface-300 hover:bg-surface-700/50 hover:text-surface-100 transition-all text-sm font-medium disabled:opacity-50">Cancel</button>
          </div>
        )}

        {/* Email Verification */}
        {user.provider !== 'google' && !user.emailVerified && (
          <div className="mt-6 pt-6 border-t border-surface-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-400">Email not verified</p>
                <p className="text-xs text-surface-400 mt-0.5">Verify your email to enable login notifications</p>
              </div>
              <button
                onClick={handleResendVerification}
                disabled={verifying}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 text-sm font-medium transition-all disabled:opacity-50"
              >
                {verifying ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                )}
                {verifying ? 'Sending...' : 'Resend Verification'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Danger Zone: Delete Account ──────────────────────────── */}
      <div className="mt-10 pt-8 border-t border-red-500/20">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-surface-100">Danger Zone</h3>
            <p className="text-sm text-surface-400">Permanently delete your account and all associated data</p>
          </div>
        </div>

        <button
          onClick={() => { setShowDeleteModal(true); setDeleteConfirmText(''); }}
          className="mt-4 px-5 py-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:text-red-300 transition-all text-sm font-medium"
        >
          <svg className="w-4 h-4 inline mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete Account
        </button>
      </div>

      {/* ── Delete Confirmation Modal ──────────────────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowDeleteModal(false)}>
          <div className="absolute inset-0 bg-surface-900/80 backdrop-blur-sm" />
          <div className="relative bg-surface-800 border border-red-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-surface-100">Delete Account</h3>
                <p className="text-sm text-surface-400">This action cannot be undone</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20">
                <p className="text-sm text-red-300">
                  This will permanently delete your account <strong>{user.email}</strong> along with:
                </p>
                <ul className="mt-2 space-y-1 text-sm text-red-400/80 list-disc list-inside">
                  <li>All facility profiles you created</li>
                  <li>All product recommendations and reports</li>
                  <li>All associated data and history</li>
                </ul>
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1.5">
                  Type <span className="font-mono text-red-400">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  autoFocus
                  className="w-full px-4 py-2.5 bg-surface-700 border border-surface-600 rounded-xl text-surface-100 placeholder-surface-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/50 transition-colors text-sm"
                  onKeyDown={e => { if (e.key === 'Enter' && deleteConfirmText === 'DELETE' && !deleting) handleDeleteAccount(); }}
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }}
                  disabled={deleting}
                  className="px-5 py-2.5 rounded-xl border border-surface-600 text-surface-300 hover:bg-surface-700/50 transition-all text-sm font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== 'DELETE' || deleting}
                  className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-500 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-600/20"
                >
                  {deleting ? (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Deleting...
                    </span>
                  ) : (
                    'Delete My Account'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
