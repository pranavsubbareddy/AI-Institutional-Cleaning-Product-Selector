import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, formatCurrency } from '../services/api';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

export default function DetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const instRes = await api.getInstitution(id);
      setData(instRes.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingState message="Loading details..." />;
  if (error) return <ErrorState message={error} onRetry={fetchDetail} />;
  if (!data) return <ErrorState message="No data found" />;

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <Link to="/dashboard" className="text-sm text-cyan-400 hover:text-cyan-300 mb-2 inline-flex items-center gap-1 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-surface-100">{data.name}</h1>
        <p className="text-surface-400 mt-1">Facility Details &amp; History</p>
      </div>

      {/* Institution Details Card */}
      <div className="card p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <p className="text-[11px] text-surface-400 uppercase tracking-wider">Type</p>
            <p className="text-base font-medium text-surface-100 mt-1 capitalize">{data.institution_type}</p>
          </div>
          <div>
            <p className="text-[11px] text-surface-400 uppercase tracking-wider">Area</p>
            <p className="text-base font-medium text-surface-100 mt-1">{data.area_size?.toLocaleString()} sq. ft.</p>
          </div>
          <div>
            <p className="text-[11px] text-surface-400 uppercase tracking-wider">Hygiene Standard</p>
            <p className="text-base font-medium text-surface-100 mt-1 capitalize">{data.hygiene_standard}</p>
          </div>
          <div>
            <p className="text-[11px] text-surface-400 uppercase tracking-wider">Budget</p>
            <p className="text-base font-medium text-surface-100 mt-1 capitalize">{data.budget}</p>
          </div>
          <div>
            <p className="text-[11px] text-surface-400 uppercase tracking-wider">Status</p>
            <span className={`badge mt-1 ${
              data.status === 'active' 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                : 'bg-surface-700 text-surface-400 border border-surface-600'
            }`}>{data.status}</span>
          </div>
          <div>
            <p className="text-[11px] text-surface-400 uppercase tracking-wider">Created</p>
            <p className="text-base font-medium text-surface-100 mt-1">{new Date(data.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
          </div>
          <div>
            <p className="text-[11px] text-surface-400 uppercase tracking-wider">Surfaces</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {data.surface_types?.map(s => (
                <span key={s} className="badge bg-surface-700 text-surface-300 border border-surface-600 text-[10px] capitalize">
                  {s.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
          {data.contact_name && (
            <div>
              <p className="text-[11px] text-surface-400 uppercase tracking-wider">Contact</p>
              <p className="text-base font-medium text-surface-100 mt-1">{data.contact_name}</p>
              {data.contact_email && <p className="text-sm text-surface-400">{data.contact_email}</p>}
              {data.contact_phone && <p className="text-sm text-surface-400">{data.contact_phone}</p>}
            </div>
          )}
        </div>
      </div>

      {/* Facility Profile - Metadata */}
      {data.metadata && (
        <div className="card p-6 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-surface-100">Facility Profile</h2>
              <p className="text-sm text-surface-400">Detailed facility characteristics</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
            {data.metadata.floors > 0 && (
              <div className="bg-surface-700/30 rounded-xl p-4 border border-surface-600/50">
                <p className="text-[10px] text-surface-400 uppercase tracking-wider">Floors</p>
                <p className="text-lg font-semibold text-surface-100 mt-1">{data.metadata.floors}</p>
              </div>
            )}
            {data.metadata.occupants > 0 && (
              <div className="bg-surface-700/30 rounded-xl p-4 border border-surface-600/50">
                <p className="text-[10px] text-surface-400 uppercase tracking-wider">Occupants</p>
                <p className="text-lg font-semibold text-surface-100 mt-1">{data.metadata.occupants}+</p>
              </div>
            )}
            {data.metadata.operating_hours && (
              <div className="bg-surface-700/30 rounded-xl p-4 border border-surface-600/50">
                <p className="text-[10px] text-surface-400 uppercase tracking-wider">Operating Hours</p>
                <p className="text-lg font-semibold text-surface-100 mt-1 capitalize">
                  {{
                    day: 'Day (6AM-6PM)',
                    night: 'Night (6PM-6AM)',
                    '24x7': '24x7 Operation',
                    business: 'Business Hours'
                  }[data.metadata.operating_hours] || data.metadata.operating_hours}
                </p>
              </div>
            )}
            {data.metadata.cleaning_frequency && (
              <div className="bg-surface-700/30 rounded-xl p-4 border border-surface-600/50">
                <p className="text-[10px] text-surface-400 uppercase tracking-wider">Cleaning Frequency</p>
                <p className="text-lg font-semibold text-surface-100 mt-1 capitalize">
                  {{
                    daily: 'Daily',
                    twice_daily: 'Twice Daily',
                    weekly: 'Weekly',
                    multiple_weekly: 'Multiple/Week',
                    custom: 'As Needed'
                  }[data.metadata.cleaning_frequency] || data.metadata.cleaning_frequency}
                </p>
              </div>
            )}
            {data.metadata.facility_age && (
              <div className="bg-surface-700/30 rounded-xl p-4 border border-surface-600/50">
                <p className="text-[10px] text-surface-400 uppercase tracking-wider">Facility Age</p>
                <p className="text-lg font-semibold text-surface-100 mt-1 capitalize">
                  {{
                    new: 'New (0-5 yrs)',
                    moderate: 'Moderate (5-15 yrs)',
                    old: 'Old (15-30 yrs)',
                    vintage: 'Vintage (30+ yrs)'
                  }[data.metadata.facility_age] || data.metadata.facility_age}
                </p>
              </div>
            )}
          </div>

          {/* Equipment */}
          {data.metadata.equipment?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Available Equipment</p>
              <div className="flex flex-wrap gap-1.5">
                {data.metadata.equipment.map(eq => (
                  <span key={eq} className="badge bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {{
                      mop: 'Mop & Bucket',
                      vacuum: 'Vacuum Cleaner',
                      scrubber: 'Floor Scrubber',
                      pressure_washer: 'Pressure Washer',
                      steam_cleaner: 'Steam Cleaner',
                      carpet_extractor: 'Carpet Extractor',
                      microfiber: 'Microfiber Cloths',
                      auto_dispenser: 'Auto Dispenser'
                    }[eq] || eq}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Preferences */}
          {data.metadata.preferences?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Product Preferences</p>
              <div className="flex flex-wrap gap-1.5">
                {data.metadata.preferences.map(p => (
                  <span key={p} className="badge bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    {{
                      eco_friendly: '🌿 Eco-Friendly',
                      fragrance_free: '🚫 Fragrance-Free',
                      hypoallergenic: '🛡️ Hypoallergenic',
                      concentrated: '⚡ Concentrated',
                      ready_to_use: '💧 Ready-to-Use',
                      industrial_grade: '🏭 Industrial Grade'
                    }[p] || p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Certifications */}
          {data.metadata.certifications?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Certifications</p>
              <div className="flex flex-wrap gap-1.5">
                {data.metadata.certifications.map(c => (
                  <span key={c} className="badge bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    {{
                      iso_9001: 'ISO 9001',
                      iso_14001: 'ISO 14001',
                      haccp: 'HACCP',
                      gmp: 'GMP',
                      osha: 'OSHA Compliant',
                      green_seal: 'Green Seal Certified'
                    }[c] || c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Special Requirements */}
          {data.metadata.special_requirements && (
            <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/20">
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">Special Requirements</p>
              <p className="text-sm text-amber-300">{data.metadata.special_requirements}</p>
            </div>
          )}

          {/* Facility Description */}
          {data.metadata.facility_description && (
            <div className="mt-3 bg-surface-700/30 rounded-xl p-4 border border-surface-600/50">
              <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Facility Description</p>
              <p className="text-sm text-surface-300">{data.metadata.facility_description}</p>
            </div>
          )}
        </div>
      )}

      {/* Recommendations */}
      <h2 className="text-lg font-semibold text-surface-100 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Recommendation History
      </h2>
      
      {data.recommendations?.length > 0 ? (
        <div className="space-y-4">
          {data.recommendations.map((rec, i) => (
            <Link key={rec.id} to={`/recommendations/${rec.id}`} 
              className="card p-5 block hover:border-cyan-500/30 transition-all duration-300 animate-slide-up"
              style={{ animationDelay: `${i * 100}ms` }}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-semibold text-surface-100">Recommendation</p>
                  <p className="text-xs text-surface-500 mt-0.5">{new Date(rec.created_at).toLocaleString('en-IN')}</p>
                </div>
                <div className="text-right">
                  <span className={`badge ${
                    rec.status === 'Processed' 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                      : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                  }`}>{rec.status}</span>
                  <p className="text-sm font-bold text-cyan-400 mt-2">{formatCurrency(rec.total_estimated_cost)}</p>
                </div>
              </div>
              {rec.summary && <p className="text-sm text-surface-400 line-clamp-2 leading-relaxed">{rec.summary}</p>}
              {rec.alerts?.length > 0 && (
                <div className="mt-3 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-xs text-amber-400">{rec.alerts.length} alert(s)</span>
                </div>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <div className="card p-8 text-center">
          <div className="w-16 h-16 bg-surface-700/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-surface-600">
            <svg className="w-8 h-8 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-surface-400 mb-4">No recommendations yet for this facility.</p>
          <Link to="/form" className="btn-primary inline-block text-sm">
            Create Recommendation
          </Link>
        </div>
      )}
    </div>
  );
}
