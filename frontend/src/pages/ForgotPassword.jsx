import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(1); // 1: email, 2: otp, 3: new password, 4: done
  const [email, setEmail] = useState(location.state?.email || '');
  const [displayName, setDisplayName] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownTimerRef = useRef(null);

  const otpRefs = [useRef(null), useRef(null), useRef(null), useRef(null), useRef(null), useRef(null)];

  // On mount, try to get logged-in user's email as a fallback
  useEffect(() => {
    if (!email) {
      api.getMe()
        .then(res => {
          if (res.success && res.data?.email && !email) {
            setEmail(res.data.email);
          }
        })
        .catch(() => {});
    }
  }, []);

  // Cleanup cooldown timer on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
      }
    };
  }, []);

  const startCooldown = () => {
    // Clear any existing timer first
    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
    }
    setCooldown(30);
    cooldownTimerRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          if (cooldownTimerRef.current) {
            clearInterval(cooldownTimerRef.current);
            cooldownTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await api.forgotPassword(email);
      if (res.success) {
        // Seed users get the OTP in response when email is not configured
        if (res.data?.otp) {
          // Auto-fill OTP for seed users in dev mode
          const digits = res.data.otp.split('');
          setOtp(digits);
        }
        setStep(2);
        startCooldown();
      } else {
        setError(res.error || 'Something went wrong');
      }
    } catch (err) {
      setError(err.message || 'Could not send OTP. Please try again later.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOTP = async () => {
    if (cooldown > 0) return;
    setError('');
    setResending(true);
    // Clear OTP fields for fresh input
    setOtp(['', '', '', '', '', '']);

    try {
      const res = await api.forgotPassword(email);
      if (res.success) {
        if (res.data?.otp) {
          const digits = res.data.otp.split('');
          setOtp(digits);
        }
        startCooldown();
        // Focus first OTP input
        otpRefs[0].current?.focus();
      } else {
        setError(res.error || 'Something went wrong');
      }
    } catch (err) {
      setError(err.message || 'Could not resend OTP');
    } finally {
      setResending(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (value && !/^\d+$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      otpRefs[index + 1].current?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
    if (e.key === 'Enter') {
      handleVerifyOTP();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const paste = e.clipboardData.getData('text').trim();
    if (!/^\d{6}$/.test(paste)) return;
    const digits = paste.split('');
    setOtp(digits);
    otpRefs[5].current?.focus();
  };

  const handleVerifyOTP = async () => {
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      setError('Please enter the complete 6-digit OTP');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const res = await api.verifyResetOTP(email, otpString);
      if (res.success && res.data) {
        setDisplayName(res.data.displayName);
        setVerificationToken(res.data.verificationToken);
        setStep(3);
      } else {
        setError(res.error || 'Invalid OTP');
      }
    } catch (err) {
      setError(err.message || 'Failed to verify OTP');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.resetPassword(verificationToken, email, password);
      if (res.success) {
        setStep(4);
        setTimeout(() => navigate('/login'), 3000);
      } else {
        setError(res.error || 'Failed to reset password');
      }
    } catch (err) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Step 4: Done ──────────────────────────────────────────────────
  if (step === 4) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          <div className="card p-6 sm:p-8 text-center">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-surface-100 mb-2">Password Reset!</h2>
            <p className="text-sm text-surface-400 mb-6">
              Your password has been reset successfully. Redirecting you to login...
            </p>
            <Link
              to="/login"
              className="inline-block px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 text-white font-semibold hover:from-cyan-500 hover:to-emerald-500 transition-all text-sm"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-500/20">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-surface-100">Forgot Password</h1>

          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step === s
                    ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-white shadow-lg shadow-cyan-500/20'
                    : step > s
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-surface-700 text-surface-400'
                }`}>
                  {step > s ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    s
                  )}
                </div>
                {s < 3 && (
                  <div className={`w-8 h-0.5 rounded-full ${
                    step > s ? 'bg-emerald-500/50' : 'bg-surface-700'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <p className="text-surface-400 text-sm mt-2">
            {step === 1 && 'Enter your email to receive a reset OTP'}
            {step === 2 && 'Enter the 6-digit OTP sent to your email'}
            {step === 3 && 'Create a new password for your account'}
          </p>
        </div>

        <div className="card p-6 sm:p-8">
          {/* ── Step 1: Email ──────────────────────────────────────── */}
          {step === 1 && (
            <form onSubmit={handleSendOTP} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Email Address</label>
                {email ? (
                  <div className="w-full px-3.5 py-2.5 rounded-xl bg-surface-700/50 border border-surface-600/30 text-surface-100 text-sm select-all cursor-default">
                    {email}
                  </div>
                ) : (
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-800 border border-surface-600/50 text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50 transition-all text-sm"
                  />
                )}
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
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Sending OTP...
                  </span>
                ) : (
                  'Send OTP'
                )}
              </button>
            </form>
          )}

          {/* ── Step 2: OTP ─────────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-surface-400 text-center">
                Enter the 6-digit code sent to <span className="text-cyan-400 font-medium">{email}</span>
              </p>

              {/* OTP Input */}
              <div className="flex items-center justify-center gap-2 sm:gap-3">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={otpRefs[index]}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    autoComplete="one-time-code"
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onPaste={index === 0 ? handleOtpPaste : undefined}
                    className={`w-10 sm:w-12 h-12 sm:h-14 text-center text-lg sm:text-xl font-bold rounded-xl bg-surface-800 border text-surface-100 transition-all focus:outline-none focus:ring-2 ${
                      error
                        ? 'border-red-500/50 focus:ring-red-500/40'
                        : 'border-surface-600/50 focus:ring-cyan-500/40 focus:border-cyan-500/50'
                    }`}
                  />
                ))}
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                  {error}
                </div>
              )}

              <button
                onClick={handleVerifyOTP}
                disabled={submitting || otp.join('').length !== 6}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 text-white font-semibold hover:from-cyan-500 hover:to-emerald-500 transition-all duration-200 shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Verifying...
                  </span>
                ) : (
                  'Verify OTP'
                )}
              </button>

              <div className="text-center pt-2">
                {cooldown > 0 ? (
                  <p className="text-xs text-surface-500">
                    Resend OTP in <span className="text-cyan-400 font-medium">{cooldown}s</span>
                  </p>
                ) : (
                  <button
                    onClick={handleResendOTP}
                    disabled={resending}
                    className="text-sm text-cyan-400 hover:text-cyan-300 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resending ? 'Resending...' : 'Resend OTP'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Step 3: New Password ─────────────────────────────────── */}
          {step === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              {displayName && (
                <p className="text-sm text-surface-400 text-center">
                  Hi <span className="text-surface-200 font-medium">{displayName}</span>, choose your new password:
                </p>
              )}

              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-800 border border-surface-600/50 text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50 transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
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
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Resetting...
                  </span>
                ) : (
                  'Reset Password'
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center mt-6">
          <Link to="/login" className="text-sm text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
            <span className="flex items-center justify-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Login
            </span>
          </Link>
        </p>
      </div>
    </div>
  );
}
