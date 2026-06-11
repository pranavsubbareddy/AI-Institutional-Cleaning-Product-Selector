import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api, formatCurrency } from '../services/api';
import ProductCard from '../components/ProductCard';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

export default function Recommendations() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchRecommendation();
  }, [id]);

  const fetchRecommendation = async () => {
    try {
      setLoading(true);
      const response = await api.getRecommendation(id);
      setData(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyQuotation = (item) => {
    const text = `${item.product_name} - ${item.quantity_estimate} ${item.unit} @ Rs ${item.unit_price}/${item.unit} = Rs ${item.monthly_cost?.toLocaleString('en-IN')}/month`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCopyAll = () => {
    if (!data?.items) return;
    const text = data.items.map(item =>
      `${item.product_name} | Qty: ${item.quantity_estimate} ${item.unit} | Price: Rs ${item.unit_price} | Monthly: Rs ${item.monthly_cost?.toLocaleString('en-IN')} | ${item.dilution_ratio}`
    ).join('\n');
    
    const fullText = `QUOTATION - ${data.institution_name}\n${'='.repeat(40)}\n${text}\n${'='.repeat(40)}\nTotal Monthly Cost: ${formatCurrency(data.total_estimated_cost)}\n`;
    
    navigator.clipboard.writeText(fullText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) return <LoadingState message="Loading recommendations..." />;
  if (error) return <ErrorState message={error} onRetry={fetchRecommendation} />;
  if (!data) return <ErrorState message="No recommendation data found" />;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <Link to="/dashboard" className="text-sm text-cyan-400 hover:text-cyan-300 mb-1 inline-block transition-colors">
            &larr; Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-surface-100">Product Recommendations</h1>
          <p className="text-surface-400 mt-1">For <span className="text-surface-200 font-medium">{data.institution_name}</span></p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleCopyAll} className="btn-secondary text-sm">
            <svg className="w-4 h-4 inline mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={copied ? 'M5 13l4 4L19 7' : 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'} />
            </svg>
            {copied ? 'Copied!' : 'Copy Full Quotation'}
          </button>
          <Link to={`/detail/${data.id}`} className="btn-primary text-sm">
            <svg className="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Details
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card p-5 animate-slide-up" style={{ animationDelay: '0ms' }}>
          <p className="text-[11px] text-surface-400 uppercase tracking-wider">Facility Type</p>
          <p className="text-lg font-semibold text-surface-100 mt-2 capitalize">{data.institution_type}</p>
          <p className="text-xs text-surface-500 mt-1">{data.area_size?.toLocaleString()} sq. ft.</p>
        </div>
        <div className="card p-5 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <p className="text-[11px] text-surface-400 uppercase tracking-wider">Hygiene Level</p>
          <p className="text-lg font-semibold text-surface-100 mt-2 capitalize">{data.hygiene_level || data.hygiene_standard || 'Standard'}</p>
          <p className="text-xs text-surface-500 mt-1">Required standard</p>
        </div>
        <div className="card p-5 animate-slide-up" style={{ animationDelay: '200ms' }}>
          <p className="text-[11px] text-surface-400 uppercase tracking-wider">Budget Level</p>
          <p className="text-lg font-semibold text-surface-100 mt-2 capitalize">{data.budget_level || data.budget || 'Medium'}</p>
          <p className="text-xs text-surface-500 mt-1">Budget tier</p>
        </div>
        <div className="card-accent p-5 animate-slide-up" style={{ animationDelay: '300ms' }}>
          <p className="text-[11px] text-cyan-400 uppercase tracking-wider font-medium">Monthly Est. Cost</p>
          <p className="text-xl font-bold text-emerald-400 mt-2">{formatCurrency(data.total_estimated_cost)}</p>
          <p className="text-xs text-surface-500 mt-1">Total estimated monthly spend</p>
        </div>
      </div>

      {/* Facility Profile - derived from metadata */}
      {data.metadata && (
        <div className="card p-6 mb-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-surface-100">Facility Profile</h2>
              <p className="text-sm text-surface-400">Characteristics used for recommendation scoring</p>
            </div>
          </div>

          {/* Profile stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
            {data.metadata.floors > 0 && (
              <div className="bg-surface-700/30 rounded-xl p-3 border border-surface-600/50 text-center">
                <p className="text-xl font-bold text-surface-100">{data.metadata.floors}</p>
                <p className="text-[10px] text-surface-400 uppercase tracking-wider mt-1">Floors</p>
              </div>
            )}
            {data.metadata.occupants > 0 && (
              <div className="bg-surface-700/30 rounded-xl p-3 border border-surface-600/50 text-center">
                <p className="text-xl font-bold text-surface-100">{data.metadata.occupants}+</p>
                <p className="text-[10px] text-surface-400 uppercase tracking-wider mt-1">Occupants</p>
              </div>
            )}
            {data.metadata.operating_hours && (
              <div className="bg-surface-700/30 rounded-xl p-3 border border-surface-600/50 text-center">
                <p className="text-sm font-bold text-surface-100">{{
                  day: 'Day', night: 'Night', '24x7': '24x7', business: '9-5'
                }[data.metadata.operating_hours] || data.metadata.operating_hours}</p>
                <p className="text-[10px] text-surface-400 uppercase tracking-wider mt-1">Hours</p>
              </div>
            )}
            {data.metadata.cleaning_frequency && (
              <div className="bg-surface-700/30 rounded-xl p-3 border border-surface-600/50 text-center">
                <p className="text-sm font-bold text-surface-100 capitalize">{{
                  daily: 'Daily', twice_daily: '2x Day', weekly: 'Weekly',
                  multiple_weekly: 'Multi/Wk', custom: 'As Needed'
                }[data.metadata.cleaning_frequency] || data.metadata.cleaning_frequency}</p>
                <p className="text-[10px] text-surface-400 uppercase tracking-wider mt-1">Cleaning</p>
              </div>
            )}
            {data.metadata.facility_age && (
              <div className="bg-surface-700/30 rounded-xl p-3 border border-surface-600/50 text-center">
                <p className="text-sm font-bold text-surface-100 capitalize">{{
                  new: '0-5 yrs', moderate: '5-15 yrs', old: '15-30 yrs', vintage: '30+ yrs'
                }[data.metadata.facility_age] || data.metadata.facility_age}</p>
                <p className="text-[10px] text-surface-400 uppercase tracking-wider mt-1">Age</p>
              </div>
            )}
          </div>

          {/* Equipment badges */}
          {data.metadata.equipment?.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-1.5">Equipment Available</p>
              <div className="flex flex-wrap gap-1.5">
                {data.metadata.equipment.map(eq => (
                  <span key={eq} className="badge bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px]">
                    {{
                      mop: 'Mop & Bucket', vacuum: 'Vacuum Cleaner', scrubber: 'Floor Scrubber',
                      pressure_washer: 'Pressure Washer', steam_cleaner: 'Steam Cleaner',
                      carpet_extractor: 'Carpet Extractor', microfiber: 'Microfiber Cloths',
                      auto_dispenser: 'Auto Dispenser'
                    }[eq] || eq}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Preferences + Certifications badges */}
          <div className="flex flex-wrap gap-4">
            {data.metadata.preferences?.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-1.5">Preferences</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.metadata.preferences.map(p => (
                    <span key={p} className="badge bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[11px]">
                      {{
                        eco_friendly: '🌿 Eco-Friendly', fragrance_free: '🚫 Fragrance-Free',
                        hypoallergenic: '🛡️ Hypoallergenic', concentrated: '⚡ Concentrated',
                        ready_to_use: '💧 Ready-to-Use', industrial_grade: '🏭 Industrial'
                      }[p] || p}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {data.metadata.certifications?.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-1.5">Certifications</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.metadata.certifications.map(c => (
                    <span key={c} className="badge bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[11px]">
                      {{
                        iso_9001: 'ISO 9001', iso_14001: 'ISO 14001', haccp: 'HACCP',
                        gmp: 'GMP', osha: 'OSHA Compliant', green_seal: 'Green Seal'
                      }[c] || c}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Special Requirements */}
          {data.metadata.special_requirements && (
            <div className="mt-3 bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
              <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-1">Special Requirements</p>
              <p className="text-sm text-amber-300">{data.metadata.special_requirements}</p>
            </div>
          )}
        </div>
      )}

      {/* Financial Status Alert */}
      {data.financialStatusAlert && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl animate-fade-in">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-amber-300">{data.financialStatusAlert}</p>
          </div>
        </div>
      )}

      {/* Alerts */}
      {data.alerts?.length > 0 && (
        <div className="mb-6 space-y-2">
          {data.alerts.map((alert, i) => (
            <div key={i} className="flex items-start p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <svg className="w-5 h-5 text-amber-400 mt-0.5 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm text-amber-300">{alert}</p>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {data.summary && (
        <div className="mb-6 p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-cyan-300">{data.summary}</p>
          </div>
        </div>
      )}

      {/* Products */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          Recommended Products
          <span className="text-sm font-normal text-surface-400">({data.items?.length || 0} items)</span>
        </h2>
        <div className="space-y-4">
          {data.items?.map((item, i) => (
            <div key={item.id || i} style={{ animationDelay: `${i * 100}ms` }}>
              <ProductCard key={item.id || i} item={item} onCopyQuotation={handleCopyQuotation} />
            </div>
          ))}
        </div>
      </div>

      {/* Summary Table */}
      <div className="card p-6">
        <h3 className="font-semibold text-surface-100 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Monthly Estimate Summary
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-700">
                <th className="text-left py-3 px-3 text-surface-400 font-medium text-xs uppercase tracking-wider">Product</th>
                <th className="text-right py-3 px-3 text-surface-400 font-medium text-xs uppercase tracking-wider">Qty/Month</th>
                <th className="text-right py-3 px-3 text-surface-400 font-medium text-xs uppercase tracking-wider">Unit Price</th>
                <th className="text-right py-3 px-3 text-surface-400 font-medium text-xs uppercase tracking-wider">Monthly Cost</th>
              </tr>
            </thead>
            <tbody>
              {data.items?.map((item, i) => (
                <tr key={item.id || i} className="border-b border-surface-700/50 last:border-0">
                  <td className="py-3 px-3 font-medium text-surface-200">{item.product_name}</td>
                  <td className="text-right py-3 px-3 text-surface-300">{item.quantity_estimate} {item.unit || 'units'}</td>
                  <td className="text-right py-3 px-3 text-surface-300">Rs {item.unit_price || item.base_price || 0}</td>
                  <td className="text-right py-3 px-3 text-surface-100 font-semibold">Rs {Number(item.monthly_cost || 0).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-surface-600">
                <td className="py-3 px-3 font-semibold text-surface-200">Total</td>
                <td className="text-right py-3 px-3 font-semibold text-surface-200">{data.monthly_total_quantity || 0} units</td>
                <td className="text-right py-3 px-3"></td>
                <td className="text-right py-3 px-3 font-bold text-emerald-400">{formatCurrency(data.total_estimated_cost)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
