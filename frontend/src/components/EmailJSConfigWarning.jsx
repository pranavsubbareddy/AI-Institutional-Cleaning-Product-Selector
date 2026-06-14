import { useState, useEffect } from 'react';
import { isEmailJSConfigured } from '../services/emailService';

const STORAGE_KEY = 'gangamaxx_emailjs_warning_dismissed';

const ENV_VAR_INFO = [
  { key: 'VITE_EMAILJS_PUBLIC_KEY', label: 'Public Key' },
  { key: 'VITE_EMAILJS_SERVICE_ID', label: 'Service ID' },
  { key: 'VITE_EMAILJS_CONFIRMATION_TEMPLATE_ID', label: 'Template ID' },
];

export default function EmailJSConfigWarning({ inline = false }) {
  const [configured, setConfigured] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setConfigured(isEmailJSConfigured());
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') setDismissed(true);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY, 'true');
  };

  if (configured || dismissed) return null;

  const actuallyMissing = [];
  if (!import.meta.env.VITE_EMAILJS_PUBLIC_KEY) actuallyMissing.push('VITE_EMAILJS_PUBLIC_KEY');
  if (!import.meta.env.VITE_EMAILJS_SERVICE_ID) actuallyMissing.push('VITE_EMAILJS_SERVICE_ID');
  if (!import.meta.env.VITE_EMAILJS_CONFIRMATION_TEMPLATE_ID) actuallyMissing.push('VITE_EMAILJS_CONFIRMATION_TEMPLATE_ID');

  return (
    <div className={`rounded-xl border bg-amber-500/10 border-amber-500/20 ${inline ? 'p-4' : 'p-5'}`}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-amber-300">EmailJS Not Configured</h4>
              <p className="text-xs text-amber-400/80 mt-1">
                The email report feature requires EmailJS setup. Add the following environment variables:
              </p>
            </div>
            {!inline && (
              <button onClick={handleDismiss}
                className="p-1 rounded-lg hover:bg-amber-500/10 transition-colors flex-shrink-0"
                title="Dismiss">
                <svg className="w-4 h-4 text-amber-400/60 hover:text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <div className="mt-3 space-y-1.5">
            {ENV_VAR_INFO.map(v => {
              const isMissing = actuallyMissing.includes(v.key);
              return (
                <div key={v.key} className="flex items-center gap-2 text-xs">
                  {isMissing ? (
                    <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  <code className={`font-mono px-1.5 py-0.5 rounded text-[11px] ${
                    isMissing ? 'bg-red-500/10 text-red-300' : 'bg-emerald-500/10 text-emerald-300'
                  }`}>{v.key}</code>
                  <span className={isMissing ? 'text-amber-400' : 'text-emerald-400'}>
                    {isMissing ? `— ${v.label} required` : '✓ Configured'}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-400/70">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              Add these to your <code className="font-mono bg-amber-500/10 px-1 rounded text-[11px]">.env</code> file or Vercel environment variables.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
