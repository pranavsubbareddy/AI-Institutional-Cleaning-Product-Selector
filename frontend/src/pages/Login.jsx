import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // preserve redirect-to if coming from ProtectedRoute
  const from = location.state?.from || '/dashboard';

  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const switchMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        if (!displayName.trim()) {
          setError('Display name is required');
          setSubmitting(false);
          return;
        }
        await signUp(email, password, displayName.trim(), { phone: phone.trim(), age: age ? Number(age) : null, gender });
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-500/20">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-surface-100">
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-surface-400 text-sm mt-1">
            {mode === 'login'
              ? 'Sign in to manage your facilities & recommendations'
              : 'Get started with AI-powered cleaning recommendations'}
          </p>
        </div>

        {/* Card */}
        <div className="card p-6 sm:p-8">
          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-800 border border-surface-600/50 text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50 transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91-9876543210"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-800 border border-surface-600/50 text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50 transition-all text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">Age</label>
                    <input
                      type="number"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="25"
                      min={10}
                      max={120}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-800 border border-surface-600/50 text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50 transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">Gender</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-800 border border-surface-600/50 text-surface-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50 transition-all text-sm appearance-none cursor-pointer"
                    >
                      <option value="" disabled className="text-surface-500">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer_not_to_say">Prefer not to say</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-800 border border-surface-600/50 text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50 transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                minLength={6}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-800 border border-surface-600/50 text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50 transition-all text-sm"
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 text-white font-semibold hover:from-cyan-500 hover:to-emerald-500 transition-all duration-200 shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {submitting
                ? 'Please wait\u2026'
                : mode === 'login'
                  ? 'Sign In'
                  : 'Create Account'}
            </button>
          </form>
        </div>

        {/* Footer link */}
        <p className="text-center text-sm text-surface-400 mt-6">
          {mode === 'login' ? (
            <>Don&apos;t have an account?{' '}<button onClick={switchMode} className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">Sign up</button></>
          ) : (
            <>Already have an account?{' '}<button onClick={switchMode} className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">Sign in</button></>
          )}
        </p>

        {/* Skip link */}
        <p className="text-center mt-4">
          <Link to="/" className="text-xs text-surface-500 hover:text-surface-400 transition-colors">
            Back to Home \u2192
          </Link>
        </p>
      </div>
    </div>
  );
}
