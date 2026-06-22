import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import Toast from '../components/Toast';

const STATUS_OPTIONS = ['scheduled', 'in_transit', 'delivered', 'failed'];
const STATUS_COLORS = {
  scheduled: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  in_transit: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  delivered: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  failed: 'bg-red-500/10 text-red-400 border-red-500/30',
};
const STATUS_LABELS = { scheduled: 'Scheduled', in_transit: 'In Transit', delivered: 'Delivered', failed: 'Failed' };

export default function DeliveryPage() {
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState(null);
  const [formData, setFormData] = useState({ order_id: '', driver_name: '', vehicle_number: '', scheduled_date: new Date().toISOString().slice(0,10), notes: '' });
  const [orders, setOrders] = useState([]);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
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

  const fetchDeliveries = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const [dRes, oRes] = await Promise.allSettled([
        fetch('/api/deliveries?' + params.toString(), { credentials: 'include' }).then(r => r.json()),
        fetch('/api/orders?limit=100', { credentials: 'include' }).then(r => r.json()).catch(() => ({ success: false }))
      ]);
      if (dRes.status === 'fulfilled' && dRes.value.success) setDeliveries(dRes.value.data || []);
      else if (dRes.status === 'fulfilled') setError(dRes.value.error || 'Failed');
      if (oRes.status === 'fulfilled' && oRes.value.success) setOrders(oRes.value.data || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDeliveries(); }, [statusFilter]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/deliveries', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) }).then(r => r.json());
      if (res.success) {
        showToast('Delivery scheduled');
        setShowForm(false);
        setFormData({ order_id: '', driver_name: '', vehicle_number: '', scheduled_date: new Date().toISOString().slice(0,10), notes: '' });
        fetchDeliveries();
      } else showToast(res.error || 'Failed', 'error');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      const res = await fetch('/api/deliveries/' + id, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) }).then(r => r.json());
      if (res.success) { showToast('Status updated to ' + STATUS_LABELS[newStatus] || newStatus); fetchDeliveries(); }
      else showToast(res.error || 'Failed', 'error');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingDelivery) return;
    try {
      const res = await fetch('/api/deliveries/' + editingDelivery.id, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) }).then(r => r.json());
      if (res.success) {
        showToast('Delivery updated');
        setEditingDelivery(null);
        setShowForm(false);
        fetchDeliveries();
      } else showToast(res.error || 'Failed', 'error');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this delivery run?')) return;
    const deletedItem = deliveries.find(d => d.id === id);
    if (!deletedItem) return;
    try {
      const res = await fetch('/api/deliveries/' + id, { method: 'DELETE', credentials: 'include' }).then(r => r.json());
      if (res.success) {
        deletedItemRef.current = deletedItem;
        showToast('Delivery deleted', 'success', { label: 'Undo', handler: () => handleUndoDelete(deletedItem) });
        fetchDeliveries();
      } else showToast(res.error || 'Failed', 'error');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleUndoDelete = async (item) => {
    try {
      const res = await fetch('/api/deliveries', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: item.order_id, driver_name: item.driver_name, vehicle_number: item.vehicle_number, scheduled_date: item.scheduled_date, notes: item.notes })
      }).then(r => r.json());
      if (res.success) {
        deletedItemRef.current = null; setToast(null);
        showToast('Delivery restored', 'success');
        fetchDeliveries();
      } else showToast(res.error || 'Failed to restore', 'error');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const openEdit = (d) => {
    setEditingDelivery(d);
    setFormData({ order_id: d.order_id, driver_name: d.driver_name || '', vehicle_number: d.vehicle_number || '', scheduled_date: d.scheduled_date ? d.scheduled_date.slice(0, 10) : new Date().toISOString().slice(0,10), notes: d.notes || '' });
    setShowForm(true);
  };

  const filteredDeliveries = deliveries.filter(d => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (d.institution_name || '').toLowerCase().includes(q) ||
      (d.driver_name || '').toLowerCase().includes(q) ||
      (d.vehicle_number || '').toLowerCase().includes(q) ||
      (d.status || '').toLowerCase().includes(q);
  });

  if (loading) return <LoadingState message="Loading deliveries..." />;
  if (error) return <ErrorState message={error} onRetry={fetchDeliveries} />;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-surface-100">Delivery Management</h1>
          <p className="text-surface-400 text-sm">Track and manage all delivery runs — schedule, monitor, and complete deliveries</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowForm(true); setEditingDelivery(null); setFormData({ order_id: '', driver_name: '', vehicle_number: '', scheduled_date: new Date().toISOString().slice(0,10), notes: '' }); }} className="btn-primary text-sm">+ Schedule Delivery</button>
          <button onClick={() => navigate('/admin', { state: { tab: 'operations' } })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-700/50 text-surface-300 border border-surface-600/50 text-xs font-medium hover:bg-surface-700 hover:text-surface-100 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Scheduled', value: deliveries.filter(d => d.status === 'scheduled').length, color: 'blue' },
          { label: 'In Transit', value: deliveries.filter(d => d.status === 'in_transit').length, color: 'amber' },
          { label: 'Delivered', value: deliveries.filter(d => d.status === 'delivered').length, color: 'emerald' },
          { label: 'Failed', value: deliveries.filter(d => d.status === 'failed').length, color: 'red' },
        ].map((s, i) => (
          <div key={i} className={'card p-3 border-l-4 border-l-' + s.color + '-500'}>
            <p className="text-[10px] text-surface-400 uppercase tracking-wider">{s.label}</p>
            <p className={'text-lg font-bold mt-1 text-' + s.color + '-400'}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input type="text" placeholder="Search by institution, driver, vehicle..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm text-surface-200 placeholder-surface-500 focus:outline-none focus:border-cyan-500/50 transition-all" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm text-surface-200 focus:outline-none focus:border-cyan-500/50 cursor-pointer">
          <option value="">All Status</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s] || s.replace(/_/g, ' ')}</option>)}
        </select>
        <span className="text-xs text-surface-500">{filteredDeliveries.length} / {deliveries.length} deliveries</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-5">
          {filteredDeliveries.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-700/50 bg-surface-800/30">
                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Institution</th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Driver</th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Vehicle</th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Scheduled</th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Status</th>
                    <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-700/30">
                  {filteredDeliveries.map(d => (
                    <tr key={d.id} className="hover:bg-surface-700/20 transition-colors cursor-pointer" onClick={() => setSelectedDelivery(selectedDelivery?.id === d.id ? null : d)}>
                      <td className="px-3 py-3">
                        <p className="text-surface-200 font-medium">{d.institution_name || 'Unknown'}</p>
                        <p className="text-[10px] text-surface-500">{d.contact_phone || ''}</p>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                          <span className="text-surface-300">{d.driver_name || '—'}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs font-mono text-surface-300">{d.vehicle_number || '—'}</span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          <span className="text-surface-400 text-xs">{d.scheduled_date ? new Date(d.scheduled_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ' + (STATUS_COLORS[d.status] || 'bg-surface-700 text-surface-400 border-surface-600')}>
                          {STATUS_LABELS[d.status] || d.status?.replace(/_/g, ' ') || 'scheduled'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <select value={d.status} onChange={e => handleStatusUpdate(d.id, e.target.value)}
                            className="px-2 py-1 bg-surface-800 border border-surface-700 rounded text-[10px] text-surface-300 focus:outline-none focus:border-cyan-500/50 cursor-pointer">
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s] || s.replace(/_/g, ' ')}</option>)}
                          </select>
                          <button onClick={() => openEdit(d)} className="p-1.5 rounded text-surface-500 hover:text-cyan-400 hover:bg-surface-700 transition-all" title="Edit">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded text-surface-500 hover:text-red-400 hover:bg-surface-700 transition-all" title="Delete">
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
              <svg className="w-12 h-12 mx-auto text-surface-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>
              <p className="text-surface-400 text-sm">{searchQuery || statusFilter ? 'No deliveries match your filters' : 'No deliveries scheduled yet'}</p>
              {!searchQuery && !statusFilter && <button onClick={() => { setShowForm(true); setEditingDelivery(null); setFormData({ order_id: '', driver_name: '', vehicle_number: '', scheduled_date: new Date().toISOString().slice(0,10), notes: '' }); }} className="mt-3 btn-primary text-sm">+ Schedule First Delivery</button>}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="card p-5">
          {selectedDelivery ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-surface-100">Delivery Details</h3>
                <button onClick={() => setSelectedDelivery(null)} className="text-surface-500 hover:text-surface-300">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="space-y-3">
                <div className="bg-surface-700/30 rounded-lg p-3">
                  <p className="text-[10px] text-surface-500 uppercase tracking-wider">Institution</p>
                  <p className="text-surface-200 font-medium">{selectedDelivery.institution_name || 'Unknown'}</p>
                  {selectedDelivery.contact_name && <p className="text-xs text-surface-400">{selectedDelivery.contact_name}</p>}
                  {selectedDelivery.contact_phone && <p className="text-xs text-surface-400">{selectedDelivery.contact_phone}</p>}
                  {selectedDelivery.address && <p className="text-xs text-surface-500 mt-1">{selectedDelivery.address}</p>}
                </div>
                <div className="bg-surface-700/30 rounded-lg p-3">
                  <p className="text-[10px] text-surface-500 uppercase tracking-wider">Driver & Vehicle</p>
                  <p className="text-surface-200">{selectedDelivery.driver_name || 'Not assigned'}</p>
                  <p className="text-xs text-surface-400">{selectedDelivery.vehicle_number || 'No vehicle'}</p>
                </div>
                <div className="bg-surface-700/30 rounded-lg p-3">
                  <p className="text-[10px] text-surface-500 uppercase tracking-wider">Schedule</p>
                  <p className="text-surface-200">{selectedDelivery.scheduled_date ? new Date(selectedDelivery.scheduled_date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</p>
                  {selectedDelivery.completed_date && <p className="text-xs text-emerald-400 mt-1">Completed: {new Date(selectedDelivery.completed_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>}
                </div>
                <div className="bg-surface-700/30 rounded-lg p-3">
                  <p className="text-[10px] text-surface-500 uppercase tracking-wider">Status</p>
                  <span className={'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border mt-1 ' + (STATUS_COLORS[selectedDelivery.status] || 'bg-surface-700 text-surface-400 border-surface-600')}>
                    {STATUS_LABELS[selectedDelivery.status] || selectedDelivery.status?.replace(/_/g, ' ') || 'scheduled'}
                  </span>
                </div>
                {selectedDelivery.notes && (
                  <div className="bg-surface-700/30 rounded-lg p-3">
                    <p className="text-[10px] text-surface-500 uppercase tracking-wider">Notes</p>
                    <p className="text-xs text-surface-300">{selectedDelivery.notes}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <svg className="w-12 h-12 mx-auto text-surface-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>
              <p className="text-surface-400 text-sm">Click a delivery row to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Schedule/Edit Delivery Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="absolute inset-0 bg-surface-900/80 backdrop-blur-sm" />
          <div className="relative bg-surface-800 border border-surface-700 rounded-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-surface-100">{editingDelivery ? 'Edit Delivery' : 'Schedule Delivery'}</h3>
              <button type="button" onClick={() => { setShowForm(false); setEditingDelivery(null); }} className="text-surface-500 hover:text-surface-300">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={editingDelivery ? handleUpdate : handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs text-surface-500 mb-1">Order *</label>
                <select value={formData.order_id} onChange={e => setFormData(p => ({ ...p, order_id: e.target.value }))} required disabled={!!editingDelivery} className="w-full bg-surface-700 text-surface-200 rounded-lg px-3 py-2 text-sm border border-surface-600 focus:border-cyan-500 outline-none">
                  <option value="">Select order...</option>
                  {orders.map(o => <option key={o.id} value={o.id}>Order #{o.id.slice(0, 8)} — {o.institution_name || 'Unknown'}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Driver Name</label>
                <input type="text" value={formData.driver_name} onChange={e => setFormData(p => ({ ...p, driver_name: e.target.value }))} className="w-full bg-surface-700 text-surface-200 rounded-lg px-3 py-2 text-sm border border-surface-600 focus:border-cyan-500 outline-none placeholder-surface-500" placeholder="Driver's full name" />
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Vehicle Number</label>
                <input type="text" value={formData.vehicle_number} onChange={e => setFormData(p => ({ ...p, vehicle_number: e.target.value }))} className="w-full bg-surface-700 text-surface-200 rounded-lg px-3 py-2 text-sm border border-surface-600 focus:border-cyan-500 outline-none placeholder-surface-500" placeholder="e.g. KA-01-AB-1234" />
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Scheduled Date *</label>
                <input type="date" value={formData.scheduled_date} onChange={e => setFormData(p => ({ ...p, scheduled_date: e.target.value }))} required className="w-full bg-surface-700 text-surface-200 rounded-lg px-3 py-2 text-sm border border-surface-600 focus:border-cyan-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Notes</label>
                <textarea value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} className="w-full bg-surface-700 text-surface-200 rounded-lg px-3 py-2 text-sm border border-surface-600 focus:border-cyan-500 outline-none placeholder-surface-500" rows={3} placeholder="Delivery instructions, special notes..." />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary text-sm">{editingDelivery ? 'Update Delivery' : 'Schedule Delivery'}</button>
                <button type="button" onClick={() => { setShowForm(false); setEditingDelivery(null); }} className="px-4 py-2 rounded-lg text-sm text-surface-400 bg-surface-700 hover:bg-surface-600 transition-all">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Toast toast={toast} onDismiss={() => { setToast(null); if (toast?.undo) deletedItemRef.current = null; }} />
    </div>
  );
}
