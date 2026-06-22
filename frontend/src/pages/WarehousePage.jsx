import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import Toast from '../components/Toast';

export default function WarehousePage() {
  const navigate = useNavigate();
  const { id: paramId } = useParams();
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(paramId ? 'warehouse-detail' : 'warehouses');
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [allBatches, setAllBatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [batchSearch, setBatchSearch] = useState('');

  // Form state
  const [showWhForm, setShowWhForm] = useState(false);
  const [whFormData, setWhFormData] = useState({ name: '', location: '', contact_person: '', contact_phone: '' });
  const [editingWh, setEditingWh] = useState(null);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [batchFormData, setBatchFormData] = useState({ product_id: '', batch_number: '', quantity: '', expiry_date: '' });
  const [editingBatch, setEditingBatch] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const deletedItemRef = useRef(null);

  const showToast = useCallback((msg, type = 'success', undoData = null, duration = 5000) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message: msg, type, undo: undoData });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      if (undoData) deletedItemRef.current = null;
    }, duration);
  }, []);

  useEffect(() => {
    fetchAllData();
    if (paramId) {
      loadWarehouseDetail(paramId);
    }
  }, [paramId]);

  useEffect(() => {
    if (paramId && selectedWarehouse) {
      setActiveTab('warehouse-detail');
    }
  }, [paramId, selectedWarehouse]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [whRes, batchRes, prodRes] = await Promise.allSettled([
        fetch('/api/warehouses', { credentials: 'include' }).then(r => r.json()),
        fetch('/api/warehouses/all/batches', { credentials: 'include' }).then(r => r.json()),
        fetch('/api/products', { credentials: 'include' }).then(r => r.json())
      ]);
      if (whRes.status === 'fulfilled' && whRes.value.success) setWarehouses(whRes.value.data || []);
      if (batchRes.status === 'fulfilled' && batchRes.value.success) setAllBatches(batchRes.value.data || []);
      if (prodRes.status === 'fulfilled' && prodRes.value.success) setProducts(prodRes.value.data || []);
      if (whRes.status === 'fulfilled' && !whRes.value.success) setError(whRes.value.error || 'Failed to load');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const loadWarehouseDetail = async (id) => {
    try {
      const res = await fetch('/api/warehouses/' + id, { credentials: 'include' }).then(r => r.json());
      if (res.success) setSelectedWarehouse(res.data);
    } catch (_) {}
  };

  // ── Warehouse CRUD ──────────────────────────────────────────────

  const handleCreateWh = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/warehouses', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(whFormData) }).then(r => r.json());
      if (res.success) {
        showToast('Warehouse created');
        setShowWhForm(false);
        setWhFormData({ name: '', location: '', contact_person: '', contact_phone: '' });
        fetchAllData();
      } else showToast(res.error || 'Failed', 'error');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleUpdateWh = async (e) => {
    e.preventDefault();
    if (!editingWh) return;
    try {
      const res = await fetch('/api/warehouses/' + editingWh.id, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(whFormData) }).then(r => r.json());
      if (res.success) {
        showToast('Warehouse updated');
        setShowWhForm(false);
        setEditingWh(null);
        setWhFormData({ name: '', location: '', contact_person: '', contact_phone: '' });
        fetchAllData();
        if (selectedWarehouse) loadWarehouseDetail(editingWh.id);
      } else showToast(res.error || 'Failed', 'error');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleDeleteWh = async (id) => {
    const deletedItem = warehouses.find(w => w.id === id);
    if (!deletedItem) return;
    try {
      const res = await fetch('/api/warehouses/' + id, { method: 'DELETE', credentials: 'include' }).then(r => r.json());
      if (res.success) {
        deletedItemRef.current = deletedItem;
        showToast('Warehouse deleted', 'success', { label: 'Undo', handler: () => handleUndoDeleteWh(deletedItem) }, 10000);
        fetchAllData();
        if (selectedWarehouse?.id === id) { setSelectedWarehouse(null); setActiveTab('warehouses'); navigate('/warehouse'); }
      } else showToast(res.error || 'Failed', 'error');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleUndoDeleteWh = async (item) => {
    try {
      const res = await fetch('/api/warehouses', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: item.name, location: item.location, contact_person: item.contact_person, contact_phone: item.contact_phone })
      }).then(r => r.json());
      if (res.success) {
        deletedItemRef.current = null; setToast(null);
        showToast('Warehouse restored', 'success');
        fetchAllData();
      } else showToast(res.error || 'Failed to restore', 'error');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const openEditWh = (wh) => {
    setEditingWh(wh);
    setWhFormData({ name: wh.name, location: wh.location || '', contact_person: wh.contact_person || '', contact_phone: wh.contact_phone || '' });
    setShowWhForm(true);
  };

  // ── Stock Batch CRUD ────────────────────────────────────────────

  const handleCreateBatch = async (e) => {
    e.preventDefault();
    const whId = editingBatch ? editingBatch.warehouse_id : (selectedWarehouse?.id || batchFormData.warehouse_id);
    if (!whId) return showToast('Please select a warehouse', 'error');
    try {
      const res = await fetch('/api/warehouses/' + whId + '/batches', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...batchFormData, quantity: Number(batchFormData.quantity) })
      }).then(r => r.json());
      if (res.success) {
        showToast('Stock batch added');
        setShowBatchForm(false);
        setBatchFormData({ product_id: '', batch_number: '', quantity: '', expiry_date: '', warehouse_id: whId });
        fetchAllData();
        if (selectedWarehouse) loadWarehouseDetail(selectedWarehouse.id);
      } else showToast(res.error || 'Failed', 'error');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleUpdateBatch = async (e) => {
    e.preventDefault();
    if (!editingBatch) return;
    try {
      const res = await fetch('/api/warehouses/' + editingBatch.warehouse_id + '/batches/' + editingBatch.id, {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...batchFormData, quantity: Number(batchFormData.quantity) })
      }).then(r => r.json());
      if (res.success) {
        showToast('Stock batch updated');
        setShowBatchForm(false);
        setEditingBatch(null);
        setBatchFormData({ product_id: '', batch_number: '', quantity: '', expiry_date: '', warehouse_id: '' });
        fetchAllData();
        if (selectedWarehouse) loadWarehouseDetail(selectedWarehouse.id);
      } else showToast(res.error || 'Failed', 'error');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleDeleteBatch = async (batchId, whId) => {
    if (!window.confirm('Delete this stock batch?')) return;
    try {
      const res = await fetch('/api/warehouses/' + whId + '/batches/' + batchId, { method: 'DELETE', credentials: 'include' }).then(r => r.json());
      if (res.success) {
        showToast('Stock batch deleted');
        fetchAllData();
        if (selectedWarehouse) loadWarehouseDetail(selectedWarehouse.id);
      } else showToast(res.error || 'Failed', 'error');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const openEditBatch = (batch) => {
    setEditingBatch(batch);
    setBatchFormData({ product_id: batch.product_id, batch_number: batch.batch_number, quantity: String(batch.quantity), expiry_date: batch.expiry_date ? batch.expiry_date.slice(0, 10) : '', warehouse_id: batch.warehouse_id });
    setShowBatchForm(true);
  };

  // ── Filters ─────────────────────────────────────────────────────

  const filteredBatches = allBatches.filter(b => {
    if (!batchSearch) return true;
    const q = batchSearch.toLowerCase();
    return (b.product_name || '').toLowerCase().includes(q) ||
      (b.batch_number || '').toLowerCase().includes(q) ||
      (b.warehouse_name || '').toLowerCase().includes(q);
  });

  const filteredWarehouses = warehouses.filter(w => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return w.name.toLowerCase().includes(q) ||
      (w.location || '').toLowerCase().includes(q) ||
      (w.contact_person || '').toLowerCase().includes(q);
  });

  if (loading) return <LoadingState message="Loading warehouses..." />;
  if (error) return <ErrorState message={error} onRetry={fetchAllData} />;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-surface-100">Warehouse & Stock Management</h1>
          <p className="text-surface-400 text-sm">Manage warehouses, stock batches, and inventory across all locations</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowWhForm(true); setEditingWh(null); setWhFormData({ name: '', location: '', contact_person: '', contact_phone: '' }); }} className="btn-primary text-sm bg-amber-500 hover:bg-amber-400 text-surface-900">+ Add Warehouse</button>
          <button onClick={() => navigate('/admin', { state: { tab: 'operations' } })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-700/50 text-surface-300 border border-surface-600/50 text-xs font-medium hover:bg-surface-700 hover:text-surface-100 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button onClick={() => { setActiveTab('warehouses'); navigate('/warehouse'); setSelectedWarehouse(null); }}
          className={'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ' + (activeTab === 'warehouses' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-surface-800 text-surface-400 border border-surface-700 hover:border-surface-600')}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          Warehouses <span className="badge bg-surface-700 text-surface-400 text-[10px]">{warehouses.length}</span>
        </button>
        <button onClick={() => setActiveTab('batches')}
          className={'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ' + (activeTab === 'batches' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-surface-800 text-surface-400 border border-surface-700 hover:border-surface-600')}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
          All Stock Batches <span className="badge bg-surface-700 text-surface-400 text-[10px]">{allBatches.length}</span>
        </button>
      </div>

      {/* ── WAREHOUSE LIST TAB ────────────────────────────────────── */}
      {activeTab === 'warehouses' && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" placeholder="Search warehouses..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm text-surface-200 placeholder-surface-500 focus:outline-none focus:border-amber-500/50 transition-all" />
            </div>
            <span className="text-xs text-surface-500">{filteredWarehouses.length} / {warehouses.length} warehouses</span>
          </div>

          {filteredWarehouses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredWarehouses.map(wh => (
                <div key={wh.id} className="card p-5 hover:border-amber-500/30 transition-all group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-surface-100 truncate">{wh.name}</h3>
                      <p className="text-xs text-surface-400 mt-0.5 truncate">{wh.location || 'No location specified'}</p>
                    </div>
                    <span className="badge bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] flex-shrink-0 ml-2">{wh.batch_count || 0} batches</span>
                  </div>
                  <div className="text-xs text-surface-500 space-y-1 mb-4">
                    {wh.contact_person && <p className="flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> {wh.contact_person}</p>}
                    {wh.contact_phone && <p className="flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg> {wh.contact_phone}</p>}
                    <p className="flex items-center gap-1 text-surface-600"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> Created {wh.created_at ? new Date(wh.created_at).toLocaleDateString('en-IN') : '—'}</p>
                  </div>
                  <div className="flex items-center gap-2 pt-3 border-t border-surface-700/30">
                    <button onClick={() => { setSelectedWarehouse(wh); setActiveTab('warehouse-detail'); navigate('/warehouse/' + wh.id); }} className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                      Manage Stock
                    </button>
                    <button onClick={() => openEditWh(wh)} className="text-xs text-surface-400 hover:text-surface-200 transition-colors flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      Edit
                    </button>
                    <button onClick={() => handleDeleteWh(wh.id)} className="text-xs text-red-400 hover:text-red-300 ml-auto transition-colors flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card p-12 text-center">
              <svg className="w-16 h-16 mx-auto text-surface-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
              <h3 className="text-surface-300 font-medium text-lg mb-1">{searchQuery ? 'No warehouses match your search' : 'No warehouses yet'}</h3>
              <p className="text-surface-500 text-sm mb-4">{searchQuery ? 'Try a different search term' : 'Add your first warehouse to start managing inventory'}</p>
              {!searchQuery && <button onClick={() => { setShowWhForm(true); setEditingWh(null); setWhFormData({ name: '', location: '', contact_person: '', contact_phone: '' }); }} className="btn-primary text-sm bg-amber-500 hover:bg-amber-400 text-surface-900">+ Add Warehouse</button>}
            </div>
          )}
        </div>
      )}

      {/* ── WAREHOUSE DETAIL TAB ──────────────────────────────────── */}
      {activeTab === 'warehouse-detail' && selectedWarehouse && (
        <div>
          <div className="card p-5 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold text-surface-100">{selectedWarehouse.name}</h2>
                  <span className="badge bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px]">{(selectedWarehouse.batches || []).length} batches</span>
                </div>
                <p className="text-surface-400 text-sm">{selectedWarehouse.location || 'No location'}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-surface-500">
                  {selectedWarehouse.contact_person && <span>Contact: {selectedWarehouse.contact_person}</span>}
                  {selectedWarehouse.contact_phone && <span>Phone: {selectedWarehouse.contact_phone}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setEditingBatch(null); setBatchFormData({ product_id: '', batch_number: '', quantity: '', expiry_date: '', warehouse_id: selectedWarehouse.id }); setShowBatchForm(true); }} className="btn-primary text-sm">+ Add Stock Batch</button>
                <button onClick={() => { setActiveTab('warehouses'); navigate('/warehouse'); setSelectedWarehouse(null); }} className="px-3 py-1.5 rounded-lg text-xs text-surface-400 bg-surface-800 border border-surface-700 hover:border-surface-600 transition-all">
                  Back to List
                </button>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-surface-100 mb-4">Stock Batches at {selectedWarehouse.name}</h3>
            {(selectedWarehouse.batches || []).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-700/50">
                      <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Product</th>
                      <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Batch #</th>
                      <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Quantity</th>
                      <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Expiry</th>
                      <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Created</th>
                      <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-700/30">
                    {(selectedWarehouse.batches || []).map(b => (
                      <tr key={b.id} className="hover:bg-surface-700/20 transition-colors">
                        <td className="px-3 py-3 text-surface-200 font-medium">{b.product_name || 'Unknown'}</td>
                        <td className="px-3 py-3"><span className="text-xs font-mono text-surface-300">{b.batch_number}</span></td>
                        <td className="px-3 py-3 text-right"><span className="text-surface-200 font-semibold">{Number(b.quantity).toLocaleString()}</span></td>
                        <td className="px-3 py-3">
                          {b.expiry_date ? (
                            <span className={'text-xs ' + (new Date(b.expiry_date) < new Date() ? 'text-red-400' : 'text-surface-400')}>
                              {new Date(b.expiry_date).toLocaleDateString('en-IN')}
                              {new Date(b.expiry_date) < new Date() && <span className="ml-1 text-red-400">(Expired)</span>}
                            </span>
                          ) : <span className="text-xs text-surface-500">—</span>}
                        </td>
                        <td className="px-3 py-3 text-xs text-surface-500">{b.created_at ? new Date(b.created_at).toLocaleDateString('en-IN') : '—'}</td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEditBatch({ ...b, warehouse_id: selectedWarehouse.id })} className="p-1.5 rounded text-surface-500 hover:text-cyan-400 hover:bg-surface-700 transition-all" title="Edit">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button onClick={() => handleDeleteBatch(b.id, selectedWarehouse.id)} className="p-1.5 rounded text-surface-500 hover:text-red-400 hover:bg-surface-700 transition-all" title="Delete">
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
              <div className="text-center py-8">
                <svg className="w-12 h-12 mx-auto text-surface-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                <p className="text-surface-400 text-sm">No stock batches yet for this warehouse</p>
                <button onClick={() => { setEditingBatch(null); setBatchFormData({ product_id: '', batch_number: '', quantity: '', expiry_date: '', warehouse_id: selectedWarehouse.id }); setShowBatchForm(true); }} className="mt-3 text-sm text-amber-400 hover:text-amber-300 transition-colors">+ Add first batch</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ALL STOCK BATCHES TAB ─────────────────────────────────── */}
      {activeTab === 'batches' && (
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" placeholder="Search batches by product, batch #, or warehouse..." value={batchSearch} onChange={e => setBatchSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm text-surface-200 placeholder-surface-500 focus:outline-none focus:border-amber-500/50 transition-all" />
            </div>
            <span className="text-xs text-surface-500">{filteredBatches.length} / {allBatches.length} batches</span>
            <button onClick={() => { setEditingBatch(null); setBatchFormData({ product_id: '', batch_number: '', quantity: '', expiry_date: '', warehouse_id: '' }); setShowBatchForm(true); }} className="btn-primary text-sm">+ Add Batch</button>
          </div>

          {filteredBatches.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-700/50 bg-surface-800/30">
                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Product</th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Batch #</th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Warehouse</th>
                    <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Qty</th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Expiry</th>
                    <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-700/30">
                  {filteredBatches.map(b => (
                    <tr key={b.id} className="hover:bg-surface-700/20 transition-colors">
                      <td className="px-3 py-3">
                        <p className="text-surface-200 font-medium">{b.product_name || 'Unknown'}</p>
                        <p className="text-[10px] text-surface-500">{b.sku || ''}</p>
                      </td>
                      <td className="px-3 py-3"><span className="text-xs font-mono text-surface-300 bg-surface-800 px-2 py-0.5 rounded">{b.batch_number}</span></td>
                      <td className="px-3 py-3">
                        <button onClick={() => { loadWarehouseDetail(b.warehouse_id); setActiveTab('warehouse-detail'); navigate('/warehouse/' + b.warehouse_id); }} className="text-surface-300 hover:text-cyan-400 transition-colors text-xs underline underline-offset-2 decoration-surface-600 hover:decoration-cyan-500">
                          {b.warehouse_name || '—'}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-right"><span className="text-surface-200 font-semibold">{Number(b.quantity).toLocaleString()}</span></td>
                      <td className="px-3 py-3">
                        {b.expiry_date ? (
                          <span className={'text-xs ' + (new Date(b.expiry_date) < new Date() ? 'text-red-400' : 'text-surface-400')}>
                            {new Date(b.expiry_date).toLocaleDateString('en-IN')}
                          </span>
                        ) : <span className="text-xs text-surface-500">—</span>}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditBatch(b)} className="p-1.5 rounded text-surface-500 hover:text-cyan-400 hover:bg-surface-700 transition-all" title="Edit">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={() => handleDeleteBatch(b.id, b.warehouse_id)} className="p-1.5 rounded text-surface-500 hover:text-red-400 hover:bg-surface-700 transition-all" title="Delete">
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
              <svg className="w-12 h-12 mx-auto text-surface-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
              <p className="text-surface-400 text-sm">{batchSearch ? 'No batches match your search' : 'No stock batches found'}</p>
              {!batchSearch && <button onClick={() => { setEditingBatch(null); setBatchFormData({ product_id: '', batch_number: '', quantity: '', expiry_date: '', warehouse_id: '' }); setShowBatchForm(true); }} className="mt-3 btn-primary text-sm">+ Add Stock Batch</button>}
            </div>
          )}
        </div>
      )}

      {/* ── Add/Edit Warehouse Modal ──────────────────────────────── */}
      {showWhForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowWhForm(false)}>
          <div className="absolute inset-0 bg-surface-900/80 backdrop-blur-sm" />
          <div className="relative bg-surface-800 border border-surface-700 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-surface-100">{editingWh ? 'Edit Warehouse' : 'Add Warehouse'}</h3>
              <button type="button" onClick={() => { setShowWhForm(false); setEditingWh(null); }} className="text-surface-500 hover:text-surface-300">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={editingWh ? handleUpdateWh : handleCreateWh} className="space-y-4">
              <div>
                <label className="block text-xs text-surface-500 mb-1">Name *</label>
                <input type="text" value={whFormData.name} onChange={e => setWhFormData(p => ({ ...p, name: e.target.value }))} className="w-full bg-surface-700 text-surface-200 rounded-lg px-3 py-2 text-sm border border-surface-600 focus:border-amber-500 outline-none placeholder-surface-500" required placeholder="Warehouse name" />
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Location</label>
                <input type="text" value={whFormData.location} onChange={e => setWhFormData(p => ({ ...p, location: e.target.value }))} className="w-full bg-surface-700 text-surface-200 rounded-lg px-3 py-2 text-sm border border-surface-600 focus:border-amber-500 outline-none placeholder-surface-500" placeholder="City, address" />
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Contact Person</label>
                <input type="text" value={whFormData.contact_person} onChange={e => setWhFormData(p => ({ ...p, contact_person: e.target.value }))} className="w-full bg-surface-700 text-surface-200 rounded-lg px-3 py-2 text-sm border border-surface-600 focus:border-amber-500 outline-none placeholder-surface-500" placeholder="Full name" />
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Contact Phone</label>
                <input type="text" value={whFormData.contact_phone} onChange={e => setWhFormData(p => ({ ...p, contact_phone: e.target.value }))} className="w-full bg-surface-700 text-surface-200 rounded-lg px-3 py-2 text-sm border border-surface-600 focus:border-amber-500 outline-none placeholder-surface-500" placeholder="Phone number" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary text-sm bg-amber-500 hover:bg-amber-400 text-surface-900">{editingWh ? 'Update Warehouse' : 'Create Warehouse'}</button>
                <button type="button" onClick={() => { setShowWhForm(false); setEditingWh(null); }} className="px-4 py-2 rounded-lg text-sm text-surface-400 bg-surface-700 hover:bg-surface-600 transition-all">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add/Edit Stock Batch Modal ────────────────────────────── */}
      {showBatchForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowBatchForm(false)}>
          <div className="absolute inset-0 bg-surface-900/80 backdrop-blur-sm" />
          <div className="relative bg-surface-800 border border-surface-700 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-surface-100">{editingBatch ? 'Edit Stock Batch' : 'Add Stock Batch'}</h3>
              <button type="button" onClick={() => { setShowBatchForm(false); setEditingBatch(null); }} className="text-surface-500 hover:text-surface-300">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={editingBatch ? handleUpdateBatch : handleCreateBatch} className="space-y-4">
              <div>
                <label className="block text-xs text-surface-500 mb-1">Product *</label>
                <select value={batchFormData.product_id} onChange={e => setBatchFormData(p => ({ ...p, product_id: e.target.value }))} required className="w-full bg-surface-700 text-surface-200 rounded-lg px-3 py-2 text-sm border border-surface-600 focus:border-amber-500 outline-none">
                  <option value="">Select product...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku || 'No SKU'})</option>)}
                </select>
              </div>
              {!selectedWarehouse && (
                <div>
                  <label className="block text-xs text-surface-500 mb-1">Warehouse *</label>
                  <select value={batchFormData.warehouse_id} onChange={e => setBatchFormData(p => ({ ...p, warehouse_id: e.target.value }))} required className="w-full bg-surface-700 text-surface-200 rounded-lg px-3 py-2 text-sm border border-surface-600 focus:border-amber-500 outline-none">
                    <option value="">Select warehouse...</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs text-surface-500 mb-1">Batch Number *</label>
                <input type="text" value={batchFormData.batch_number} onChange={e => setBatchFormData(p => ({ ...p, batch_number: e.target.value }))} required className="w-full bg-surface-700 text-surface-200 rounded-lg px-3 py-2 text-sm border border-surface-600 focus:border-amber-500 outline-none" placeholder="e.g. BATCH-001" />
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Quantity *</label>
                <input type="number" value={batchFormData.quantity} onChange={e => setBatchFormData(p => ({ ...p, quantity: e.target.value }))} required min="1" className="w-full bg-surface-700 text-surface-200 rounded-lg px-3 py-2 text-sm border border-surface-600 focus:border-amber-500 outline-none" placeholder="0" />
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Expiry Date</label>
                <input type="date" value={batchFormData.expiry_date} onChange={e => setBatchFormData(p => ({ ...p, expiry_date: e.target.value }))} className="w-full bg-surface-700 text-surface-200 rounded-lg px-3 py-2 text-sm border border-surface-600 focus:border-amber-500 outline-none" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary text-sm bg-amber-500 hover:bg-amber-400 text-surface-900">{editingBatch ? 'Update Batch' : 'Add Batch'}</button>
                <button type="button" onClick={() => { setShowBatchForm(false); setEditingBatch(null); }} className="px-4 py-2 rounded-lg text-sm text-surface-400 bg-surface-700 hover:bg-surface-600 transition-all">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Toast toast={toast} onDismiss={() => { setToast(null); if (toast?.undo) deletedItemRef.current = null; }} />
    </div>
  );
}
