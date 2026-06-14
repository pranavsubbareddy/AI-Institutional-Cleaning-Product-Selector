import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(user?.phoneNumber || '');
  const [age, setAge] = useState(user?.age ? String(user.age) : '');
  const [gender, setGender] = useState(user?.gender || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    await new Promise(r => setTimeout(r, 300));
    updateProfile({ phoneNumber: phone.trim(), age: age ? Number(age) : null, gender });
    setMessage('Profile updated successfully!');
    setSaving(false);
    setEditing(false);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleCancel = () => {
    setPhone(user?.phoneNumber || '');
    setAge(user?.age ? String(user.age) : '');
    setGender(user?.gender || '');
    setEditing(false);
    setMessage('');
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
            <p className="text-sm text-surface-400">{user.email}</p>
            <span className="inline-block mt-1.5 text-[11px] px-2.5 py-0.5 rounded-full bg-surface-700 text-surface-400 border border-surface-600">
              {user.provider === 'google.com' ? 'Google Account' : 'Email Account'}
            </span>
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
              <div className="px-4 py-2.5 rounded-xl bg-surface-800/50 border border-surface-700/50 text-surface-200 text-sm">{user.phoneNumber || 'N/A'}</div>
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
      </div>
    </div>
  );
}
