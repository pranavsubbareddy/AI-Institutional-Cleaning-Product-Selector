import { useState } from 'react';

export default function ActionLog({ actions = [], title = 'Action Log' }) {
  const [expanded, setExpanded] = useState(true);

  if (!actions || actions.length === 0) {
    return null;
  }

  const getActionIcon = (action) => {
    const lower = (action || '').toLowerCase();
    if (lower.includes('approve') || lower.includes('approved')) return 'check';
    if (lower.includes('reject') || lower.includes('rejected')) return 'close';
    if (lower.includes('create') || lower.includes('generat') || lower.includes('process')) return 'plus';
    if (lower.includes('update') || lower.includes('modif') || lower.includes('edit') || lower.includes('change')) return 'edit';
    if (lower.includes('ship') || lower.includes('dispatch') || lower.includes('deliver')) return 'truck';
    if (lower.includes('cancel') || lower.includes('void')) return 'cancel';
    if (lower.includes('quote') || lower.includes('quotation')) return 'file';
    if (lower.includes('assign') || lower.includes('transfer')) return 'user';
    return 'dot';
  };

  const iconPaths = {
    check: 'M5 13l4 4L19 7',
    close: 'M6 18L18 6M6 6l12 12',
    plus: 'M12 6v6m0 0v6m0-6h6m-6 0H6',
    edit: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
    truck: 'M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0',
    cancel: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    file: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    user: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    dot: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
  };

  const getIconColor = (action) => {
    const lower = (action || '').toLowerCase();
    if (lower.includes('approve') || lower.includes('create') || lower.includes('generat')) return 'emerald';
    if (lower.includes('reject') || lower.includes('cancel') || lower.includes('void')) return 'red';
    if (lower.includes('ship') || lower.includes('dispatch') || lower.includes('deliver')) return 'blue';
    if (lower.includes('update') || lower.includes('modif') || lower.includes('edit') || lower.includes('change')) return 'amber';
    return 'cyan';
  };

  const timelineDotColors = {
    emerald: 'bg-emerald-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
    cyan: 'bg-cyan-500',
  };

  return (
    <div className="card p-5 animate-fade-in">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between mb-3"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="font-semibold text-surface-100 text-sm">{title}</h3>
          <span className="badge bg-surface-700 text-surface-400 border border-surface-600 text-[10px]">{actions.length} entries</span>
        </div>
        <svg
          className={"w-4 h-4 text-surface-400 transition-transform duration-200 " + (expanded ? 'rotate-180' : '')}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div className={"transition-all duration-300 overflow-hidden " + (expanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0')}>
        <div className="relative">
          <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-surface-700" />

          <div className="space-y-0">
            {actions.map((entry, i) => {
              const iconType = getActionIcon(entry.action);
              const iconColor = getIconColor(entry.action);
              const formattedTime = entry.timestamp
                ? new Date(entry.timestamp).toLocaleString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })
                : null;

              return (
                <div key={i} className="relative flex gap-3 pb-4 last:pb-0">
                  <div className={"relative z-10 mt-0.5 w-6 h-6 rounded-full " + timelineDotColors[iconColor] + " flex items-center justify-center flex-shrink-0 shadow-sm"}>
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={iconPaths[iconType]} />
                    </svg>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-surface-200">{entry.action}</p>
                      {entry.user && (
                        <span className="badge bg-surface-700/50 text-surface-400 border border-surface-600/50 text-[10px] flex-shrink-0">
                          {entry.user}
                        </span>
                      )}
                    </div>
                    {entry.details && (
                      <p className="text-xs text-surface-400 mt-0.5">{entry.details}</p>
                    )}
                    {formattedTime && (
                      <p className="text-[10px] text-surface-500 mt-0.5">{formattedTime}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
