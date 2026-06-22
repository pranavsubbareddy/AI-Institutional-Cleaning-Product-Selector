import { useEffect, useRef } from 'react';

export default function ConfirmDialog({
  open,
  title = 'Confirm',
  message = 'Are you sure?',
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
  showDontAskAgain = false,
  dontAskAgain = false,
  onDontAskAgainChange
}) {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (open && confirmRef.current) {
      confirmRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  const loadingLabel = confirmLabel.replace(/e$/, '') + 'ing...';

  const variantStyles = {
    danger: {
      icon: 'bg-red-500/10 text-red-400',
      button: 'bg-red-500 hover:bg-red-600 text-white',
      ring: 'focus:ring-red-500/50'
    },
    primary: {
      icon: 'bg-cyan-500/10 text-cyan-400',
      button: 'bg-cyan-500 hover:bg-cyan-600 text-white',
      ring: 'focus:ring-cyan-500/50'
    },
    warning: {
      icon: 'bg-amber-500/10 text-amber-400',
      button: 'bg-amber-500 hover:bg-amber-600 text-white',
      ring: 'focus:ring-amber-500/50'
    }
  };

  const vs = variantStyles[variant] || variantStyles.danger;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="absolute inset-0 bg-surface-900/80 backdrop-blur-sm" />

      <div
        className="relative bg-surface-800 border border-surface-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className={'w-10 h-10 rounded-xl ' + vs.icon + ' flex items-center justify-center flex-shrink-0'}>
            {variant === 'danger' ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : variant === 'warning' ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 id="confirm-dialog-title" className="text-lg font-semibold text-surface-100">
              {title}
            </h3>
            <p className="text-sm text-surface-400 mt-1 leading-relaxed">
              {message}
            </p>
            {showDontAskAgain && (
              <label className="flex items-center gap-2 mt-4 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={dontAskAgain}
                  onChange={(e) => onDontAskAgainChange?.(e.target.checked)}
                  className="w-4 h-4 rounded border-surface-600 bg-surface-700 text-amber-500 focus:ring-amber-500/30 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-xs text-surface-400 group-hover:text-surface-300 transition-colors select-none">
                  Don't ask again for this session
                </span>
              </label>
            )}
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="btn-secondary text-sm disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            disabled={isLoading}
            className={'px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ' + vs.button + ' ' + vs.ring + ' focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed'}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin w-4 h-4 inline mr-1.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {loadingLabel}
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
