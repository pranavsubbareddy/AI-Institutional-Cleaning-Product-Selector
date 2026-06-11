export default function ProductCard({ item, onCopyQuotation }) {
  const priorityColors = {
    1: 'border-l-emerald-500',
    2: 'border-l-cyan-500',
    3: 'border-l-surface-600'
  };

  const priorityLabels = {
    1: 'High Priority',
    2: 'Medium Priority',
    3: 'Standard'
  };

  // Safety alert level
  const isHighHazard = item.safety_notes?.toLowerCase().includes('danger') 
    || item.safety_notes?.toLowerCase().includes('corrosive')
    || item.safety_notes?.toLowerCase().includes('severe');

  return (
    <div className={`card border-l-4 ${priorityColors[item.priority] || 'border-l-surface-600'} p-5 animate-slide-up`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-surface-100 truncate">{item.product_name}</h3>
          <div className="flex flex-wrap gap-2 mt-2">
            {item.sku && (
              <span className="badge bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono text-[10px]">
                SKU: {item.sku}
              </span>
            )}
            <span className="badge bg-accent-500/10 text-accent-400 border border-accent-500/20">{item.category || 'General'}</span>
            <span className="badge bg-surface-700 text-surface-300 border border-surface-600">{priorityLabels[item.priority] || 'Standard'}</span>
          </div>
        </div>
        <span className="text-sm font-medium text-surface-400 whitespace-nowrap ml-3">{item.usage_frequency}</span>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-surface-700/50 rounded-lg p-3">
          <p className="text-[10px] text-surface-400 uppercase tracking-wider">Monthly Qty</p>
          <p className="font-semibold text-surface-100 mt-1">{item.quantity_estimate} {item.unit || 'units'}</p>
        </div>
        <div className="bg-surface-700/50 rounded-lg p-3">
          <p className="text-[10px] text-surface-400 uppercase tracking-wider">Unit Price</p>
          <p className="font-semibold text-surface-100 mt-1">Rs {item.unit_price || item.base_price || 0}</p>
        </div>
        <div className="bg-surface-700/50 rounded-lg p-3">
          <p className="text-[10px] text-surface-400 uppercase tracking-wider">Monthly Cost</p>
          <p className="font-semibold text-emerald-400 mt-1">Rs {Number(item.monthly_cost || 0).toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-surface-700/50 rounded-lg p-3">
          <p className="text-[10px] text-surface-400 uppercase tracking-wider">Coverage</p>
          <p className="font-semibold text-surface-100 mt-1">{item.coverage_per_unit || '-'} sq.ft</p>
        </div>
      </div>

      {/* Dilution Ratio */}
      <div className="mb-3 bg-surface-700/30 rounded-lg px-3 py-2">
        <p className="text-[10px] text-surface-400 uppercase tracking-wider mb-0.5">Dilution Ratio</p>
        <p className="text-sm text-surface-200 font-mono">{item.dilution_ratio || item.recommended_dilution || 'As per standard'}</p>
      </div>

      {/* Usage Guidance */}
      <div className="mb-3">
        <p className="text-[10px] text-surface-400 uppercase tracking-wider mb-1">Usage Guidance</p>
        <p className="text-sm text-surface-300 leading-relaxed">{item.usage_guidance || 'Follow standard cleaning procedures.'}</p>
      </div>

      {/* Safety Notes - high visibility */}
      <div className={`mb-3 rounded-lg p-3 ${isHighHazard ? 'bg-red-500/10 border border-red-500/30' : 'bg-amber-500/10 border border-amber-500/20'}`}>
        <div className="flex items-center gap-2 mb-1">
          <svg className={`w-4 h-4 ${isHighHazard ? 'text-red-400' : 'text-amber-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className={`text-xs font-semibold uppercase tracking-wider ${isHighHazard ? 'text-red-400' : 'text-amber-400'}`}>
            {isHighHazard ? '⚠ HIGH HAZARD ALERT' : 'Safety Notice'}
          </span>
        </div>
        <p className={`text-sm ${isHighHazard ? 'text-red-300' : 'text-amber-300'}`}>{item.safety_notes || 'Standard safety precautions apply.'}</p>
      </div>

      {/* Copy button */}
      {onCopyQuotation && (
        <button 
          onClick={() => onCopyQuotation(item)} 
          className="w-full sm:w-auto btn-secondary text-xs py-2"
        >
          <svg className="w-3.5 h-3.5 inline mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy to Quotation
        </button>
      )}
    </div>
  );
}
