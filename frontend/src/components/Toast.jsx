export default function Toast({ toast, onDismiss }) {
  if (!toast) return null;

  const isError = toast.type === 'error';
  const iconPath = isError
    ? 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
    : 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z';

  return (
    <div
      className={
        'fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg shadow-black/20 backdrop-blur-sm animate-slide-up ' +
        (isError
          ? 'bg-red-500/15 border-red-500/30 text-red-400'
          : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400')
      }
    >
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
      </svg>
      <span className="text-sm font-medium">{toast.message}</span>
      {toast.undo && (
        <button
          onClick={() => { toast.undo.handler(); }}
          className="ml-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-white/10 hover:bg-white/20 transition-all uppercase tracking-wider"
        >
          {toast.undo.label || 'Undo'}
        </button>
      )}
      <button onClick={onDismiss} className="ml-1 opacity-60 hover:opacity-100 transition-opacity">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
