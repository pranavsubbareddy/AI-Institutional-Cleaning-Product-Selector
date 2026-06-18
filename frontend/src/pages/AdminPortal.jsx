import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, formatCurrency } from '../services/api';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import AdminOperationsBoard from '../components/AdminOperationsBoard';
import ActionLog from '../components/ActionLog';

const ROLE_VIEWS = [
  {
    id: 'sales_admin',
    label: 'Sales Admin',
    desc: 'Monitor all activities & manage users',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
    gradient: 'from-red-500 to-rose-500',
    color: 'rose',
    links: [
      { to: '/admin', label: 'System Dashboard', desc: 'Full analytics & monitoring' },
      { to: '/admin/users', label: 'User Management', desc: 'Manage user roles & permissions' },
    ]
  }
];

// ── Static Tailwind class maps (avoids JIT dynamic class issue) ──────
const ROLE_BORDER_CLASSES = {
  rose: 'border-l-rose-500',
};

const ROLE_ICON_BG_CLASSES = {
  rose: 'bg-rose-500/10',
};

const ROLE_ICON_HOVER_BG_CLASSES = {
  rose: 'group-hover:bg-rose-500/20',
};

const ROLE_TEXT_CLASSES = {
  rose: 'text-rose-400',
};

export default function AdminPortal() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboardData, setDashboardData] = useState(null);
  const [actionLog, setActionLog] = useState([]);

  const currentRole = ROLE_VIEWS[0];

  const borderClass = ROLE_BORDER_CLASSES['rose'];
  const iconBgClass = ROLE_ICON_BG_CLASSES['rose'];
  const iconHoverBgClass = ROLE_ICON_HOVER_BG_CLASSES['rose'];
  const textClass = ROLE_TEXT_CLASSES['rose'];

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [statsRes, recRes] = await Promise.allSettled([
        api.getDashboardStats(),
        api.getRecommendations({ limit: 50 }),
      ]);

      const stats = statsRes.status === 'fulfilled' ? statsRes.value.data : null;
      const recommendations = recRes.status === 'fulfilled' ? (recRes.value.data || []) : [];

      setDashboardData(stats);

      const logs = (recommendations || []).map(rec => {
        const cost = rec.total_estimated_cost || 0;
        let priority = 'Low';
        if (cost > 200000) priority = 'Critical';
        else if (cost > 100000) priority = 'High';
        else if (cost > 50000) priority = 'Medium';
        const status = (rec.status === 'Processed') ? 'New' : (rec.status || 'New');
        return {
          id: rec.id,
          institution_name: rec.institution_name,
          institution_type: rec.institution_type,
          total_estimated_cost: cost,
          status,
          priority,
          created_at: rec.created_at,
          summary: rec.summary,
          actionLog: [
            { action: 'Recommendation processed by AI Engine', timestamp: rec.processed_at || rec.created_at, user: 'AI System' },
            { action: 'Assigned for review', timestamp: rec.created_at, user: 'system' },
          ]
        };
      });
      setActionLog(logs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const QuickLinkCard = ({ to, label, desc }) => (
    <button onClick={() => navigate(to)}
      className="card p-5 hover:border-cyan-500/30 transition-all duration-300 group text-left"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-lg ${iconBgClass} flex items-center justify-center ${iconHoverBgClass} transition-colors`}>
          <svg className={`w-5 h-5 ${textClass}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-surface-100 group-hover:text-cyan-400 transition-colors">{label}</h3>
          <p className="text-xs text-surface-400">{desc}</p>
        </div>
      </div>
    </button>
  );

  if (loading) return <LoadingState message="Loading Admin Portal..." />;
  if (error) return <ErrorState message={error} onRetry={fetchAllData} />;

  return (
    <div className="animate-fade-in max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center shadow-lg">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-surface-100">Admin Portal</h1>
          <p className="text-surface-400 text-sm">Operations dashboard — switch between staff role views</p>
        </div>
      </div>

      {/* Active Role Description */}
      <div className={`card p-5 mb-6 border-l-4 ${borderClass}`}>
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/20 to-rose-500/20 flex items-center justify-center flex-shrink-0 border ${borderClass}/20`}>
            <svg className={`w-6 h-6 ${textClass}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={currentRole.icon} />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-surface-100">{currentRole.label}</h2>
            <p className="text-sm text-surface-400">{currentRole.desc}</p>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {currentRole.links.map(link => (
          <QuickLinkCard key={link.to} {...link} />
        ))}
      </div>

      {/* Sales Admin View */}
      <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="card p-5 border-l-4 border-l-cyan-500">
              <p className="text-[11px] text-surface-400 uppercase tracking-wider">Pipeline Value</p>
              <p className="text-xl font-bold text-cyan-400 mt-2">{formatCurrency(dashboardData?.overview?.total_estimated_cost || 0)}</p>
              <p className="text-xs text-surface-500 mt-1">Total estimated revenue</p>
            </div>
            <div className="card p-5 border-l-4 border-l-emerald-500">
              <p className="text-[11px] text-surface-400 uppercase tracking-wider">Active Recommendations</p>
              <p className="text-xl font-bold text-emerald-400 mt-2">{dashboardData?.overview?.active_recommendations || 0}</p>
              <p className="text-xs text-surface-500 mt-1">Pending review & quotation</p>
            </div>
            <div className="card p-5 border-l-4 border-l-amber-500">
              <p className="text-[11px] text-surface-400 uppercase tracking-wider">Total Users</p>
              <p className="text-xl font-bold text-amber-400 mt-2">{dashboardData?.overview?.total_users || 0}</p>
              <p className="text-xs text-surface-500 mt-1">Registered accounts</p>
            </div>
            <div className="card p-5 border-l-4 border-l-purple-500">
              <p className="text-[11px] text-surface-400 uppercase tracking-wider">Facilities Served</p>
              <p className="text-xl font-bold text-purple-400 mt-2">{dashboardData?.overview?.total_institutions || 0}</p>
              <p className="text-xs text-surface-500 mt-1">Active customer accounts</p>
            </div>
          </div>

          {/* Operations Board */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h2 className="text-lg font-semibold text-surface-100">Operations Board</h2>
              <span className="badge bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px]">{actionLog.length} items</span>
            </div>
            <AdminOperationsBoard
              records={actionLog}
              onUpdateStatus={() => {}}
              onViewDetail={(id) => navigate('/recommendations/' + id)}
            />
          </div>
        </div>

      {/* Activity Log */}
      {actionLog.length > 0 && (
        <div className="mt-6">
          <ActionLog actions={actionLog.slice(0, 10).flatMap(r => r.actionLog || [])} title="Recent Activity" />
        </div>
      )}
    </div>
  );
}
