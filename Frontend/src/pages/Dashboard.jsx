import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, formatCurrency } from '../services/api';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('cards');

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const [statsRes, instRes] = await Promise.all([
        api.getDashboardStats(),
        api.getDashboardInstitutions()
      ]);
      setStats(statsRes.data);
      setInstitutions(instRes.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingState message="Loading dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={fetchDashboard} />;

  const overview = stats?.overview || {};

  const statCards = [
    { label: 'Total Forms Processed', value: overview.total_institutions || 0, color: 'cyan', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { label: 'Total Orders', value: overview.total_orders || 0, color: 'emerald', icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z' },
    { label: 'Pipeline Value', value: formatCurrency(overview.total_estimated_cost || 0), color: 'cyan', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Active Recs', value: overview.active_recommendations || 0, color: 'emerald', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  ];

  const colorClasses = {
    cyan: 'border-l-cyan-500 bg-cyan-500/5',
    emerald: 'border-l-emerald-500 bg-emerald-500/5',
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">B2B Analytics Dashboard</h1>
          <p className="text-surface-400 mt-1">Overview of all facilities and procurement metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-surface-800 rounded-xl p-1 border border-surface-700">
            <button onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'cards' 
                  ? 'bg-cyan-500/10 text-cyan-400' 
                  : 'text-surface-400 hover:text-surface-200'
              }`}>
              Cards
            </button>
            <button onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'table' 
                  ? 'bg-cyan-500/10 text-cyan-400' 
                  : 'text-surface-400 hover:text-surface-200'
              }`}>
              Table
            </button>
          </div>
          <Link to="/form" className="btn-primary text-sm">
            <svg className="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            New
          </Link>
        </div>
      </div>

      {/* Facility Profile Overview - aggregated from metadata */}
      {institutions.length > 0 && (() => {
        // Compute metadata aggregation across all institutions
        let totalFloors = 0, totalOccupants = 0, multiFloorCount = 0;
        let equipmentCount = {}, preferenceCount = {}, certCount = {};
        let freqCount = {}, ageCount = {}, hoursCount = {};
        let facilitiesWithEquipment = 0, facilitiesWithCerts = 0, facilitiesWithPrefs = 0;

        institutions.forEach(inst => {
          const m = inst.metadata;
          if (!m) return;

          if (m.floors > 1) multiFloorCount++;
          totalFloors += m.floors || 1;
          totalOccupants += m.occupants || 0;

          if (m.equipment?.length > 0) {
            facilitiesWithEquipment++;
            m.equipment.forEach(eq => { equipmentCount[eq] = (equipmentCount[eq] || 0) + 1; });
          }
          if (m.preferences?.length > 0) {
            facilitiesWithPrefs++;
            m.preferences.forEach(p => { preferenceCount[p] = (preferenceCount[p] || 0) + 1; });
          }
          if (m.certifications?.length > 0) {
            facilitiesWithCerts++;
            m.certifications.forEach(c => { certCount[c] = (certCount[c] || 0) + 1; });
          }
          if (m.cleaning_frequency) freqCount[m.cleaning_frequency] = (freqCount[m.cleaning_frequency] || 0) + 1;
          if (m.facility_age) ageCount[m.facility_age] = (ageCount[m.facility_age] || 0) + 1;
          if (m.operating_hours) hoursCount[m.operating_hours] = (hoursCount[m.operating_hours] || 0) + 1;
        });

        const topEquipment = Object.entries(equipmentCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const topPreferences = Object.entries(preferenceCount).sort((a, b) => b[1] - a[1]).slice(0, 4);
        const topCerts = Object.entries(certCount).sort((a, b) => b[1] - a[1]).slice(0, 4);
        const avgFloors = institutions.length > 0 ? (totalFloors / institutions.length).toFixed(1) : 0;

        return (
          <div className="card p-6 mb-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-surface-100">Facility Profile Overview</h2>
                <p className="text-sm text-surface-400">Aggregated metadata across all facilities</p>
              </div>
            </div>

            {/* Metric badges row */}
            <div className="flex flex-wrap gap-2 mb-5">
              <span className="badge bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs px-3 py-1.5">
                📊 Avg {avgFloors} floors/facility
              </span>
              <span className="badge bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs px-3 py-1.5">
                👥 {totalOccupants.toLocaleString()} total occupants
              </span>
              <span className="badge bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-3 py-1.5">
                🛠 {facilitiesWithEquipment}/{institutions.length} with equipment
              </span>
              <span className="badge bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs px-3 py-1.5">
                ✓ {facilitiesWithCerts}/{institutions.length} with certifications
              </span>
              <span className="badge bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs px-3 py-1.5">
                ⚙ {facilitiesWithPrefs}/{institutions.length} with preferences
              </span>
              <span className="badge bg-surface-700 text-surface-300 border border-surface-600 text-xs px-3 py-1.5">
                🏢 {multiFloorCount} multi-story
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Top Equipment */}
              {topEquipment.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-2">Top Equipment</p>
                  <div className="space-y-2">
                    {topEquipment.map(([eq, count]) => (
                      <div key={eq}>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-surface-300">{{
                            mop: 'Mop', vacuum: 'Vacuum', scrubber: 'Scrubber',
                            pressure_washer: 'Press.Washer', steam_cleaner: 'Steam Clean',
                            carpet_extractor: 'Carpet Ext.', microfiber: 'Microfiber',
                            auto_dispenser: 'Auto Disp.'
                          }[eq] || eq}</span>
                          <span className="text-surface-400">{count}</span>
                        </div>
                        <div className="w-full bg-surface-700 rounded-full h-1.5">
                          <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${(count / topEquipment[0][1]) * 100}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Preferences */}
              {topPreferences.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-2">Top Preferences</p>
                  <div className="space-y-2">
                    {topPreferences.map(([pref, count]) => (
                      <div key={pref}>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-surface-300">{{
                            eco_friendly: '🌿 Eco-Friendly', fragrance_free: '🚫 Frag-Free',
                            hypoallergenic: '🛡️ Hypoallergenic', concentrated: '⚡ Concentrated',
                            ready_to_use: '💧 RTU', industrial_grade: '🏭 Industrial'
                          }[pref] || pref}</span>
                          <span className="text-surface-400">{count}</span>
                        </div>
                        <div className="w-full bg-surface-700 rounded-full h-1.5">
                          <div className="bg-cyan-500 h-1.5 rounded-full" style={{ width: `${(count / topPreferences[0][1]) * 100}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Certifications */}
              {topCerts.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-2">Top Certifications</p>
                  <div className="space-y-2">
                    {topCerts.map(([cert, count]) => (
                      <div key={cert}>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-surface-300">{{
                            iso_9001: 'ISO 9001', iso_14001: 'ISO 14001', haccp: 'HACCP',
                            gmp: 'GMP', osha: 'OSHA', green_seal: 'Green Seal'
                          }[cert] || cert}</span>
                          <span className="text-surface-400">{count}</span>
                        </div>
                        <div className="w-full bg-surface-700 rounded-full h-1.5">
                          <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${(count / topCerts[0][1]) * 100}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Second row: Age & Hours distribution */}
            {(Object.keys(ageCount).length > 0 || Object.keys(hoursCount).length > 0 || Object.keys(freqCount).length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5 pt-5 border-t border-surface-700">
                {Object.keys(ageCount).length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-2">Facility Age</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(ageCount).sort((a, b) => b[1] - a[1]).map(([age, count]) => (
                        <span key={age} className="badge bg-surface-700 text-surface-300 border border-surface-600 text-[11px]">
                          {{ new: 'New', moderate: 'Moderate', old: 'Old', vintage: 'Vintage' }[age] || age} ({count})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {Object.keys(hoursCount).length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-2">Operating Hours</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(hoursCount).sort((a, b) => b[1] - a[1]).map(([hrs, count]) => (
                        <span key={hrs} className="badge bg-surface-700 text-surface-300 border border-surface-600 text-[11px]">
                          {{ day: 'Day (6-6)', night: 'Night (6-6)', '24x7': '24x7', business: '9-5' }[hrs] || hrs} ({count})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {Object.keys(freqCount).length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-2">Cleaning Frequency</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(freqCount).sort((a, b) => b[1] - a[1]).map(([freq, count]) => (
                        <span key={freq} className="badge bg-surface-700 text-surface-300 border border-surface-600 text-[11px]">
                          {{ daily: 'Daily', twice_daily: '2x Daily', weekly: 'Weekly', multiple_weekly: 'Multi/Wk', custom: 'As Needed' }[freq] || freq} ({count})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((item, i) => (
          <div key={i} className={`card p-5 border-l-4 ${colorClasses[item.color]} animate-slide-up`} style={{ animationDelay: `${i * 100}ms` }}>
            <div className="flex items-start justify-between mb-2">
              <p className="text-[11px] text-surface-400 uppercase tracking-wider font-medium">{item.label}</p>
              <svg className={`w-5 h-5 ${item.color === 'cyan' ? 'text-cyan-400' : 'text-emerald-400'} opacity-60`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
            </div>
            <p className={`text-2xl font-bold mt-1 ${item.color === 'cyan' ? 'text-cyan-400' : 'text-emerald-400'}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Institutions by Type */}
          <div className="card p-6">
            <h3 className="font-semibold text-surface-100 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
              Institutions by Type
            </h3>
            {stats.institutions_by_type?.length > 0 ? (
              <div className="space-y-4">
                {stats.institutions_by_type.map((item, i) => {
                  const max = Math.max(...stats.institutions_by_type.map(t => t.count));
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-surface-300 capitalize">{item.institution_type.replace(/_/g, ' ')}</span>
                        <span className="font-semibold text-surface-200">{item.count}</span>
                      </div>
                      <div className="w-full bg-surface-700 rounded-full h-2.5 overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-cyan-500 to-cyan-400 h-2.5 rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${(item.count / max) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-surface-500 text-sm py-4 text-center">No data yet</p>
            )}
          </div>

          {/* Hygiene Standards */}
          <div className="card p-6">
            <h3 className="font-semibold text-surface-100 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              Hygiene Standards
            </h3>
            {stats.hygiene_stats?.length > 0 ? (
              <div className="space-y-4">
                {stats.hygiene_stats.map((item, i) => {
                  const max = Math.max(...stats.hygiene_stats.map(t => t.count));
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-surface-300 capitalize">{item.hygiene_standard}</span>
                        <span className="font-semibold text-surface-200">{item.count}</span>
                      </div>
                      <div className="w-full bg-surface-700 rounded-full h-2.5 overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-2.5 rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${(item.count / max) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-surface-500 text-sm py-4 text-center">No data yet</p>
            )}
          </div>
        </div>
      )}

      {/* Institutions Section */}
      <h2 className="text-lg font-semibold text-surface-100 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        Facilities
        <span className="text-sm font-normal text-surface-400">({institutions.length})</span>
      </h2>
      
      {institutions.length === 0 ? (
        <EmptyState
          title="No facilities yet"
          description="Create your first facility requirement to get started."
          action={() => navigate('/form')}
          actionLabel="Create Facility"
        />
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {institutions.map((inst, i) => (
            <Link key={inst.id} to={'/detail/' + inst.id} 
              className="card p-5 hover:border-cyan-500/30 transition-all duration-300 animate-slide-up"
              style={{ animationDelay: `${i * 80}ms` }}>
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold text-surface-100 truncate">{inst.name}</h3>
                <span className={`badge ml-2 flex-shrink-0 ${
                  inst.status === 'active' 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                    : 'bg-surface-700 text-surface-400 border border-surface-600'
                }`}>
                  {inst.status}
                </span>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-surface-400">Type</span>
                  <span className="font-medium text-surface-200 capitalize">{inst.institution_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-400">Area</span>
                  <span className="font-medium text-surface-200">{inst.area_size?.toLocaleString()} sq. ft.</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-400">Hygiene</span>
                  <span className="font-medium text-surface-200 capitalize">{inst.hygiene_standard}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-400">Budget</span>
                  <span className="font-medium text-surface-200 capitalize">{inst.budget}</span>
                </div>
                {inst.metadata?.floors > 1 && (
                  <div className="flex justify-between">
                    <span className="text-surface-400">Floors</span>
                    <span className="font-medium text-surface-200">{inst.metadata.floors}</span>
                  </div>
                )}
                {inst.latest_cost && (
                  <div className="pt-2 mt-2 border-t border-surface-700 flex justify-between">
                    <span className="text-surface-400">Monthly Est.</span>
                    <span className="font-bold text-cyan-400">{formatCurrency(inst.latest_cost)}</span>
                  </div>
                )}
              </div>
              {/* Metadata badges */}
              {(inst.metadata?.equipment?.length > 0 || inst.metadata?.certifications?.length > 0 || inst.metadata?.preferences?.length > 0) && (
                <div className="mt-2 pt-2 border-t border-surface-700/50 flex flex-wrap gap-1">
                  {inst.metadata.equipment?.length > 0 && (
                    <span className="badge text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" title="Equipment">
                      🛠 {inst.metadata.equipment.length} equip
                    </span>
                  )}
                  {inst.metadata.certifications?.length > 0 && (
                    <span className="badge text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20" title="Certifications">
                      ✓ {inst.metadata.certifications.length} certs
                    </span>
                  )}
                  {inst.metadata.preferences?.length > 0 && (
                    <span className="badge text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" title="Preferences">
                      ⚙ {inst.metadata.preferences.length} prefs
                    </span>
                  )}
                  {inst.metadata.occupants > 0 && (
                    <span className="badge text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20" title="Occupants">
                      👥 {inst.metadata.occupants}+
                    </span>
                  )}
                </div>
              )}
              <div className="mt-2 pt-2 border-t border-surface-700/50 flex justify-between text-xs text-surface-500">
                <span>{inst.recommendation_count} recommendation(s)</span>
                <span className="text-surface-400">
                  {inst.latest_status ? (
                    <span className={`badge text-[10px] ${
                      inst.latest_status === 'Processed' 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                    }`}>{inst.latest_status}</span>
                  ) : ''}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-700 bg-surface-800/50">
                  <th className="text-left py-3.5 px-4 font-medium text-surface-400 text-[11px] uppercase tracking-wider">ID</th>
                  <th className="text-left py-3.5 px-4 font-medium text-surface-400 text-[11px] uppercase tracking-wider">Name</th>
                  <th className="text-left py-3.5 px-4 font-medium text-surface-400 text-[11px] uppercase tracking-wider">Type</th>
                  <th className="text-left py-3.5 px-4 font-medium text-surface-400 text-[11px] uppercase tracking-wider">Date</th>
                  <th className="text-left py-3.5 px-4 font-medium text-surface-400 text-[11px] uppercase tracking-wider">Status</th>
                  <th className="text-right py-3.5 px-4 font-medium text-surface-400 text-[11px] uppercase tracking-wider">Amount</th>
                </tr>
              </thead>
              <tbody>
                {institutions.map((inst, i) => (
                  <tr key={inst.id} onClick={() => navigate('/detail/' + inst.id)}
                    className="border-t border-surface-700/50 hover:bg-surface-700/30 cursor-pointer transition-colors">
                    <td className="py-3.5 px-4 text-surface-500 font-mono text-xs">#{String(i + 1).padStart(3, '0')}</td>
                    <td className="py-3.5 px-4 font-medium text-surface-200">{inst.name}</td>
                    <td className="py-3.5 px-4 text-surface-400 capitalize">{inst.institution_type}</td>
                    <td className="py-3.5 px-4 text-surface-400 text-xs">
                      {inst.created_at ? new Date(inst.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`badge text-[11px] ${
                        inst.status === 'active' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-surface-700 text-surface-400 border border-surface-600'
                      }`}>
                        {inst.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-cyan-400">
                      {inst.latest_cost ? formatCurrency(inst.latest_cost) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
