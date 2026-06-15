export default function ProductCard({ item, onCopyQuotation, copiedProductId }) {
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

  const isHighHazard = item.safety_notes?.toLowerCase().includes('danger')
    || item.safety_notes?.toLowerCase().includes('corrosive')
    || item.safety_notes?.toLowerCase().includes('severe');

  const needsWater = item.dilution_ratio && !item.dilution_ratio.toLowerCase().includes('ready to use') && !item.dilution_ratio.toLowerCase().includes('no water');
  const isCopied = copiedProductId === (item.id || item.product_name);

  return (
    <div className={`card border-l-4 ${priorityColors[item.priority] || 'border-l-surface-600'} p-4 animate-slide-up`}>
      {/* Header row */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-fuchsia-400 bg-fuchsia-500/10 px-2 py-0.5 rounded-full border border-fuchsia-500/20">
              AI Recommended
            </span>
            <span className={`badge text-[10px] ${item.category === 'Premium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-primary-500/10 text-primary-400 border-primary-500/20'}`}>
              {item.category || 'General'}
            </span>
            <span className="badge bg-surface-700 text-surface-300 border border-surface-600 text-[10px]">{priorityLabels[item.priority] || 'Standard'}</span>
          </div>
          <h3 className="text-base font-bold text-surface-100 truncate">
            {item.product_name}
          </h3>
          {item.sku && (
            <span className="text-[10px] font-mono text-surface-500">SKU: {item.sku}</span>
          )}
        </div>
        <div className="text-right flex-shrink-0 ml-3">
          <p className="text-lg font-bold text-emerald-400">Rs {Number(item.monthly_cost || 0).toLocaleString('en-IN')}</p>
          <p className="text-[10px] text-surface-500">/month</p>
        </div>
      </div>

      {/* Compact info grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <div className="bg-surface-700/40 rounded-lg px-3 py-2">
          <p className="text-[9px] text-surface-400 uppercase tracking-wider">Qty</p>
          <p className="font-semibold text-surface-100 text-sm">{item.quantity_estimate} <span className="text-[10px] text-surface-400">{item.unit || 'units'}</span></p>
        </div>
        <div className="bg-surface-700/40 rounded-lg px-3 py-2">
          <p className="text-[9px] text-surface-400 uppercase tracking-wider">Unit Price</p>
          <p className="font-semibold text-surface-100 text-sm">Rs {item.unit_price || item.base_price || 0}</p>
        </div>
        <div className="bg-surface-700/40 rounded-lg px-3 py-2">
          <p className="text-[9px] text-surface-400 uppercase tracking-wider">Coverage</p>
          <p className="font-semibold text-surface-100 text-sm">{item.coverage_per_unit ? `${item.coverage_per_unit} sq.ft` : '-'}</p>
        </div>
        <div className="bg-surface-700/40 rounded-lg px-3 py-2">
          <p className="text-[9px] text-surface-400 uppercase tracking-wider">Dilution</p>
          <p className={`font-semibold text-sm ${needsWater ? 'text-blue-400' : 'text-surface-300'}`}>
            {needsWater ? '💧 Needs Water' : '✅ RTU'}
          </p>
        </div>
      </div>

      {/* Dilution & Usage in one compact row */}
      <div className={`mb-2 rounded-lg px-3 py-2 ${needsWater ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-surface-700/30'}`}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-surface-400 mb-0.5">
              {needsWater ? '🪣 Dilution Required' : '✅ Ready to Use'}
            </p>
            <p className="text-xs font-mono text-surface-200">{item.dilution_ratio || 'Standard dilution'}</p>
            {item.usage_guidance && (
              <p className="text-[10px] text-surface-400 mt-0.5 leading-relaxed line-clamp-1">{item.usage_guidance}</p>
            )}
          </div>
          <span className="text-[10px] text-surface-500 flex-shrink-0">{item.usage_frequency}</span>
        </div>
      </div>

      {/* Safety in a single line */}
      <div className={`mb-2 rounded-lg px-3 py-2 ${isHighHazard ? 'bg-red-500/10 border border-red-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
        <p className={`text-[10px] ${isHighHazard ? 'text-red-400' : 'text-amber-400'}`}>
          <span className="font-semibold">{isHighHazard ? '⚠ HIGH HAZARD' : 'Safety'}:</span>{' '}
          {item.safety_notes || 'Standard safety precautions apply.'}
        </p>
      </div>

      {/* Copy button */}
      {onCopyQuotation && (
        <button
          onClick={() => onCopyQuotation(item)}
          className={`w-full text-xs py-2 rounded-lg font-medium transition-all duration-200 ${
            isCopied
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-surface-700/50 text-surface-300 border border-surface-600/50 hover:bg-surface-600/50 hover:text-surface-200 hover:border-surface-500'
          }`}
        >
          {isCopied ? (
            <>
              <svg className="w-3.5 h-3.5 inline mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 inline mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy to Quotation
            </>
          )}
        </button>
      )}
    </div>
  );
}
