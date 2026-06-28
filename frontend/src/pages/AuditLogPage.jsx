import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import LoadingState from '../components/LoadingState';

const STATUS_CHANGE_COLORS = {
  New: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  Quoted: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  Pending_AI: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  Processed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  'Out for Delivery': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  Completed: 'bg-green-500/10 text-green-400 border-green-500/30',
  Cancelled: 'bg-red-500/10 text-red-400 border-red-500/30',
};

export default function AuditLogPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEvents, setTotalEvents] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [summary, setSummary] = useState({ total_audit_entries: 0, total_recommendations: 0, total_institutions: 0 });

  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const pageSize = 25;

  const searchTimerRef = useRef(null);
  const filterRef = useRef({ search: '', dateFrom: '', dateTo: '' });

  useEffect(() => { fetchLogs(1); }, []);

  const fetchLogs = async (pageNum, append) => {
    if (pageNum === undefined) pageNum = 1;
    if (append === undefined) append = false;
    try {
      if (!append) setLoading(true);
      const params = { page: pageNum, pageSize };
      const f = filterRef.current;
      if (f.search) params.search = f.search;
      if (f.dateFrom) params.dateFrom = f.dateFrom;
      if (f.dateTo) params.dateTo = f.dateTo;
      const res = await api.getAdminAuditLogs(params);
      if (res.success) {
        if (append) {
          setEvents(prev => [...prev, ...(res.data.events || [])]);
        } else {
          setEvents(res.data.events || []);
        }
        const pg = res.data.pagination;
        setPage(pg.page || 1);
        setTotalPages(pg.totalPages || 1);
        setTotalEvents(pg.totalEvents || 0);
        setHasMore(pg.hasMore || false);
        if (res.data.summary) setSummary(res.data.summary);
        setError('');
      } else {
        setError(res.error || 'Failed to load audit logs');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (value) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      filterRef.current.search = value.trim();
      fetchLogs(1, false);
    }, 400);
  };

  const handleDateFromChange = (value) => {
    setDateFrom(value);
    filterRef.current.dateFrom = value;
    fetchLogs(1, false);
  };

  const handleDateToChange = (value) => {
    setDateTo(value);
    filterRef.current.dateTo = value;
    fetchLogs(1, false);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    filterRef.current = { search: '', dateFrom: '', dateTo: '' };
    fetchLogs(1, false);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      fetchLogs(page + 1, true);
    }
  };

  const formatDate = (ts) => {
    if (!ts) return '\u2014';
    return new Date(ts).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const exportCSV = () => {
    if (events.length === 0) return;
    const esc = v => '"' + String(v).replace(/"/g, '""') + '"';
    const hdrs = ['ID','Recommendation ID','Old Status','New Status','Changed By (Email)','Changed By (UID)','Role','Institution','Timestamp'].join(',');
    const rows = events.map(e => [
      esc(e.id || ''), esc(e.recommendation_id || ''), esc(e.old_status || ''), esc(e.new_status || ''),
      esc(e.changed_by_email || ''), esc(e.changed_by_uid || ''), esc(e.changed_by_role || ''),
      esc(e.institution_name || ''), esc(e.created_at || '')
    ].join(','));
    const csv = [hdrs, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit-log-export-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    if (events.length === 0) return;
    const now = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const dash = '\u2014';
    const arrow = '\u2192';
    const dot = '\u00b7';
    const rowsHtml = events.map(e => {
      return '<tr><td>' + (e.id || '').slice(0, 8) + '</td><td>' + (e.recommendation_id || '').slice(0, 8) + '</td><td>' + (e.old_status || dash) + ' ' + arrow + ' ' + e.new_status + '</td><td>' + (e.changed_by_email || e.changed_by_uid || dash) + '</td><td>' + (e.changed_by_role || dash) + '</td><td>' + (e.institution_name || dash) + '</td><td>' + (e.created_at ? new Date(e.created_at).toLocaleDateString('en-IN') : dash) + '</td></tr>';
    }).join('');
    const html = '<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Audit Log - Ganga Maxx</title><style>@page{margin:12mm 10mm}body{font-family:Segoe UI,Arial,sans-serif;color:#1a1a2e;font-size:10px;line-height:1.4}h1{font-size:18px;margin:0 0 4px}.sub{color:#6b7280;font-size:10px;margin-bottom:16px}table{width:100%;border-collapse:collapse;font-size:8px}th{background:#f3f4f6;text-align:left;padding:4px 5px;text-transform:uppercase;letter-spacing:.3px;color:#6b7280;border-bottom:1px solid #e5e7eb}td{padding:3px 5px;border-bottom:1px solid #f3f4f6;color:#374151;word-break:break-all}.footer{text-align:center;padding-top:12px;font-size:8px;color:#9ca3af}</style></head><body><h1>Ganga Maxx \u2014 Audit Log</h1><div class=\"sub\">Generated ' + now + ' ' + dot + ' ' + events.length + ' entries</div><table><tr><th>ID</th><th>Rec ID</th><th>Old ' + arrow + ' New</th><th>Changed By</th><th>Role</th><th>Institution</th><th>Time</th></tr>' + rowsHtml + '</table><div class=\"footer\">Ganga Maxx Institutional Cleaning Platform ' + dot + ' AI-Powered</div></body></html>';
    const container = document.createElement('div');
    container.innerHTML = html;
    // Positioned below viewport so it never appears on screen
    container.style.cssText = 'position:fixed;top:100vh;left:0;width:794px;background:#ffffff;opacity:1;pointer-events:none;z-index:-1;';
    document.body.appendChild(container);
    // Small delay to let the browser render the content
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 300)));
    try {
      const mod = await import('html2pdf.js');
      await mod.default().set({
        margin: [8, 6, 8, 6],
        filename: 'audit-log-' + new Date().toISOString().slice(0, 10) + '.pdf',
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      }).from(container).save();
    } catch (err) {
      console.error('PDF export failed:', err);
    }
    document.body.removeChild(container);
  };

  const hasActiveFilters = searchQuery || dateFrom || dateTo;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-purple-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-surface-100">Audit Log</h1>
          <p className="text-surface-400 text-sm">Track every status change with full traceability</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} disabled={events.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> CSV
          </button>
          <button onClick={exportPDF} disabled={events.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg> PDF
          </button>
          <button onClick={() => navigate('/admin', { state: { tab: 'operations' } })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-700/50 text-surface-300 border border-surface-600/50 text-xs font-medium hover:bg-surface-700 hover:text-surface-100 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back
          </button>
        </div>
      </div>

      <div className="card p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" placeholder="Search by ID, status, user, institution..." value={searchQuery} onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm text-surface-200 placeholder-surface-500 focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/20 transition-all" />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] text-surface-500 font-medium">From</label>
            <input type="date" value={dateFrom} onChange={(e) => handleDateFromChange(e.target.value)}
              className="px-2 py-1.5 bg-surface-800 border border-surface-700 rounded-lg text-[11px] text-surface-300 focus:outline-none focus:border-rose-500/50 transition-all w-[130px]" />
            <label className="text-[10px] text-surface-500 font-medium">To</label>
            <input type="date" value={dateTo} onChange={(e) => handleDateToChange(e.target.value)}
              className="px-2 py-1.5 bg-surface-800 border border-surface-700 rounded-lg text-[11px] text-surface-300 focus:outline-none focus:border-rose-500/50 transition-all w-[130px]" />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="badge bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px]">{totalEvents} entries</span>
            <span className="badge bg-surface-700 text-surface-400 border border-surface-600 text-[10px]">{summary.total_audit_entries || 0} total</span>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="px-2 py-1.5 rounded-lg text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all font-medium">Clear filters</button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading audit logs..." />
      ) : error ? (
        <div className="card p-8 text-center">
          <svg className="w-12 h-12 mx-auto text-red-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <p className="text-surface-400 text-sm mb-4">{error}</p>
          <button onClick={() => fetchLogs(1, false)} className="btn-primary text-sm">Retry</button>
        </div>
      ) : events.length === 0 ? (
        <div className="card p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-surface-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          <h3 className="text-surface-300 font-medium text-lg mb-1">No audit entries found</h3>
          <p className="text-surface-500 text-sm">{hasActiveFilters ? 'Try adjusting your filters or search query' : 'Status changes will appear here once recommendations are updated'}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-700/50 bg-surface-800/50">
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wider">ID</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wider">Recommendation</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wider">Old &rarr; New Status</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wider">Changed By</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wider">Role</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wider">Institution</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wider">Timestamp</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700/30">
                {events.map((event) => {
                  const clr = STATUS_CHANGE_COLORS[event.old_status] || 'bg-surface-700 text-surface-400 border-surface-600';
                  const clr2 = STATUS_CHANGE_COLORS[event.new_status] || 'bg-surface-700 text-surface-400 border-surface-600';
                  return (
                    <tr key={event.id} className="hover:bg-surface-700/20 transition-colors">
                      <td className="px-3 py-3"><span className="text-[11px] font-mono text-surface-400" title={event.id}>{(event.id || '').slice(0, 8)}...</span></td>
                      <td className="px-3 py-3"><span className="text-[11px] font-mono text-surface-300" title={event.recommendation_id}>{(event.recommendation_id || '').slice(0, 8)}...</span></td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={clr + ' inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border'}>{event.old_status || '\u2014'}</span>
                          <svg className="w-3 h-3 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                          <span className={clr2 + ' inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border'}>{event.new_status}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-sm text-surface-200">{event.changed_by_email || event.changed_by_uid || '\u2014'}</p>
                        {event.changed_by_uid && !event.changed_by_email && <p className="text-[10px] text-surface-500 font-mono">{event.changed_by_uid.slice(0, 12)}...</p>}
                      </td>
                      <td className="px-3 py-3"><span className="text-xs text-surface-400 capitalize">{event.changed_by_role || '\u2014'}</span></td>
                      <td className="px-3 py-3"><p className="text-sm text-surface-300 truncate max-w-[160px]" title={event.institution_name}>{event.institution_name || '\u2014'}</p></td>
                      <td className="px-3 py-3"><span className="text-xs text-surface-400 whitespace-nowrap">{formatDate(event.created_at)}</span></td>
                      <td className="px-3 py-3 text-right">
                        <button onClick={() => navigate('/recommendations/' + event.recommendation_id)} className="p-1.5 rounded text-surface-500 hover:text-rose-400 hover:bg-surface-700 transition-all" title="View recommendation">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t border-surface-700/50 bg-surface-800/30">
            <span className="text-xs text-surface-500">Showing {events.length} of {totalEvents} entries &middot; Page {page} of {totalPages}</span>
            <div className="flex items-center gap-2">
              {hasMore && (
                <button onClick={handleLoadMore} disabled={loading} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium border bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  {loading ? (<svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>) : (<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>)} {loading ? 'Loading...' : 'Load More'}
                </button>
              )}
              <div className="flex items-center gap-1">
                <button onClick={() => fetchLogs(1, false)} disabled={page <= 1} className="px-2 py-1.5 rounded text-xs bg-surface-800 border border-surface-700 text-surface-400 hover:text-surface-200 hover:border-surface-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                </button>
                <button onClick={() => fetchLogs(Math.max(1, page - 1), false)} disabled={page <= 1} className="px-2 py-1.5 rounded text-xs bg-surface-800 border border-surface-700 text-surface-400 hover:text-surface-200 hover:border-surface-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let n;
                  if (totalPages <= 5) n = i + 1;
                  else if (page <= 3) n = i + 1;
                  else if (page >= totalPages - 2) n = totalPages - 4 + i;
                  else n = page - 2 + i;
                  return <button key={n} onClick={() => fetchLogs(n, false)} className={'px-2.5 py-1.5 rounded text-xs font-medium transition-all ' + (page === n ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' : 'bg-surface-800 border border-surface-700 text-surface-400 hover:bg-surface-700')}>{n}</button>;
                })}
                <button onClick={() => fetchLogs(Math.min(totalPages, page + 1), false)} disabled={page >= totalPages} className="px-2 py-1.5 rounded text-xs bg-surface-800 border border-surface-700 text-surface-400 hover:text-surface-200 hover:border-surface-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
                <button onClick={() => fetchLogs(totalPages, false)} disabled={page >= totalPages} className="px-2 py-1.5 rounded text-xs bg-surface-800 border border-surface-700 text-surface-400 hover:text-surface-200 hover:border-surface-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}