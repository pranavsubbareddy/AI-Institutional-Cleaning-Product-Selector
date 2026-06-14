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

  // Determine if product needs water dilution
  const needsWater = item.dilution_ratio && !item.dilution_ratio.toLowerCase().includes('ready to use') && !item.dilution_ratio.toLowerCase().includes('no water');
  
  // Extract brand name (first word/part before common brand suffixes)
    return (
    <div className={`card border-l-4 ${priorityColors[item.priority] || 'border-l-surface-600'} p-5 animate-slide-up hover:border-l-fuchsia-500 transition-colors duration-300`}>
      {/* Header with brand emphasis */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-fuchsia-400 bg-fuchsia-500/10 px-2 py-0.5 rounded-full border border-fuchsia-500/20">
              AI Recommended
            </span>
            {needsWater && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                💧 Needs Water
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-surface-100 truncate hover:text-fuchsia-300 transition-colors">
            {item.product_name}
          </h3>
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
        <div className="text-right flex-shrink-0 ml-3">
          <span className="text-sm font-medium text-surface-400 block">{item.usage_frequency}</span>
          <span className="text-[10px] text-surface-500">Frequency</span>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-surface-700/50 rounded-lg p-3">
          <p className="text-[10px] text-surface-400 uppercase tracking-wider">Monthly Qty</p>
          <p className="font-semibold text-surface-100 mt-1 text-lg">{item.quantity_estimate} <span className="text-sm font-normal text-surface-400">{item.unit || 'units'}</span></p>
        </div>
        <div className="bg-surface-700/50 rounded-lg p-3">
          <p className="text-[10px] text-surface-400 uppercase tracking-wider">Unit Price</p>
          <p className="font-semibold text-surface-100 mt-1">Rs {item.unit_price || item.base_price || 0}</p>
        </div>
        <div className="bg-surface-700/50 rounded-lg p-3">
          <p className="text-[10px] text-surface-400 uppercase tracking-wider">Monthly Cost</p>
          <p className="font-semibold text-emerald-400 mt-1 text-lg">Rs {Number(item.monthly_cost || 0).toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-surface-700/50 rounded-lg p-3">
          <p className="text-[10px] text-surface-400 uppercase tracking-wider">Coverage</p>
          <p className="font-semibold text-surface-100 mt-1">{item.coverage_per_unit ? `${item.coverage_per_unit} sq.ft` : '-'}</p>
        </div>
      </div>

      {/* Water & Dilution — highlighted prominently */}
      <div className={`mb-4 rounded-xl p-4 border ${
        needsWater 
          ? 'bg-blue-500/10 border-blue-500/30' 
          : 'bg-surface-700/30 border-surface-600/50'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            needsWater ? 'bg-blue-500/20' : 'bg-surface-600/50'
          }`}>
            {needsWater ? (
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-400">
              {needsWater ? '🪣 Water & Dilution Required' : '✅ Ready to Use — No Water Needed'}
            </p>
            <p className={`text-sm font-mono mt-1 ${needsWater ? 'text-blue-300 font-bold' : 'text-surface-300'}`}>
              {item.dilution_ratio || 'Standard dilution'}
            </p>
          </div>
        </div>
      </div>

      {/* Usage Guidance */}
      <div className="mb-3 bg-surface-700/30 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider">How to Use</span>
        </div>
        <p className="text-sm text-surface-200 leading-relaxed">{item.usage_guidance || 'Follow standard cleaning procedures.'}</p>
      </div>

      {/* Safety Notes - high visibility */}
      <div className={`mb-3 rounded-xl p-4 ${isHighHazard ? 'bg-red-500/10 border border-red-500/30' : 'bg-amber-500/10 border border-amber-500/20'}`}>
        <div className="flex items-center gap-2 mb-1.5">
          <svg className={`w-4 h-4 ${isHighHazard ? 'text-red-400' : 'text-amber-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className={`text-xs font-semibold uppercase tracking-wider ${isHighHazard ? 'text-red-400' : 'text-amber-400'}`}>
            {isHighHazard ? '⚠ HIGH HAZARD — Handle with Care' : 'Safety Notice'}
          </span>
        </div>
        <p className={`text-sm ${isHighHazard ? 'text-red-300' : 'text-amber-300'}`}>{item.safety_notes || 'Standard safety precautions apply.'}</p>
      </div>

      {/* Copy button */}
      {onCopyQuotation && (
        <button 
          onClick={() => onCopyQuotation(item)} 
          className="w-full sm:w-auto btn-secondary text-xs py-2 hover:bg-fuchsia-500/20 hover:border-fuchsia-500/30 hover:text-fuchsia-300 transition-all duration-200"
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
