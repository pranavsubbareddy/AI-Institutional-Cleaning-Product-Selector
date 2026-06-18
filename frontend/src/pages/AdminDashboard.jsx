import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, formatCurrency } from '../services/api';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
// html2pdf is imported dynamically inside exportSystemReport to ensure Vite resolves it correctly

// ── Role lookup maps ─────────────────────────────────────────────────
const ROLE_COLORS = {
  admin: 'bg-red-500/10 text-red-400 border-red-500/30',
  field_staff: 'bg-surface-500/10 text-surface-400 border-surface-500/30',
  salesman: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  sales_admin: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  warehouse_staff: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  delivery_coordinator: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  accounts_manager: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  compliance_admin: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
};
const ROLE_LABELS = {
  admin: 'Administrator', field_staff: 'Field Staff', salesman: 'Salesman',
  sales_admin: 'Sales Admin', warehouse_staff: 'Warehouse Staff',
  delivery_coordinator: 'Delivery Coordinator', accounts_manager: 'Accounts Manager',
  compliance_admin: 'Compliance Admin'
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const intervalRef = useRef(null);
  const [liveSince, setLiveSince] = useState(null);

  useEffect(() => { fetchData(); }, []);

  // Auto-refresh every 30s when on the Activity Log tab
  useEffect(() => {
    if (activeSection === 'activity') {
      setLiveSince(Date.now());
      intervalRef.current = setInterval(() => {
        fetchData(false);
      }, 30000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setLiveSince(null);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [activeSection]);

  // Fetch users when switching to the Users tab
  useEffect(() => {
    if (activeSection === 'users' && users.length === 0) {
      fetchUsers();
    }
  }, [activeSection]);

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await api.getAdminUsers();
      if (res.success) setUsers(res.data);
    } catch (_) {}
    finally { setUsersLoading(false); }
  };

  const fetchData = async (isInitial = true) => {
    try {
      if (isInitial) setLoading(true);
      const res = await api.getAdminDashboard();
      if (res.success) setData(res.data);
      else throw new Error(res.error || 'Failed to load admin data');
    } catch (err) {
      setError(err.message);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  // ── Export system report as PDF ─────────────────────────────────────
  const exportSystemReport = async () => {
    setExporting(true);
    try {
      const reportId = 'sys-report-' + Date.now();
      const now = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

      const reportHTML = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><title>System Report - Ganga Maxx</title>
        <style>
          @page { margin: 15mm 12mm; }
          * { box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; padding: 0; margin: 0; font-size: 11px; line-height: 1.5; }
          .report-header { text-align: center; padding: 18px 0 14px; border-bottom: 3px solid #f59e0b; margin-bottom: 16px; }
          .report-header h1 { margin: 0; font-size: 20px; color: #1a1a2e; font-weight: 700; }
          .report-header p { margin: 4px 0 0; font-size: 11px; color: #6b7280; }
          .section-title { font-size: 13px; font-weight: 700; color: #f59e0b; margin: 16px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb; }
          .stat-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; margin-bottom: 10px; }
          .stat-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; }
          .stat-card .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; font-weight: 600; }
          .stat-card .value { font-size: 16px; font-weight: 700; color: #1a1a2e; margin-top: 2px; }
          .bar-section { margin-bottom: 10px; }
          .bar-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; font-size: 10px; }
          .bar-track { background: #e5e7eb; height: 8px; border-radius: 4px; overflow: hidden; margin-bottom: 6px; }
          .bar-fill { height: 8px; border-radius: 4px; background: linear-gradient(90deg, #f59e0b, #d97706); }
          .ops-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
          .ops-item { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 8px; text-align: center; }
          .ops-item .num { font-size: 14px; font-weight: 700; color: #1a1a2e; }
          .ops-item .lbl { font-size: 9px; color: #6b7280; }
          table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 9px; }
          th { background: #f3f4f6; text-align: left; padding: 5px 6px; font-size: 8px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; border-bottom: 1px solid #e5e7eb; }
          td { padding: 4px 6px; border-bottom: 1px solid #f3f4f6; color: #374151; }
          .footer { text-align: center; padding-top: 14px; margin-top: 16px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #9ca3af; }
          .tag { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 8px; font-weight: 600; background: #f3f4f6; color: #374151; }
          .tag-cyan { background: #e0f2fe; color: #0284c7; }
          .tag-emerald { background: #d1fae5; color: #059669; }
          .tag-amber { background: #fef3c7; color: #d97706; }
        </style>
        </head><body>
        <div class="report-header">
          <h1>Ganga Maxx — System Report</h1>
          <p>Generated ${now} &middot; AI Institutional Cleaning Platform</p>
        </div>

        <div class="section-title">Overview</div>
        <div class="stat-grid">
          <div class="stat-card"><div class="label">Facilities</div><div class="value">${overview.total_institutions || 0}</div></div>
          <div class="stat-card"><div class="label">Users</div><div class="value">${overview.total_users || 0}</div></div>
          <div class="stat-card"><div class="label">Pipeline Value</div><div class="value">Rs ${(overview.total_estimated_cost || 0).toLocaleString('en-IN')}</div></div>
          <div class="stat-card"><div class="label">Active Recs</div><div class="value">${overview.active_recommendations || 0}</div></div>
        </div>
        <div class="stat-grid">
          <div class="stat-card"><div class="label">Products</div><div class="value">${overview.total_products || 0}</div></div>
          <div class="stat-card"><div class="label">Recommendations</div><div class="value">${overview.total_recommendations || 0}</div></div>
          <div class="stat-card"><div class="label">Orders</div><div class="value">${overview.total_orders || 0}</div></div>
          <div class="stat-card"><div class="label">Recs Processed</div><div class="value">${(data.recommendations_by_status?.find(s => s.status === 'Processed')?.count) || 0}</div></div>
        </div>

        <div class="section-title">Institutions by Type</div>
        <div class="bar-section">
          ${(data.institutions_by_type || []).map(item => {
            const max = Math.max(...(data.institutions_by_type || []).map(t => t.count));
            return `<div><div class="bar-row"><span>${item.institution_type.replace(/_/g, ' ')}</span><span><strong>${item.count}</strong></span></div><div class="bar-track"><div class="bar-fill" style="width:${(item.count / (max || 1)) * 100}%"></div></div></div>`;
          }).join('') || '<p style="color:#9ca3af;">No data</p>'}
        </div>

        <div class="section-title">Operations</div>
        <div class="ops-grid">
          <div class="ops-item"><div class="num">${ops.warehouses || 0}</div><div class="lbl">Warehouses</div></div>
          <div class="ops-item"><div class="num">${ops.stock_batches || 0}</div><div class="lbl">Stock Batches</div></div>
          <div class="ops-item"><div class="num">${ops.active_deliveries || 0}</div><div class="lbl">Active Deliveries</div></div>
          <div class="ops-item"><div class="num">${ops.salesman_visits || 0}</div><div class="lbl">Salesman Visits</div></div>
          <div class="ops-item"><div class="num">${ops.compliance_documents || 0}</div><div class="lbl">Compliance Docs</div></div>

        </div>

        <div class="section-title">Analytics</div>
        <div class="stat-grid">
          ${(data.hygiene_stats || []).map(item =>
            `<div class="stat-card"><div class="label">${item.hygiene_standard}</div><div class="value">${item.count}</div></div>`
          ).join('') || ''}
          ${(data.budget_stats || []).map(item =>
            `<div class="stat-card"><div class="label">${item.budget || 'Unknown'}</div><div class="value">${item.count}</div></div>`
          ).join('') || ''}
        </div>

        <div class="section-title">Recent Activity (${(data.recent_activity || []).length} events)</div>
        <table>
          <tr><th>Action</th><th>Summary</th><th>User</th><th>Time</th></tr>
          ${(data.recent_activity || []).slice(0, 15).map(event => {
            const ts = event.timestamp ? new Date(event.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
            return `<tr><td><span class="tag ${event.type === 'recommendation' ? 'tag-cyan' : 'tag-emerald'}">${event.action}</span></td><td>${event.summary || ''}</td><td>${event.user || ''}</td><td>${ts}</td></tr>`;
          }).join('')}
        </table>

        <div class="footer">
          Ganga Maxx Institutional Cleaning Platform &middot; AI-Powered &middot; Report ID: ${reportId}
        </div>
        </body></html>
      `;

      const container = document.createElement('div');
      container.innerHTML = reportHTML;
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      document.body.appendChild(container);

      const { default: html2pdf } = await import('html2pdf.js');
      await html2pdf()
        .set({
          margin: [10, 8, 10, 8],
          filename: 'GangaMaxx-System-Report-' + new Date().toISOString().slice(0, 10) + '.pdf',
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, letterRendering: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        })
        .from(container)
        .save();

      document.body.removeChild(container);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <LoadingState message="Loading Admin Dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!data) return <ErrorState message="No data available" onRetry={fetchData} />;

  const overview = data.overview || {};
  const ops = data.operations || {};

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-surface-100">System Admin Dashboard</h1>
          <p className="text-surface-400 text-sm">System-wide metrics, operations, and activity logs</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportSystemReport}
            disabled={exporting}
            className={'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ' + (exporting ? 'bg-surface-700 text-surface-400 border-surface-600 cursor-not-allowed' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20')}
          >
            <svg className={"w-3.5 h-3.5 " + (exporting ? 'animate-spin' : '')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {exporting ? (
                <>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </>
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              )}
            </svg>
            {exporting ? 'Generating...' : 'Export PDF'}
          </button>
          <Link to="/admin-portal" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-medium hover:bg-amber-500/20 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            Admin Portal
          </Link>
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1 mt-4">
        {[{ id: 'overview', label: 'Overview', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' }, { id: 'users', label: 'Users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z' }, { id: 'operations', label: 'Operations', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' }, { id: 'analytics', label: 'Analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' }, { id: 'activity', label: 'Activity Log', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' }].map(tab => (
          <button key={tab.id} onClick={() => setActiveSection(tab.id)}
            className={'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap ' + (activeSection === tab.id ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-surface-800 text-surface-400 border border-surface-700 hover:border-surface-600 hover:text-surface-200')}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={tab.icon} />
            </svg>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeSection === 'overview' && (
        <div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Facilities', value: overview.total_institutions, color: 'cyan', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
              { label: 'Users', value: overview.total_users, color: 'purple', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
              { label: 'Pipeline Value', value: formatCurrency(overview.total_estimated_cost), color: 'emerald', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
              { label: 'Active Recs', value: overview.active_recommendations, color: 'amber', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
            ].map((card, i) => (
              <div key={i} className="card p-5 border-l-4 border-l-cyan-500">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-[11px] text-surface-400 uppercase tracking-wider font-medium">{card.label}</p>
                  <svg className={'w-5 h-5 ' + (card.color === 'cyan' ? 'text-cyan-400' : card.color === 'emerald' ? 'text-emerald-400' : card.color === 'amber' ? 'text-amber-400' : 'text-purple-400') + ' opacity-60'} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.icon} />
                  </svg>
                </div>
                <p className={'text-2xl font-bold mt-1 ' + (card.color === 'cyan' ? 'text-cyan-400' : card.color === 'emerald' ? 'text-emerald-400' : card.color === 'amber' ? 'text-amber-400' : 'text-purple-400')}>{card.value}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-5">
              <h3 className="font-semibold text-surface-100 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
                Institutions by Type
              </h3>
              {data.institutions_by_type?.length > 0 ? (
                <div className="space-y-3">
                  {data.institutions_by_type.map((item, i) => {
                    const max = Math.max(...data.institutions_by_type.map(t => t.count));
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-surface-300 capitalize">{item.institution_type.replace(/_/g, ' ')}</span>
                          <span className="font-semibold text-surface-200">{item.count}</span>
                        </div>
                        <div className="w-full bg-surface-700 rounded-full h-2">
                          <div className="bg-gradient-to-r from-cyan-500 to-cyan-400 h-2 rounded-full" style={{ width: (item.count / max) * 100 + '%' }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-surface-500 text-sm py-4 text-center">No data yet</p>}
            </div>
            <div className="card p-5">
              <h3 className="font-semibold text-surface-100 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                Recommendation Status
              </h3>
              {data.recommendations_by_status?.length > 0 ? (
                <div className="space-y-3">
                  {data.recommendations_by_status.map((item, i) => {
                    const max = Math.max(...data.recommendations_by_status.map(t => t.count));
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-surface-300 capitalize">{item.status}</span>
                          <span className="font-semibold text-surface-200">{item.count}</span>
                        </div>
                        <div className="w-full bg-surface-700 rounded-full h-2">
                          <div className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-2 rounded-full" style={{ width: (item.count / max) * 100 + '%' }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-surface-500 text-sm py-4 text-center">No data yet</p>}
            </div>
          </div>
        </div>
      )}

      {activeSection === 'operations' && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: 'Warehouses', value: ops.warehouses, color: 'amber', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', link: '/warehouse' },
              { label: 'Stock Batches', value: ops.stock_batches, color: 'blue', icon: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4', link: '/warehouse' },
              { label: 'Active Deliveries', value: ops.active_deliveries, color: 'cyan', icon: 'M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0', link: '/deliveries' },
              { label: 'Salesman Visits', value: ops.salesman_visits, color: 'green', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', link: '/salesman' },
              { label: 'Compliance Docs', value: ops.compliance_documents, color: 'purple', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', link: '/compliance' },
            ].map((card, i) => (
              <Link key={i} to={card.link} className="card p-5 hover:border-amber-500/30 transition-all duration-300 group">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-[11px] text-surface-400 uppercase tracking-wider font-medium">{card.label}</p>
                    <p className={'text-2xl font-bold mt-1 ' + (card.color === 'amber' ? 'text-amber-400' : card.color === 'blue' ? 'text-blue-400' : card.color === 'cyan' ? 'text-cyan-400' : card.color === 'green' ? 'text-emerald-400' : card.color === 'purple' ? 'text-purple-400' : 'text-rose-400')}>{card.value}</p>
                  </div>
                  <svg className={'w-8 h-8 ' + (card.color === 'amber' ? 'text-amber-500/30' : card.color === 'blue' ? 'text-blue-500/30' : card.color === 'cyan' ? 'text-cyan-500/30' : card.color === 'green' ? 'text-emerald-500/30' : card.color === 'purple' ? 'text-purple-500/30' : 'text-rose-500/30') + ' group-hover:opacity-60 transition-opacity'} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={card.icon} />
                  </svg>
                </div>
                <div className="flex items-center text-xs text-amber-400/70 group-hover:text-amber-400 transition-colors">
                  <span>Manage</span>
                  <svg className="w-3 h-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {activeSection === 'analytics' && (
        <div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-5">
              <h3 className="font-semibold text-surface-100 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                Hygiene Standards
              </h3>
              {data.hygiene_stats?.length > 0 ? (
                <div className="space-y-3">
                  {data.hygiene_stats.map((item, i) => {
                    const max = Math.max(...data.hygiene_stats.map(t => t.count));
                    const barColors = { basic: 'from-gray-500 to-gray-400', standard: 'from-blue-500 to-blue-400', high: 'from-amber-500 to-amber-400', medical_grade: 'from-red-500 to-red-400' };
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-surface-300 capitalize">{item.hygiene_standard}</span>
                          <span className="font-semibold text-surface-200">{item.count}</span>
                        </div>
                        <div className="w-full bg-surface-700 rounded-full h-2">
                          <div className={'h-2 rounded-full bg-gradient-to-r ' + (barColors[item.hygiene_standard] || 'from-cyan-500 to-cyan-400')} style={{ width: (item.count / max) * 100 + '%' }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-surface-500 text-sm py-4 text-center">No data yet</p>}
            </div>
            <div className="card p-5">
              <h3 className="font-semibold text-surface-100 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                Budget Levels
              </h3>
              {data.budget_stats?.length > 0 ? (
                <div className="space-y-3">
                  {data.budget_stats.map((item, i) => {
                    const max = Math.max(...data.budget_stats.map(t => t.count));
                    const barColors = { low: 'from-green-500 to-green-400', medium: 'from-amber-500 to-amber-400', high: 'from-purple-500 to-purple-400' };
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-surface-300 capitalize">{item.budget || 'Unknown'}</span>
                          <span className="font-semibold text-surface-200">{item.count}</span>
                        </div>
                        <div className="w-full bg-surface-700 rounded-full h-2">
                          <div className={'h-2 rounded-full bg-gradient-to-r ' + (barColors[item.budget] || 'from-cyan-500 to-cyan-400')} style={{ width: (item.count / max) * 100 + '%' }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-surface-500 text-sm py-4 text-center">No data yet</p>}
            </div>
          </div>
        </div>
      )}

      {activeSection === 'users' && (
        <div>
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
                <h2 className="text-lg font-semibold text-surface-100">Registered Users</h2>
                <span className="badge bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px]">{users.length} total</span>
              </div>
              <Link to="/admin/users" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-medium hover:bg-purple-500/20 transition-all">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                </svg>
                Manage Roles
              </Link>
            </div>
            {usersLoading ? (
              <div className="flex items-center justify-center py-12">
                <svg className="w-6 h-6 text-purple-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : users.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-surface-700/50">
                      <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wider">User</th>
                      <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wider">Email</th>
                      <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wider">Provider</th>
                      <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wider">Joined</th>
                      <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wider">Role</th>
                      <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wider">Verified</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-700/30">
                    {users.map(user => {
                      const isAdminUser = user.uid === 'admin';
                      const initials = user.displayName
                        ? user.displayName.split(' ').map(s => s[0]).join('').toUpperCase().slice(0, 2)
                        : user.email?.slice(0, 2).toUpperCase() || '?';
                      // roleColors and roleLabels are defined at module scope above
                      return (
                        <tr key={user.uid} className="hover:bg-surface-700/20 transition-colors">
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2.5">
                              {user.photoURL ? (
                                <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full border-2 border-surface-600/50 object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-[10px] font-bold text-white">
                                  {initials}
                                </div>
                              )}
                              <div>
                                <p className="text-sm font-medium text-surface-200">{user.displayName}</p>
                                {isAdminUser && <span className="text-[9px] text-surface-500">System Admin</span>}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <p className="text-sm text-surface-400">{user.email}</p>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="text-xs text-surface-500 capitalize">{user.provider || 'password'}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="text-xs text-surface-500">
                              {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ' + (ROLE_COLORS[user.role] || ROLE_COLORS.field_staff)}>
                              {ROLE_LABELS[user.role] || user.role || 'Field Staff'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {user.uid === 'admin' ? (
                              <span className="text-[10px] text-surface-600">—</span>
                            ) : user.emailVerified === 0 || user.emailVerified === false ? (
                              <span className="text-[10px] text-amber-400 font-medium">Unverified</span>
                            ) : (
                              <svg className="w-4 h-4 text-emerald-400 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-10">
                <svg className="w-10 h-10 mx-auto text-surface-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-surface-400 text-sm">No users found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeSection === 'activity' && (
        <div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-5">
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-lg font-semibold text-surface-100">Recent Activity</h2>
              <span className="badge bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px]">{data.recent_activity?.length || 0} events</span>
              {liveSince && (
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-medium tracking-wider uppercase">Live</span>
                </div>
              )}
            </div>
            {data.recent_activity?.length > 0 ? (
              <div className="space-y-0">
                {data.recent_activity.map((event, i) => {
                  if (!event || !event.timestamp) return null;
                  const isRec = event.type === 'recommendation';
                  const dotColor = isRec ? 'bg-cyan-500' : 'bg-emerald-500';
                  const icon = isRec ? 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' : 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z';
                  return (
                    <div key={event.id || i} className={'flex gap-3 py-3 border-l-2 pl-4 border-b border-surface-700/30 last:border-b-0 ' + (isRec ? 'border-l-cyan-500 bg-cyan-500/5' : 'border-l-emerald-500 bg-emerald-500/5')}>
                      <div className={'w-8 h-8 rounded-full ' + dotColor + '/20 flex items-center justify-center flex-shrink-0 mt-0.5'}>
                        <svg className={'w-4 h-4 ' + dotColor} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={'text-xs font-medium px-1.5 py-0.5 rounded ' + (isRec ? 'bg-cyan-500/10 text-cyan-400' : 'bg-emerald-500/10 text-emerald-400')}>{event.action}</span>
                          <span className="text-[10px] text-surface-500">
                            {event.timestamp ? new Date(event.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <p className="text-sm text-surface-300 truncate">{event.summary}</p>
                        <p className="text-[11px] text-surface-400 mt-0.5">by {event.user}</p>
                      </div>
                      {event.link && (
                        <button onClick={() => navigate(event.link)} className="text-surface-500 hover:text-amber-400 transition-colors flex-shrink-0 self-center">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <svg className="w-12 h-12 mx-auto text-surface-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-surface-400 text-sm">No recent activity to display</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
