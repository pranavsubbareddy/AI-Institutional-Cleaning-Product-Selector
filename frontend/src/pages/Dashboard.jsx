import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, formatCurrency } from '../services/api';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import DashboardSkeleton from '../components/DashboardSkeleton';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('cards');
  const [ready, setReady] = useState(false);
  const [undoToast, setUndoToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const undoTimeoutRef = useRef(null);
  const undoDataRef = useRef(null); // Store undo data in ref to avoid closure issues

  useEffect(() => {
    fetchDashboard();
  }, []);

  // Smooth transition: briefly show skeleton while content fades in
  useEffect(() => {
    if (!loading && !ready) {
      const timer = setTimeout(() => setReady(true), 80);
      return () => clearTimeout(timer);
    }
  }, [loading, ready]);

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

  const handleDeleteClick = (e, id, name, institutionData) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDialog({
      id,
      name,
      data: institutionData
    });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDialog) return;
    const { id, name, data: institutionData } = confirmDialog;
    setIsDeleting(true);

    try {
      await api.deleteInstitution(id);

      // Optimistically remove from list (after successful backend delete)
      setInstitutions(prev => prev.filter(inst => inst.id !== id));
      setConfirmDialog(null);
      setIsDeleting(false);

      // Clear any existing undo toast
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);

      // Show undo toast
      setUndoToast({ id, name, data: institutionData });
      undoDataRef.current = { id, name, data: institutionData };

      // Auto-dismiss undo after 5 seconds
      undoTimeoutRef.current = setTimeout(() => {
        setUndoToast(null);
        undoDataRef.current = null;
        undoTimeoutRef.current = null;
      }, 5000);
    } catch (err) {
      setIsDeleting(false);
      setConfirmDialog(null);
      // Show error toast instead of alert
      setUndoToast(null);
      undoDataRef.current = null;
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
        undoTimeoutRef.current = null;
      }
      // Briefly show an error toast
      setUndoToast({ id: null, name: 'Failed to delete: ' + err.message, data: null, isError: true });
      undoTimeoutRef.current = setTimeout(() => {
        setUndoToast(null);
        undoTimeoutRef.current = null;
      }, 4000);
    }
  };

  const handleCancelDelete = () => {
    setConfirmDialog(null);
  };

  const handleUndo = useCallback(async () => {
    const toast = undoDataRef.current;
    if (!toast || !toast.data) return;
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
    const { data } = toast;
    setIsUndoing(true);
    try {
      const res = await api.createInstitution({
        name: data.name,
        institution_type: data.institution_type,
        area_size: data.area_size,
        surface_types: data.surface_types || [],
        hygiene_standard: data.hygiene_standard,
        budget: data.budget,
        contact_name: user?.displayName || data.contact_name,
        contact_email: user?.email || data.contact_email,
        contact_phone: user?.phone || data.contact_phone,
        address: data.address || '',
        metadata: data.metadata || {}
      });
      setUndoToast(null);
      undoDataRef.current = null;
      setInstitutions(prev => [res.data, ...prev]);
    } catch (err) {
      console.error('[Undo] Failed to restore institution:', err);
      // Log the full error details for debugging
      if (err.response) {
        console.error('[Undo] Server response:', err.response);
      }
      // Show error toast
      setUndoToast({ id: null, name: 'Failed to undo deletion: ' + err.message, data: null, isError: true });
      undoTimeoutRef.current = setTimeout(() => {
        setUndoToast(null);
        undoTimeoutRef.current = null;
      }, 4000);
    } finally {
      setIsUndoing(false);
    }
  }, [user]); // depends on user only; reads undo data from ref

  // Show skeleton during loading, then smoothly transition to content
  if (loading && !ready) {
    return <DashboardSkeleton viewMode={viewMode} />;
  }

  if (error && !stats) {
    return <ErrorState message={error} onRetry={fetchDashboard} />;
  }

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
    <div
      className={'transition-all duration-500 ease-out ' + (ready ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4')}
    >
      {/* Undo / Error Toast */}
      {undoToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm animate-slide-in-right">
          <div className={'rounded-xl p-4 shadow-2xl flex items-center gap-3 border ' + (undoToast.isError ? 'bg-red-900/95 border-red-500/30' : 'bg-surface-800 border-surface-700')}>
            <div className={'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ' + (undoToast.isError ? 'bg-red-500/10' : 'bg-red-500/10')}>
              {undoToast.isError ? (
                <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={'text-sm font-medium ' + (undoToast.isError ? 'text-red-200' : 'text-surface-100')}>
                {undoToast.isError ? 'Error' : 'Facility deleted'}
              </p>
              <p className={'text-xs truncate ' + (undoToast.isError ? 'text-red-300/70' : 'text-surface-400')}>
                {undoToast.name}
              </p>
            </div>
            {!undoToast.isError && (
              <button onClick={handleUndo} disabled={isUndoing}
                className="text-sm font-semibold px-3 py-1.5 rounded-lg transition-all flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10">
                {isUndoing ? (
                  <>
                    <svg className="animate-spin w-3.5 h-3.5 inline" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </>
                ) : (
                  'Undo'
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={!!confirmDialog}
        title="Delete Facility"
        message={'Are you sure you want to delete "' + (confirmDialog?.name || '') + '"? This will permanently remove the facility and all its data.'}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">B2B Analytics Dashboard</h1>
          <p className="text-surface-400 mt-1">Overview of all facilities and procurement metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-surface-800 rounded-xl p-1 border border-surface-700">
            <button onClick={() => setViewMode('cards')}
              className={'px-3 py-1.5 rounded-lg text-xs font-medium transition-all ' + (viewMode === 'cards' ? 'bg-cyan-500/10 text-cyan-400' : 'text-surface-400 hover:text-surface-200')}>
              Cards
            </button>
            <button onClick={() => setViewMode('table')}
              className={'px-3 py-1.5 rounded-lg text-xs font-medium transition-all ' + (viewMode === 'table' ? 'bg-cyan-500/10 text-cyan-400' : 'text-surface-400 hover:text-surface-200')}>
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

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((item, i) => (
          <div key={i} className={'card p-5 border-l-4 ' + colorClasses[item.color] + ' animate-slide-up'} style={{ animationDelay: i * 100 + 'ms' }}>
            <div className="flex items-start justify-between mb-2">
              <p className="text-[11px] text-surface-400 uppercase tracking-wider font-medium">{item.label}</p>
              <svg className={'w-5 h-5 ' + (item.color === 'cyan' ? 'text-cyan-400' : 'text-emerald-400') + ' opacity-60'} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
            </div>
            <p className={'text-2xl font-bold mt-1 ' + (item.color === 'cyan' ? 'text-cyan-400' : 'text-emerald-400')}>{item.value}</p>
          </div>
        ))}
      </div>

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
            <div key={inst.id}
              className="card p-5 hover:border-cyan-500/30 transition-all duration-300 animate-slide-up relative group cursor-pointer"
              style={{ animationDelay: i * 80 + 'ms' }} onClick={() => navigate('/detail/' + inst.id)}>
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold text-surface-100 truncate">{inst.name}</h3>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={(e) => handleDeleteClick(e, inst.id, inst.name, inst)}
                    className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                    title="Delete facility">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  <span className={'badge ' + (inst.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-surface-700 text-surface-400 border border-surface-600')}>
                    {inst.status}
                  </span>
                </div>
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
                      {inst.metadata.equipment.length} equip
                    </span>
                  )}
                  {inst.metadata.certifications?.length > 0 && (
                    <span className="badge text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20" title="Certifications">
                      {inst.metadata.certifications.length} certs
                    </span>
                  )}
                  {inst.metadata.preferences?.length > 0 && (
                    <span className="badge text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" title="Preferences">
                      {inst.metadata.preferences.length} prefs
                    </span>
                  )}
                  {inst.metadata.occupants > 0 && (
                    <span className="badge text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20" title="Occupants">
                      {inst.metadata.occupants}+
                    </span>
                  )}
                </div>
              )}
              <div className="mt-2 pt-2 border-t border-surface-700/50 flex justify-between text-xs text-surface-500">
                <span>{inst.recommendation_count} recommendation(s)</span>
                <span className="text-surface-400">
                  {inst.latest_status ? (
                    <span className={'badge text-[10px] ' + (inst.latest_status === 'Processed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20')}>{inst.latest_status}</span>
                  ) : ''}
                </span>
              </div>
            </div>
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
                  <th className="text-right py-3.5 px-4 font-medium text-surface-400 text-[11px] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {institutions.map((inst, i) => (
                  <tr key={inst.id} onClick={() => navigate('/detail/' + inst.id)}
                    className="group border-t border-surface-700/50 hover:bg-surface-700/30 cursor-pointer transition-colors">
                    <td className="py-3.5 px-4 text-surface-500 font-mono text-xs">{'#' + String(i + 1).padStart(3, '0')}</td>
                    <td className="py-3.5 px-4 font-medium text-surface-200">{inst.name}</td>
                    <td className="py-3.5 px-4 text-surface-400 capitalize">{inst.institution_type}</td>
                    <td className="py-3.5 px-4 text-surface-400 text-xs">
                      {inst.created_at ? new Date(inst.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={'badge text-[11px] ' + (inst.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-surface-700 text-surface-400 border border-surface-600')}>
                        {inst.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-cyan-400">
                      {inst.latest_cost ? formatCurrency(inst.latest_cost) : '-'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(e, inst.id, inst.name, inst); }}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-all"
                        title="Delete facility">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
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
