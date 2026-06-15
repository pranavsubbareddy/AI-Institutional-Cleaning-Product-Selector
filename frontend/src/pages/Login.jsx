import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export default function Login() {
  const { signIn, signUp, googleSignIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const googleBtnRef = useRef(null);

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
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

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

  const [googleClientId, setGoogleClientId] = useState('');

  // Fetch Google Client ID from backend on mount
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (clientId) {
      setGoogleClientId(clientId);
      return;
    }
    // Fallback: fetch from backend
    api.googleConfig()
      .then(res => {
        if (res.success && res.data?.clientId) {
          setGoogleClientId(res.data.clientId);
        }
      })
      .catch(() => {});
  }, []);

  // Load Google Identity Services script when client ID is available
  useEffect(() => {
    if (googleClientId && !document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, [googleClientId]);

  const handleGoogleSignIn = async () => {
    setGoogleSubmitting(true);
    setError('');

    try {
      const clientId = googleClientId;
      if (!window.google?.accounts || !clientId) {
        setError('Google Sign-In is not configured. Please set GOOGLE_CLIENT_ID in Vercel environment variables.');
        setGoogleSubmitting(false);
        return;
      }

      // Use Google One Tap to get a credential (ID token)
      const credential = await new Promise((resolve, reject) => {
        // Initialize the token client to request an ID token
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response.credential) {
              resolve(response.credential);
            } else {
              reject(new Error('Google Sign-In failed: No credential received'));
            }
          },
          cancel_on_tap_outside: false,
        });

        // Prompt the One Tap UI
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // One Tap not shown — fall back to the popup flow
            // Use the overridable Google Sign-In button approach
            const client = window.google.accounts.oauth2.initCodeClient({
              client_id: clientId,
              scope: 'email profile openid',
              ux_mode: 'popup',
              callback: (codeResponse) => {
                if (codeResponse.code) {
                  // Send auth code to backend — the backend will exchange it
                  resolve(codeResponse.code);
                } else {
                  reject(new Error('Google Sign-In was cancelled'));
                }
              },
            });
            client.requestCode();
          }
        });
      });

      // Send credential/auth code to backend
      await googleSignIn(credential);
      navigate(from, { replace: true });
    } catch (err) {
      if (!err.message?.includes('cancelled') && !err.message?.includes('popup')) {
        setError(err.message || 'Google Sign-In failed');
      }
    } finally {
      setGoogleSubmitting(false);
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

            {/* Forgot Password - login mode only */}
            {mode === 'login' && (
              <div className="flex justify-end">
                <Link to="/forgot-password" className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
                  Forgot password?
                </Link>
              </div>
            )}

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
                ? 'Please wait…'
                : mode === 'login'
                  ? 'Sign In'
                  : 'Create Account'}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-surface-700/50" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-surface-800 px-3 text-surface-400">or continue with</span>
            </div>
          </div>

          {/* Google Sign-In Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={googleSubmitting}
            className="w-full py-2.5 rounded-xl border border-surface-600/50 text-surface-200 font-medium hover:bg-surface-700/50 hover:border-surface-500/50 transition-all text-sm flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {googleSubmitting ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            {googleSubmitting ? 'Signing in...' : 'Sign in with Google'}
          </button>
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
            Back to Home →
          </Link>
        </p>
      </div>
    </div>
  );
}
