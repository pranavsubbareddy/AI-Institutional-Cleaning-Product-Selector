export default function EmptyState({ title = 'No data found', description = 'There are no items to display.', action, actionLabel }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
      <div className="w-20 h-20 bg-surface-700/50 rounded-full flex items-center justify-center mb-4 border border-surface-600">
        <svg className="w-10 h-10 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-surface-200 mb-1">{title}</h3>
      <p className="text-surface-400 text-sm mb-4 text-center max-w-md">{description}</p>
      {action && (
        <button onClick={action} className="btn-primary text-sm">
          {actionLabel || 'Create New'}
        </button>
      )}
    </div>
  );
}
