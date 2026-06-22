import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import Toast from '../components/Toast';

const STATUS_OPTIONS = ['completed', 'cancelled', 'rescheduled', 'no_show'];
const STATUS_COLORS = {
  completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/30',
  rescheduled: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  no_show: 'bg-surface-500/10 text-surface-400 border-surface-500/30',
};
const STATUS_LABELS = { completed: 'Completed', cancelled: 'Cancelled', rescheduled: 'Rescheduled', no_show: 'No Show' };

export default function SalesmanPage() {
  const navigate = useNavigate();
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [institutions, setInstitutions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingVisit, setEditingVisit] = useState(null);
  const [formData, setFormData] = useState({ institution_id: '', salesman_name: '', visit_date: new Date().toISOString().slice(0,10), purpose: '', notes: '', follow_up_date: '', status: 'completed' });
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const deletedItemRef = useRef(null);

  const showToast = useCallback((msg, type = 'success', undoData = null) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message: msg, type, undo: undoData });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      if (undoData) deletedItemRef.current = null;
    }, 5000);
  }, []);

  const fetchVisits = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const [vRes, iRes] = await Promise.allSettled([
        fetch('/api/salesman?' + params.toString(), { credentials: 'include' }).then(r => r.json()),
        fetch('/api/institutions', { credentials: 'include' }).then(r => r.json())
      ]);
      if (vRes.status === 'fulfilled' && vRes.value.success) setVisits(vRes.value.data || []);
      if (iRes.status === 'fulfilled' && iRes.value.success) setInstitutions(iRes.value.data || []);
      if (vRes.status === 'fulfilled' && !vRes.value.success) setError(vRes.value.error || 'Failed');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchVisits(); }, [statusFilter]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/salesman', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) }).then(r => r.json());
      if (res.success) {
        showToast('Visit logged');
        setShowForm(false);
        resetForm();
        fetchVisits();
      } else showToast(res.error || 'Failed', 'error');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingVisit) return;
    try {
      const res = await fetch('/api/salesman/' + editingVisit.id, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) }).then(r => r.json());
      if (res.success) {
        showToast('Visit updated');
        setEditingVisit(null);
        setShowForm(false);
        resetForm();
        fetchVisits();
      } else showToast(res.error || 'Failed', 'error');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const resetForm = () => {
    setFormData({ institution_id: '', salesman_name: '', visit_date: new Date().toISOString().slice(0,10), purpose: '', notes: '', follow_up_date: '', status: 'completed' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this visit record?')) return;
    const deletedItem = visits.find(v => v.id === id);
    if (!deletedItem) return;
    try {
      const res = await fetch('/api/salesman/' + id, { method: 'DELETE', credentials: 'include' }).then(r => r.json());
      if (res.success) {
        deletedItemRef.current = deletedItem;
        showToast('Visit deleted', 'success', { label: 'Undo', handler: () => handleUndoDelete(deletedItem) });
        fetchVisits();
      } else showToast(res.error || 'Failed', 'error');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleUndoDelete = async (item) => {
    try {
      const res = await fetch('/api/salesman', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institution_id: item.institution_id, salesman_name: item.salesman_name,
          visit_date: item.visit_date ? new Date(item.visit_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
          purpose: item.purpose || '', notes: item.notes || '',
          follow_up_date: item.follow_up_date ? new Date(item.follow_up_date).toISOString().slice(0, 10) : ''
        })
      }).then(r => r.json());
      if (res.success) {
        deletedItemRef.current = null; setToast(null);
        showToast('Visit restored', 'success');
        fetchVisits();
      } else showToast(res.error || 'Failed to restore', 'error');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const openEdit = (v) => {
    setEditingVisit(v);
    setFormData({
      institution_id: v.institution_id, salesman_name: v.salesman_name,
      visit_date: v.visit_date ? v.visit_date.slice(0, 10) : new Date().toISOString().slice(0,10),
      purpose: v.purpose || '', notes: v.notes || '',
      follow_up_date: v.follow_up_date ? v.follow_up_date.slice(0, 10) : '',
      status: v.status || 'completed'
    });
    setShowForm(true);
  };

  const filteredVisits = visits.filter(v => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (v.salesman_name || '').toLowerCase().includes(q) ||
      (v.institution_name || '').toLowerCase().includes(q) ||
      (v.purpose || '').toLowerCase().includes(q);
  });

  const upcomingFollowUps = visits.filter(v => v.follow_up_date && new Date(v.follow_up_date) >= new Date()).sort((a, b) => new Date(a.follow_up_date) - new Date(b.follow_up_date));

  if (loading) return <LoadingState message="Loading salesman visits..." />;
  if (error) return <ErrorState message={error} onRetry={fetchVisits} />;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-surface-100">Salesman Visits</h1>
          <p className="text-surface-400 text-sm">Track field visits, follow-ups, and customer interactions</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowForm(true); setEditingVisit(null); resetForm(); }} className="btn-primary text-sm bg-emerald-500 hover:bg-emerald-400 text-surface-900">+ Log Visit</button>
          <button onClick={() => navigate('/admin', { state: { tab: 'operations' } })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-700/50 text-surface-300 border border-surface-600/50 text-xs font-medium hover:bg-surface-700 hover:text-surface-100 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="card p-3 border-l-4 border-l-emerald-500">
          <p className="text-[10px] text-surface-400 uppercase tracking-wider">Total Visits</p>
          <p className="text-lg font-bold text-emerald-400 mt-1">{visits.length}</p>
        </div>
        <div className="card p-3 border-l-4 border-l-cyan-500">
          <p className="text-[10px] text-surface-400 uppercase tracking-wider">This Month</p>
          <p className="text-lg font-bold text-cyan-400 mt-1">{visits.filter(v => new Date(v.visit_date).getMonth() === new Date().getMonth()).length}</p>
        </div>
        <div className="card p-3 border-l-4 border-l-amber-500">
          <p className="text-[10px] text-surface-400 uppercase tracking-wider">Follow-ups Due</p>
          <p className="text-lg font-bold text-amber-400 mt-1">{upcomingFollowUps.length}</p>
        </div>
        <div className="card p-3 border-l-4 border-l-purple-500">
          <p className="text-[10px] text-surface-400 uppercase tracking-wider">Completed</p>
          <p className="text-lg font-bold text-purple-400 mt-1">{visits.filter(v => v.status === 'completed').length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input type="text" placeholder="Search by salesman, institution, purpose..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm text-surface-200 placeholder-surface-500 focus:outline-none focus:border-emerald-500/50 transition-all" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm text-surface-200 focus:outline-none focus:border-emerald-500/50 cursor-pointer">
          <option value="">All Status</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <span className="text-xs text-surface-500">{filteredVisits.length} / {visits.length} visits</span>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-5">
          {/* Upcoming follow-ups alert */}
          {upcomingFollowUps.length > 0 && (
            <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="text-sm font-medium text-amber-400">{upcomingFollowUps.length} Upcoming Follow-up{upcomingFollowUps.length > 1 ? 's' : ''}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {upcomingFollowUps.slice(0, 5).map(v => (
                  <span key={v.id} className="text-[10px] text-surface-300 bg-surface-800/50 px-2 py-1 rounded-lg">
                    {v.salesman_name} → {v.institution_name} ({new Date(v.follow_up_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })})
                  </span>
                ))}
              </div>
            </div>
          )}

          {filteredVisits.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-700/50 bg-surface-800/30">
                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Salesman</th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Institution</th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Date</th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Purpose</th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Status</th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Follow-up</th>
                    <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-700/30">
                  {filteredVisits.map(v => (
                    <tr key={v.id} className="hover:bg-surface-700/20 transition-colors cursor-pointer" onClick={() => setSelectedVisit(selectedVisit?.id === v.id ? null : v)}>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-[9px] font-bold text-white">
                            {v.salesman_name ? v.salesman_name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase() : '?'}
                          </div>
                          <span className="text-surface-200 font-medium">{v.salesman_name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-surface-300">{v.institution_name || 'Unknown'}</td>
                      <td className="px-3 py-3">
                        <span className="text-surface-400 text-xs whitespace-nowrap">{v.visit_date ? new Date(v.visit_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-surface-400 text-xs max-w-[150px] inline-block truncate" title={v.purpose}>{v.purpose || '—'}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ' + (STATUS_COLORS[v.status] || 'bg-surface-700 text-surface-400 border-surface-600')}>
                          {STATUS_LABELS[v.status] || v.status || 'completed'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {v.follow_up_date ? (
                          <span className={'text-xs flex items-center gap-1 ' + (new Date(v.follow_up_date) < new Date() ? 'text-red-400' : 'text-amber-400')}>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            {new Date(v.follow_up_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </span>
                        ) : <span className="text-xs text-surface-500">—</span>}
                      </td>
                      <td className="px-3 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(v)} className="p-1.5 rounded text-surface-500 hover:text-emerald-400 hover:bg-surface-700 transition-all" title="Edit">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={() => handleDelete(v.id)} className="p-1.5 rounded text-surface-500 hover:text-red-400 hover:bg-surface-700 transition-all" title="Delete">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <svg className="w-12 h-12 mx-auto text-surface-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857" /></svg>
              <p className="text-surface-400 text-sm">{searchQuery || statusFilter ? 'No visits match your filters' : 'No visits logged yet'}</p>
              {!searchQuery && !statusFilter && <button onClick={() => { setShowForm(true); setEditingVisit(null); resetForm(); }} className="mt-3 btn-primary text-sm bg-emerald-500 hover:bg-emerald-400 text-surface-900">+ Log First Visit</button>}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="card p-5">
          {selectedVisit ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-surface-100">Visit Details</h3>
                <button onClick={() => setSelectedVisit(null)} className="text-surface-500 hover:text-surface-300">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="space-y-3">
                <div className="bg-surface-700/30 rounded-lg p-3">
                  <p className="text-[10px] text-surface-500 uppercase tracking-wider">Salesman</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-[10px] font-bold text-white">
                      {selectedVisit.salesman_name ? selectedVisit.salesman_name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase() : '?'}
                    </div>
                    <p className="text-surface-200 font-medium">{selectedVisit.salesman_name}</p>
                  </div>
                </div>
                <div className="bg-surface-700/30 rounded-lg p-3">
                  <p className="text-[10px] text-surface-500 uppercase tracking-wider">Institution</p>
                  <p className="text-surface-200">{selectedVisit.institution_name || 'Unknown'}</p>
                  {selectedVisit.institution_type && <p className="text-xs text-surface-400 capitalize">{selectedVisit.institution_type.replace(/_/g, ' ')}</p>}
                  {selectedVisit.contact_phone && <p className="text-xs text-surface-400">{selectedVisit.contact_phone}</p>}
                </div>
                <div className="bg-surface-700/30 rounded-lg p-3">
                  <p className="text-[10px] text-surface-500 uppercase tracking-wider">Visit Date</p>
                  <p className="text-surface-200">{selectedVisit.visit_date ? new Date(selectedVisit.visit_date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' }) : '—'}</p>
                </div>
                <div className="bg-surface-700/30 rounded-lg p-3">
                  <p className="text-[10px] text-surface-500 uppercase tracking-wider">Purpose</p>
                  <p className="text-surface-200">{selectedVisit.purpose || '—'}</p>
                </div>
                {selectedVisit.notes && (
                  <div className="bg-surface-700/30 rounded-lg p-3">
                    <p className="text-[10px] text-surface-500 uppercase tracking-wider">Notes</p>
                    <p className="text-xs text-surface-300 whitespace-pre-wrap">{selectedVisit.notes}</p>
                  </div>
                )}
                <div className="bg-surface-700/30 rounded-lg p-3">
                  <p className="text-[10px] text-surface-500 uppercase tracking-wider">Status</p>
                  <span className={'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border mt-1 ' + (STATUS_COLORS[selectedVisit.status] || 'bg-surface-700 text-surface-400 border-surface-600')}>
                    {STATUS_LABELS[selectedVisit.status] || selectedVisit.status || 'completed'}
                  </span>
                </div>
                {selectedVisit.follow_up_date && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                    <p className="text-[10px] text-amber-400 uppercase tracking-wider">Follow-up Date</p>
                    <p className="text-amber-300 font-medium">{new Date(selectedVisit.follow_up_date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' })}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <svg className="w-12 h-12 mx-auto text-surface-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857" /></svg>
              <p className="text-surface-400 text-sm">Click a visit row to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Log/Edit Visit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="absolute inset-0 bg-surface-900/80 backdrop-blur-sm" />
          <div className="relative bg-surface-800 border border-surface-700 rounded-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-surface-100">{editingVisit ? 'Edit Visit' : 'Log Salesman Visit'}</h3>
              <button type="button" onClick={() => { setShowForm(false); setEditingVisit(null); }} className="text-surface-500 hover:text-surface-300">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={editingVisit ? handleUpdate : handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs text-surface-500 mb-1">Salesman Name *</label>
                <input type="text" value={formData.salesman_name} onChange={e => setFormData(p => ({ ...p, salesman_name: e.target.value }))} className="w-full bg-surface-700 text-surface-200 rounded-lg px-3 py-2 text-sm border border-surface-600 focus:border-emerald-500 outline-none placeholder-surface-500" required placeholder="Full name" />
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Institution *</label>
                <select value={formData.institution_id} onChange={e => setFormData(p => ({ ...p, institution_id: e.target.value }))} required className="w-full bg-surface-700 text-surface-200 rounded-lg px-3 py-2 text-sm border border-surface-600 focus:border-emerald-500 outline-none">
                  <option value="">Select institution...</option>
                  {institutions.map(inst => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-surface-500 mb-1">Visit Date</label>
                  <input type="date" value={formData.visit_date} onChange={e => setFormData(p => ({ ...p, visit_date: e.target.value }))} className="w-full bg-surface-700 text-surface-200 rounded-lg px-3 py-2 text-sm border border-surface-600 focus:border-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-surface-500 mb-1">Status</label>
                  <select value={formData.status} onChange={e => setFormData(p => ({ ...p, status: e.target.value }))} className="w-full bg-surface-700 text-surface-200 rounded-lg px-3 py-2 text-sm border border-surface-600 focus:border-emerald-500 outline-none">
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Purpose *</label>
                <input type="text" value={formData.purpose} onChange={e => setFormData(p => ({ ...p, purpose: e.target.value }))} className="w-full bg-surface-700 text-surface-200 rounded-lg px-3 py-2 text-sm border border-surface-600 focus:border-emerald-500 outline-none placeholder-surface-500" required placeholder="e.g. Product demo, follow-up, new client meeting" />
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Notes</label>
                <textarea value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} className="w-full bg-surface-700 text-surface-200 rounded-lg px-3 py-2 text-sm border border-surface-600 focus:border-emerald-500 outline-none placeholder-surface-500" rows={3} placeholder="Observations, feedback, next steps..." />
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Follow-up Date</label>
                <input type="date" value={formData.follow_up_date} onChange={e => setFormData(p => ({ ...p, follow_up_date: e.target.value }))} className="w-full bg-surface-700 text-surface-200 rounded-lg px-3 py-2 text-sm border border-surface-600 focus:border-emerald-500 outline-none" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary text-sm bg-emerald-500 hover:bg-emerald-400 text-surface-900">{editingVisit ? 'Update Visit' : 'Log Visit'}</button>
                <button type="button" onClick={() => { setShowForm(false); setEditingVisit(null); }} className="px-4 py-2 rounded-lg text-sm text-surface-400 bg-surface-700 hover:bg-surface-600 transition-all">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Toast toast={toast} onDismiss={() => { setToast(null); if (toast?.undo) deletedItemRef.current = null; }} />
    </div>
  );
}
