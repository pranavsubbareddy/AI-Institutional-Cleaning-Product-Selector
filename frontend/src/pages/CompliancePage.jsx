import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import Toast from '../components/Toast';

export default function CompliancePage() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [institutions, setInstitutions] = useState([]);
  const [products, setProducts] = useState([]);
  const [formData, setFormData] = useState({ product_id: '', title: '', document_url: '', version: '1.0' });
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [ackForm, setAckForm] = useState({ institution_id: '', acknowledged_by: '' });
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

  const fetchDocs = async () => {
    try {
      setLoading(true);
      const [dRes, iRes, pRes] = await Promise.allSettled([
        fetch('/api/compliance', { credentials: 'include' }).then(r => r.json()),
        fetch('/api/institutions', { credentials: 'include' }).then(r => r.json()),
        fetch('/api/products', { credentials: 'include' }).then(r => r.json())
      ]);
      if (dRes.status === 'fulfilled' && dRes.value.success) setDocs(dRes.value.data || []);
      if (iRes.status === 'fulfilled' && iRes.value.success) setInstitutions(iRes.value.data || []);
      if (pRes.status === 'fulfilled' && pRes.value.success) setProducts(pRes.value.data || []);
      if (dRes.status === 'fulfilled' && !dRes.value.success) setError(dRes.value.error || 'Failed');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDocs(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/compliance', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      }).then(r => r.json());
      if (res.success) {
        showToast('Compliance document added');
        setShowForm(false);
        setFormData({ product_id: '', title: '', document_url: '', version: '1.0' });
        fetchDocs();
      } else showToast(res.error || 'Failed', 'error');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingDoc) return;
    try {
      const res = await fetch('/api/compliance/' + editingDoc.id, {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      }).then(r => r.json());
      if (res.success) {
        showToast('Document updated');
        setEditingDoc(null);
        setShowForm(false);
        setFormData({ product_id: '', title: '', document_url: '', version: '1.0' });
        fetchDocs();
        if (selectedDoc?.id === editingDoc.id) setSelectedDoc(null);
      } else showToast(res.error || 'Failed', 'error');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this compliance document?')) return;
    const deletedItem = docs.find(d => d.id === id);
    if (!deletedItem) return;
    try {
      const res = await fetch('/api/compliance/' + id, { method: 'DELETE', credentials: 'include' }).then(r => r.json());
      if (res.success) {
        deletedItemRef.current = deletedItem;
        showToast('Document deleted', 'success', { label: 'Undo', handler: () => handleUndoDelete(deletedItem) });
        fetchDocs();
        if (selectedDoc?.id === id) setSelectedDoc(null);
      } else showToast(res.error || 'Failed', 'error');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleUndoDelete = async (item) => {
    try {
      const res = await fetch('/api/compliance', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: item.product_id, title: item.title, document_url: item.document_url || '', version: item.version || '1.0' })
      }).then(r => r.json());
      if (res.success) {
        deletedItemRef.current = null; setToast(null);
        showToast('Document restored', 'success');
        fetchDocs();
      } else showToast(res.error || 'Failed to restore', 'error');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const openEdit = (doc) => {
    setEditingDoc(doc);
    setFormData({ product_id: doc.product_id, title: doc.title, document_url: doc.document_url || '', version: doc.version || '1.0' });
    setShowForm(true);
  };

  const viewDoc = async (id) => {
    try {
      const res = await fetch('/api/compliance/' + id, { credentials: 'include' }).then(r => r.json());
      if (res.success) {
        setSelectedDoc(res.data);
        setAckForm({ institution_id: '', acknowledged_by: '' });
      }
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleAcknowledge = async () => {
    if (!selectedDoc || !ackForm.institution_id || !ackForm.acknowledged_by) return;
    try {
      const res = await fetch('/api/compliance/acknowledge', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: selectedDoc.id, ...ackForm })
      }).then(r => r.json());
      if (res.success) {
        showToast('Acknowledged successfully');
        viewDoc(selectedDoc.id);
        setAckForm({ institution_id: '', acknowledged_by: '' });
      } else showToast(res.error || 'Failed', 'error');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const filteredDocs = docs.filter(d => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return d.title.toLowerCase().includes(q) ||
      (d.product_name || '').toLowerCase().includes(q) ||
      (d.version || '').toLowerCase().includes(q);
  });

  if (loading) return <LoadingState message="Loading compliance documents..." />;
  if (error) return <ErrorState message={error} onRetry={fetchDocs} />;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-rose-600 flex items-center justify-center shadow-lg">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-surface-100">Compliance Documents</h1>
          <p className="text-surface-400 text-sm">Manage MSDS documents, safety data sheets, and compliance acknowledgements</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowForm(true); setEditingDoc(null); setFormData({ product_id: '', title: '', document_url: '', version: '1.0' }); }} className="btn-primary text-sm bg-purple-500 hover:bg-purple-400">+ Add Document</button>
          <button onClick={() => navigate('/admin', { state: { tab: 'operations' } })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-700/50 text-surface-300 border border-surface-600/50 text-xs font-medium hover:bg-surface-700 hover:text-surface-100 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="card p-3 border-l-4 border-l-purple-500">
          <p className="text-[10px] text-surface-400 uppercase tracking-wider">Total Docs</p>
          <p className="text-lg font-bold text-purple-400 mt-1">{docs.length}</p>
        </div>
        <div className="card p-3 border-l-4 border-l-cyan-500">
          <p className="text-[10px] text-surface-400 uppercase tracking-wider">Products Covered</p>
          <p className="text-lg font-bold text-cyan-400 mt-1">{new Set(docs.map(d => d.product_id)).size}</p>
        </div>
        <div className="card p-3 border-l-4 border-l-emerald-500">
          <p className="text-[10px] text-surface-400 uppercase tracking-wider">Total Acknowledgements</p>
          <p className="text-lg font-bold text-emerald-400 mt-1">{docs.reduce((sum, d) => sum + (d.acknowledgement_count || 0), 0)}</p>
        </div>
        <div className="card p-3 border-l-4 border-l-amber-500">
          <p className="text-[10px] text-surface-400 uppercase tracking-wider">Pending Acks</p>
          <p className="text-lg font-bold text-amber-400 mt-1">{docs.filter(d => (d.acknowledgement_count || 0) === 0).length}</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input type="text" placeholder="Search documents by title, product..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm text-surface-200 placeholder-surface-500 focus:outline-none focus:border-purple-500/50 transition-all" />
        </div>
        <span className="text-xs text-surface-500">{filteredDocs.length} / {docs.length} documents</span>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Document list */}
        <div className="lg:col-span-2 card p-5">
          {filteredDocs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-700/50 bg-surface-800/30">
                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Title</th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Product</th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Version</th>
                    <th className="text-center px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Acknowledgements</th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Added</th>
                    <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-700/30">
                  {filteredDocs.map(doc => (
                    <tr key={doc.id} className={'hover:bg-surface-700/20 transition-colors cursor-pointer ' + (selectedDoc?.id === doc.id ? 'bg-purple-500/5' : '')} onClick={() => viewDoc(doc.id)}>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          <span className="text-surface-200 font-medium">{doc.title}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-surface-400 text-xs">{doc.product_name || '—'}</td>
                      <td className="px-3 py-3">
                        <span className="badge bg-surface-700 text-surface-400 border border-surface-600 text-[10px]">v{doc.version || '1.0'}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ' + ((doc.acknowledgement_count || 0) > 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30')}>
                          {doc.acknowledgement_count || 0}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-surface-500">{doc.created_at ? new Date(doc.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</td>
                      <td className="px-3 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(doc)} className="p-1.5 rounded text-surface-500 hover:text-purple-400 hover:bg-surface-700 transition-all" title="Edit">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={() => handleDelete(doc.id)} className="p-1.5 rounded text-surface-500 hover:text-red-400 hover:bg-surface-700 transition-all" title="Delete">
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
              <svg className="w-12 h-12 mx-auto text-surface-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              <p className="text-surface-400 text-sm">{searchQuery ? 'No documents match your search' : 'No compliance documents uploaded yet'}</p>
              {!searchQuery && <button onClick={() => { setShowForm(true); setEditingDoc(null); setFormData({ product_id: '', title: '', document_url: '', version: '1.0' }); }} className="mt-3 btn-primary text-sm bg-purple-500 hover:bg-purple-400">+ Add First Document</button>}
            </div>
          )}
        </div>

        {/* Detail / Acknowledge panel */}
        <div className="card p-5">
          {selectedDoc ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-surface-100">Document Details</h3>
                <button onClick={() => setSelectedDoc(null)} className="text-surface-500 hover:text-surface-300">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-surface-700/30 rounded-lg p-3">
                  <p className="text-[10px] text-surface-500 uppercase tracking-wider">Title</p>
                  <p className="text-surface-200 font-medium">{selectedDoc.title}</p>
                </div>
                <div className="bg-surface-700/30 rounded-lg p-3">
                  <p className="text-[10px] text-surface-500 uppercase tracking-wider">Product</p>
                  <p className="text-surface-200">{selectedDoc.product_name || 'N/A'}</p>
                </div>
                <div className="bg-surface-700/30 rounded-lg p-3">
                  <p className="text-[10px] text-surface-500 uppercase tracking-wider">Version</p>
                  <span className="badge bg-surface-700 text-surface-400 border border-surface-600 text-[10px]">v{selectedDoc.version || '1.0'}</span>
                </div>
                {selectedDoc.document_url && (
                  <div className="bg-surface-700/30 rounded-lg p-3">
                    <p className="text-[10px] text-surface-500 uppercase tracking-wider">Document URL</p>
                    <a href={selectedDoc.document_url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 text-sm underline break-all flex items-center gap-1 mt-1">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      {selectedDoc.document_url}
                    </a>
                  </div>
                )}
                <div className="bg-surface-700/30 rounded-lg p-3">
                  <p className="text-[10px] text-surface-500 uppercase tracking-wider">Uploaded</p>
                  <p className="text-surface-400 text-sm">{new Date(selectedDoc.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
              </div>

              {/* Acknowledgements list */}
              {selectedDoc.acknowledgements && selectedDoc.acknowledgements.length > 0 && (
                <div className="mt-6 pt-4 border-t border-surface-700/30">
                  <h4 className="text-sm font-semibold text-surface-100 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Acknowledgements ({selectedDoc.acknowledgements.length})
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedDoc.acknowledgements.map(ack => (
                      <div key={ack.id} className="bg-surface-700/30 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          </div>
                          <div>
                            <p className="text-xs text-surface-200 font-medium">{ack.institution_name || 'Unknown Institution'}</p>
                            <p className="text-[10px] text-surface-400">by {ack.acknowledged_by} on {new Date(ack.acknowledged_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Acknowledge form */}
              <div className="mt-6 pt-4 border-t border-surface-700/30">
                <h4 className="text-sm font-semibold text-surface-100 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  Acknowledge Document
                </h4>
                <div className="space-y-3">
                  <select
                    value={ackForm.institution_id}
                    onChange={e => setAckForm(prev => ({ ...prev, institution_id: e.target.value }))}
                    className="w-full bg-surface-700 text-surface-200 rounded-lg px-3 py-2 text-sm border border-surface-600 focus:border-purple-500 outline-none"
                  >
                    <option value="">Select institution...</option>
                    {institutions.map(inst => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
                  </select>
                  <input
                    type="text" value={ackForm.acknowledged_by}
                    onChange={e => setAckForm(prev => ({ ...prev, acknowledged_by: e.target.value }))}
                    placeholder="Acknowledged by (name)"
                    className="w-full bg-surface-700 text-surface-200 rounded-lg px-3 py-2 text-sm border border-surface-600 focus:border-purple-500 outline-none placeholder-surface-500"
                  />
                  <button
                    onClick={handleAcknowledge}
                    disabled={!ackForm.institution_id || !ackForm.acknowledged_by}
                    className="w-full btn-primary text-sm bg-purple-500 hover:bg-purple-400 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Submit Acknowledgement
                  </button>
                </div>
              </div>
            </div>
          ) : showForm ? (
            <form onSubmit={editingDoc ? handleUpdate : handleCreate} className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-surface-100">{editingDoc ? 'Edit Document' : 'Add Compliance Document'}</h3>
                <button type="button" onClick={() => { setShowForm(false); setEditingDoc(null); }} className="text-surface-500 hover:text-surface-300">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Product *</label>
                <select value={formData.product_id} onChange={e => setFormData(prev => ({ ...prev, product_id: e.target.value }))} required className="w-full bg-surface-700 text-surface-200 rounded-lg px-3 py-2 text-sm border border-surface-600 focus:border-purple-500 outline-none">
                  <option value="">Select product...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Title *</label>
                <input type="text" value={formData.title} onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))} required placeholder="Document title" className="w-full bg-surface-700 text-surface-200 rounded-lg px-3 py-2 text-sm border border-surface-600 focus:border-purple-500 outline-none placeholder-surface-500" />
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Document URL</label>
                <input type="url" value={formData.document_url} onChange={e => setFormData(prev => ({ ...prev, document_url: e.target.value }))} placeholder="https://..." className="w-full bg-surface-700 text-surface-200 rounded-lg px-3 py-2 text-sm border border-surface-600 focus:border-purple-500 outline-none placeholder-surface-500" />
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Version</label>
                <input type="text" value={formData.version} onChange={e => setFormData(prev => ({ ...prev, version: e.target.value }))} className="w-full bg-surface-700 text-surface-200 rounded-lg px-3 py-2 text-sm border border-surface-600 focus:border-purple-500 outline-none placeholder-surface-500" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary text-sm bg-purple-500 hover:bg-purple-400">{editingDoc ? 'Update Document' : 'Create Document'}</button>
                <button type="button" onClick={() => { setShowForm(false); setEditingDoc(null); }} className="px-4 py-2 rounded-lg text-sm text-surface-400 bg-surface-700 hover:bg-surface-600 transition-all">Cancel</button>
              </div>
            </form>
          ) : (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-surface-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              <p className="text-surface-400 text-sm">Select a document to view details, or add a new document</p>
            </div>
          )}
        </div>
      </div>

      <Toast toast={toast} onDismiss={() => { setToast(null); if (toast?.undo) deletedItemRef.current = null; }} />
    </div>
  );
}
