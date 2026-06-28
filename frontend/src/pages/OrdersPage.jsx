import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import Toast from '../components/Toast';

const WORKFLOW_STAGES = [
  { id: 'request_created', label: 'Request Created', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'bg-surface-600' },
  { id: 'quotation_sent', label: 'Quotation Sent', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', color: 'bg-cyan-500' },
  { id: 'customer_approved', label: 'Customer Approved', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'bg-emerald-500' },
  { id: 'payment_received', label: 'Payment Received', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'bg-amber-500' },
  { id: 'processing', label: 'Processing', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', color: 'bg-blue-500' },
  { id: 'ready_for_dispatch', label: 'Ready for Dispatch', icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4', color: 'bg-purple-500' },
  { id: 'dispatched', label: 'Dispatched', icon: 'M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0', color: 'bg-indigo-500' },
  { id: 'delivered', label: 'Delivered', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'bg-emerald-500' },
  { id: 'cancelled', label: 'Cancelled', icon: 'M6 18L18 6M6 6l12 12', color: 'bg-red-500' },
];

const WORKFLOW_COLORS = {
  request_created: 'bg-surface-500/10 text-surface-400 border-surface-500/30',
  quotation_sent: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  customer_approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  payment_received: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  processing: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  ready_for_dispatch: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  dispatched: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  delivered: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/30',
};

export default function OrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, delivered: 0, cancelled: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [institutions, setInstitutions] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ institution_id: '', recommendation_id: '', total_amount: '', delivery_date: '', notes: '' });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedOrderFull, setSelectedOrderFull] = useState(null);
  const [invoiceData, setInvoiceData] = useState(null);
  const [advancingStage, setAdvancingStage] = useState('');
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceBlobUrl, setInvoiceBlobUrl] = useState('');
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const deletedItemRef = useRef(null);

  const showToast = useCallback((msg, type = 'success', undoData = null) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message: msg, type, undo: undoData });
    toastTimerRef.current = setTimeout(() => { setToast(null); if (undoData) deletedItemRef.current = null; }, 5000);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (searchQuery) params.search = searchQuery;
      const [oRes, sRes, iRes, rRes] = await Promise.allSettled([
        api.getOrders(params), api.getOrderStats(),
        api.getInstitutions({ limit: 200 }), api.getRecommendations({ limit: 100 })
      ]);
      if (oRes.status === 'fulfilled' && oRes.value.success) setOrders(oRes.value.data || []);
      if (sRes.status === 'fulfilled' && sRes.value.success) setStats(sRes.value.data);
      if (iRes.status === 'fulfilled' && iRes.value.success) setInstitutions(iRes.value.data || []);
      if (rRes.status === 'fulfilled' && rRes.value.success) setRecommendations(rRes.value.data || []);
      if (oRes.status === 'fulfilled' && !oRes.value.success) setError(oRes.value.error || 'Failed');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [statusFilter, searchQuery]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await api.createOrder({ ...formData, total_amount: formData.total_amount ? Number(formData.total_amount) : undefined });
      if (res.success) {
        showToast('Order created', 'success');
        setShowForm(false);
        setFormData({ institution_id: '', recommendation_id: '', total_amount: '', delivery_date: '', notes: '' });
        fetchData();
      } else showToast(res.error || 'Failed', 'error');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this order and all workflow history?')) return;
    const deletedItem = orders.find(o => o.id === id);
    if (!deletedItem) return;
    try {
      const res = await api.deleteOrder(id);
      if (res.success) {
        deletedItemRef.current = deletedItem;
        showToast('Order deleted', 'success', { label: 'Undo', handler: () => handleUndoDelete(deletedItem) });
        fetchData();
        if (selectedOrder === id) { setSelectedOrder(null); setSelectedOrderFull(null); }
      } else showToast(res.error || 'Failed', 'error');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleUndoDelete = async (item) => {
    try {
      const res = await api.createOrder({
        institution_id: item.institution_id, recommendation_id: item.recommendation_id || undefined,
        total_amount: item.total_amount, delivery_date: item.delivery_date || undefined, notes: item.notes || ''
      });
      if (res.success) { deletedItemRef.current = null; setToast(null); showToast('Order restored', 'success'); fetchData(); }
      else showToast(res.error || 'Failed to restore', 'error');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const viewOrderDetail = async (id) => {
    try {
      setSelectedOrder(id);
      const res = await api.getOrder(id);
      if (res.success) setSelectedOrderFull(res.data);
    } catch (_) {}
  };

  const handleAdvanceWorkflow = async (toStage) => {
    if (!selectedOrder || advancingStage) return;
    setAdvancingStage(toStage);
    try {
      const labels = { quotation_sent: 'Send Quotation', customer_approved: 'Mark Customer Approved', payment_received: 'Record Payment', processing: 'Start Processing', ready_for_dispatch: 'Mark Ready for Dispatch', dispatched: 'Mark Dispatched', delivered: 'Mark Delivered', cancelled: 'Cancel Order' };
      const res = await api.advanceOrderWorkflow(selectedOrder, { to_stage: toStage, action: labels[toStage] || 'Advance', notes: '' });
      if (res.success) {
        showToast('Order advanced to ' + (WORKFLOW_STAGES.find(s => s.id === toStage)?.label || toStage), 'success');
        viewOrderDetail(selectedOrder);
        fetchData();
      } else showToast(res.error || 'Failed', 'error');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setAdvancingStage(''); }
  };

  const generateInvoice = async (id) => {
    try {
      const res = await api.getOrderInvoice(id);
      if (res.success) {
        setInvoiceData(res.data);
        setShowInvoiceModal(true);
        buildInvoicePreview(res.data);
      } else showToast(res.error || 'Failed', 'error');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const buildInvoicePreview = (inv) => {
    const now = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const itemsHtml = inv.items.map(item =>
      `<tr><td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.srNo}</td>` +
      `<td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;">${item.productName}</td>` +
      `<td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity} ${item.unit}</td>` +
      `<td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;text-align:right;">Rs ${Number(item.unitPrice).toLocaleString('en-IN')}</td>` +
      `<td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">Rs ${Number(item.totalPrice).toLocaleString('en-IN')}</td></tr>`
    ).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${inv.invoiceNumber}</title>` +
      `<style>@page{margin:12mm 10mm}body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e;font-size:11px;margin:0;padding:0}` +
      `.header{display:flex;justify-content:space-between;padding-bottom:16px;border-bottom:3px solid #0ea5e9;margin-bottom:16px}` +
      `.header h1{margin:0;font-size:24px;color:#0ea5e9;font-weight:800}` +
      `.sub{font-size:10px;color:#6b7280;margin-top:2px}` +
      `.invoice-info{display:flex;justify-content:space-between;margin-bottom:20px}` +
      `.invoice-info .box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px;width:48%}` +
      `.invoice-info .box .lbl{font-size:8px;text-transform:uppercase;color:#6b7280;font-weight:600}` +
      `.invoice-info .box .val{font-size:12px;font-weight:600;color:#1a1a2e;margin-top:2px}` +
      `table{width:100%;border-collapse:collapse;margin:16px 0}` +
      `th{background:#0ea5e9;color:white;padding:8px 6px;font-size:9px;text-transform:uppercase}` +
      `td{padding:8px 6px;border-bottom:1px solid #e5e7eb;font-size:10px}` +
      `.totals{width:300px;margin-left:auto}.totals td{padding:4px 8px;border:none}` +
      `.totals .grand{font-size:14px;font-weight:700;color:#0ea5e9}` +
      `.footer{text-align:center;padding-top:20px;margin-top:20px;border-top:1px solid #e5e7eb;font-size:9px;color:#9ca3af}` +
      `.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:9px;font-weight:600;background:#dbeafe;color:#1d4ed8}</style></head><body>` +
      `<div class="header"><div><h1>Ganga Maxx</h1><div class="sub">AI Institutional Cleaning Products</div></div>` +
      `<div style="text-align:right;"><div style="font-size:18px;font-weight:700;color:#1a1a2e;">${inv.invoiceNumber}</div>` +
      `<div class="sub">Date: ${now}</div><div style="margin-top:4px;"><span class="badge">${inv.payment_status.toUpperCase()}</span></div></div></div>` +
      `<div class="invoice-info"><div class="box"><div class="lbl">Bill To</div><div class="val">${inv.institution.name}</div>` +
      `<div style="font-size:10px;color:#6b7280;">${inv.institution.address || ''}</div></div>` +
      `<div class="box"><div class="lbl">Invoice Details</div><div style="font-size:10px;color:#6b7280;">` +
      `Order: ${inv.orderId.slice(0,12)}<br>Due: ${new Date(inv.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div></div></div>` +
      `<table><tr><th style="width:40px;">#</th><th>Product</th><th style="width:80px;">Qty</th><th style="width:100px;">Unit Price</th><th style="width:120px;">Total</th></tr>` +
      (itemsHtml || '<tr><td colspan="5" style="text-align:center;color:#9ca3af;">No items</td></tr>') + '</table>' +
      `<table class="totals"><tr><td style="text-align:right;font-weight:600;">Subtotal:</td><td style="text-align:right;">Rs ${Number(inv.subtotal).toLocaleString('en-IN')}</td></tr>` +
      `<tr><td style="text-align:right;font-weight:600;">GST (${inv.taxRate}%):</td><td style="text-align:right;">Rs ${Number(inv.taxAmount).toLocaleString('en-IN')}</td></tr>` +
      `<tr><td style="text-align:right;font-weight:600;padding-top:8px;border-top:2px solid #e5e7eb;">Total:</td>` +
      `<td style="text-align:right;padding-top:8px;border-top:2px solid #e5e7eb;" class="grand">Rs ${Number(inv.total).toLocaleString('en-IN')}</td></tr></table>` +
      `<div class="footer">Ganga Maxx &middot; Invoice ${inv.invoiceNumber}</div></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    setInvoiceBlobUrl(URL.createObjectURL(blob));
  };

  const downloadInvoicePdf = async () => {
    if (!invoiceData) return;
    const inv = invoiceData;
    const now = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const itemsHtml = inv.items.map(item =>
      `<tr><td>${item.srNo}</td><td>${item.productName}</td><td>${item.quantity} ${item.unit}</td><td>Rs ${Number(item.unitPrice).toLocaleString('en-IN')}</td><td>Rs ${Number(item.totalPrice).toLocaleString('en-IN')}</td></tr>`
    ).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${inv.invoiceNumber}</title>` +
      `<style>@page{margin:10mm}body{font-family:Arial,sans-serif;color:#333;font-size:11px}` +
      `h1{color:#0ea5e9;border-bottom:2px solid #0ea5e9;padding-bottom:10px}` +
      `.info{display:flex;justify-content:space-between;margin:16px 0}` +
      `table{width:100%;border-collapse:collapse}` +
      `th{background:#0ea5e9;color:white;padding:8px 6px;text-align:left;font-size:10px}` +
      `td{padding:6px;border-bottom:1px solid #ddd;font-size:10px}` +
      `.right{text-align:right}` +
      `.total{font-size:14px;font-weight:700;color:#0ea5e9}` +
      `.footer{text-align:center;margin-top:20px;padding-top:10px;border-top:1px solid #ddd;font-size:9px;color:#999}</style></head><body>` +
      `<h1>Ganga Maxx - Invoice</h1>` +
      `<div class="info"><div><strong>${inv.institution.name}</strong><br>${inv.institution.address || ''}</div>` +
      `<div style="text-align:right;"><strong>${inv.invoiceNumber}</strong><br>Date: ${now}</div></div>` +
      `<table><tr><th>#</th><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>${itemsHtml}</table>` +
      `<table style="width:300px;margin-left:auto;margin-top:16px">` +
      `<tr><td class="right">Subtotal:</td><td class="right">Rs ${Number(inv.subtotal).toLocaleString('en-IN')}</td></tr>` +
      `<tr><td class="right">GST ${inv.taxRate}%:</td><td class="right">Rs ${Number(inv.taxAmount).toLocaleString('en-IN')}</td></tr>` +
      `<tr><td class="right total">Total:</td><td class="right total">Rs ${Number(inv.total).toLocaleString('en-IN')}</td></tr></table>` +
      `<div class="footer">Ganga Maxx AI Institutional Cleaning Products &middot; ${inv.invoiceNumber}</div></body></html>`;
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
        margin: [8, 6, 8, 6], filename: inv.invoiceNumber + '.pdf',
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      }).from(container).save();
    } catch (err) { console.error('PDF export failed:', err); }
    document.body.removeChild(container);
  };

  const fmtCurrency = (val) => {
    if (!val && val !== 0) return '\u2014';
    return 'Rs ' + Number(val).toLocaleString('en-IN');
  };

  const fmtDate = (d) => {
    if (!d) return '\u2014';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => { if (invoiceBlobUrl) URL.revokeObjectURL(invoiceBlobUrl); };
  }, [invoiceBlobUrl]);

  const getNextStages = (current) => {
    const ids = WORKFLOW_STAGES.map(s => s.id);
    const idx = ids.indexOf(current);
    if (idx === -1 || idx >= ids.length - 1) return [];
    // Show all remaining stages so user can skip ahead if needed
    return ids.slice(idx + 1).filter(s => s !== 'cancelled');
  };

  if (loading && orders.length === 0) return <LoadingState message="Loading orders..." />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-surface-100">Order Management</h1>
          <p className="text-surface-400 text-sm">Create orders, track workflow stages, and generate invoices</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowForm(true); }} className="btn-primary text-sm bg-cyan-500 hover:bg-cyan-400 text-surface-900">+ Create Order</button>
          <button onClick={() => navigate('/admin', { state: { tab: 'operations' } })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-700/50 text-surface-300 border border-surface-600/50 text-xs font-medium hover:bg-surface-700 hover:text-surface-100 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Total Orders', value: stats.total, color: 'cyan' },
          { label: 'Pending', value: stats.pending, color: 'amber' },
          { label: 'Approved', value: stats.approved, color: 'emerald' },
          { label: 'Delivered', value: stats.delivered, color: 'blue' },
          { label: 'Cancelled', value: stats.cancelled, color: 'red' },
          { label: 'Revenue', value: fmtCurrency(stats.totalRevenue), color: 'purple' },
        ].map((s, i) => (
          <div key={i} className={'card p-3 border-l-4 border-l-' + s.color + '-500'}>
            <p className="text-[10px] text-surface-400 uppercase tracking-wider">{s.label}</p>
            <p className={'text-lg font-bold mt-1 text-' + s.color + '-400'}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input type="text" placeholder="Search orders..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm text-surface-200 placeholder-surface-500 focus:outline-none focus:border-cyan-500/50 transition-all" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm text-surface-200 focus:outline-none focus:border-cyan-500/50">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <span className="text-xs text-surface-500">{orders.length} orders</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-5">
          {orders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-surface-700/50 bg-surface-800/30">
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Institution</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Workflow</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Amount</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Date</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-surface-700/30">
                  {orders.map(o => (
                    <tr key={o.id} className={'hover:bg-surface-700/20 cursor-pointer ' + (selectedOrder === o.id ? 'bg-cyan-500/5' : '')} onClick={() => viewOrderDetail(o.id)}>
                      <td className="px-3 py-3"><p className="text-surface-200 font-medium">{o.institution_name || 'Unknown'}</p><p className="text-[10px] text-surface-500">{o.id.slice(0,12)}</p></td>
                      <td className="px-3 py-3"><span className={'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ' + (WORKFLOW_COLORS[o.workflow_stage] || 'bg-surface-700 text-surface-400 border-surface-600')}>{(WORKFLOW_STAGES.find(s => s.id === o.workflow_stage)?.label || o.workflow_stage || '').replace(/_/g, ' ')}</span></td>
                      <td className="px-3 py-3 text-right font-semibold text-surface-200">{fmtCurrency(o.total_amount)}</td>
                      <td className="px-3 py-3 text-xs text-surface-400">{fmtDate(o.created_at)}</td>
                      <td className="px-3 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => generateInvoice(o.id)} className="p-1.5 rounded text-surface-500 hover:text-purple-400 hover:bg-surface-700" title="Invoice">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          </button>
                          <button onClick={() => handleDelete(o.id)} className="p-1.5 rounded text-surface-500 hover:text-red-400 hover:bg-surface-700" title="Delete">
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
              <svg className="w-12 h-12 mx-auto text-surface-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              <p className="text-surface-400 text-sm">{searchQuery || statusFilter ? 'No orders match filters' : 'No orders yet'}</p>
              {!searchQuery && !statusFilter && <button onClick={() => setShowForm(true)} className="mt-3 btn-primary text-sm">+ Create First Order</button>}
            </div>
          )}
        </div>

        <div className="card p-5">
          {selectedOrderFull ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-surface-100">Order Details</h3>
                <button onClick={() => { setSelectedOrder(null); setSelectedOrderFull(null); }} className="text-surface-500 hover:text-surface-300">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="space-y-3">
                <div className="bg-surface-700/30 rounded-lg p-3">
                  <p className="text-[10px] text-surface-500 uppercase">Institution</p>
                  <p className="text-surface-200 font-medium">{selectedOrderFull.institution_name || 'Unknown'}</p>
                  <p className="text-xs text-surface-400">{selectedOrderFull.contact_phone || ''}</p>
                </div>
                <div className="bg-surface-700/30 rounded-lg p-3">
                  <p className="text-[10px] text-surface-500 uppercase">Workflow</p>
                  <span className={'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border mt-1 ' + (WORKFLOW_COLORS[selectedOrderFull.workflow_stage] || 'bg-surface-700 text-surface-400 border-surface-600')}>
                    {(WORKFLOW_STAGES.find(s => s.id === selectedOrderFull.workflow_stage)?.label || selectedOrderFull.workflow_stage || '').replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="bg-surface-700/30 rounded-lg p-3">
                  <p className="text-[10px] text-surface-500 uppercase">Amount</p>
                  <p className="text-lg font-bold text-cyan-400">{fmtCurrency(selectedOrderFull.total_amount)}</p>
                </div>
                {selectedOrderFull.delivery_date && (
                  <div className="bg-surface-700/30 rounded-lg p-3">
                    <p className="text-[10px] text-surface-500 uppercase">Delivery Date</p>
                    <p className="text-surface-200">{fmtDate(selectedOrderFull.delivery_date)}</p>
                  </div>
                )}
                {selectedOrderFull.notes && (
                  <div className="bg-surface-700/30 rounded-lg p-3">
                    <p className="text-[10px] text-surface-500 uppercase">Notes</p>
                    <p className="text-xs text-surface-300">{selectedOrderFull.notes}</p>
                  </div>
                )}

                {/* Workflow history */}
                {selectedOrderFull.workflow_events?.length > 0 && (
                  <div className="pt-3 border-t border-surface-700/30">
                    <p className="text-[10px] text-surface-500 uppercase mb-3">Workflow History</p>
                    <div className="space-y-2">
                      {selectedOrderFull.workflow_events.map((ev, i) => (
                        <div key={ev.id} className="flex gap-2">
                          <div className="flex flex-col items-center">
                            <div className={'w-2.5 h-2.5 rounded-full ' + (i === selectedOrderFull.workflow_events.length - 1 ? 'bg-cyan-500' : 'bg-surface-600')} />
                            {i < selectedOrderFull.workflow_events.length - 1 && <div className="w-px flex-1 bg-surface-700 my-0.5" />}
                          </div>
                          <div className="flex-1 pb-2">
                            <p className="text-xs text-surface-200 font-medium">{ev.action}</p>
                            <p className="text-[10px] text-surface-500">
                              {ev.from_stage ? ev.from_stage.replace(/_/g, ' ') + ' \u2192 ' : ''}{ev.to_stage.replace(/_/g, ' ')}
                              <span className="ml-1">\u00b7 {ev.performed_by}</span>
                            </p>
                            <p className="text-[10px] text-surface-600">{fmtDate(ev.created_at)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Workflow advancement buttons */}
                {selectedOrderFull.workflow_stage && selectedOrderFull.workflow_stage !== 'delivered' && selectedOrderFull.workflow_stage !== 'cancelled' && (
                  <div className="pt-3 border-t border-surface-700/30 space-y-2">
                    <p className="text-[10px] text-surface-500 uppercase">Advance Workflow</p>
                    {getNextStages(selectedOrderFull.workflow_stage).map(stageId => {
                      const stage = WORKFLOW_STAGES.find(s => s.id === stageId);
                      return stage ? (
                        <button key={stageId} onClick={() => handleAdvanceWorkflow(stageId)} disabled={!!advancingStage}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border bg-cyan-500/10 text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/20 transition-all disabled:opacity-50">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stage.icon} /></svg>
                          {stage.label}
                        </button>
                      ) : null;
                    })}
                    <button onClick={() => handleAdvanceWorkflow('cancelled')} disabled={!!advancingStage}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-50">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      Cancel Order
                    </button>
                  </div>
                )}

                <div className="pt-3 border-t border-surface-700/30">
                  <button onClick={() => generateInvoice(selectedOrderFull.id)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20 transition-all">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    View / Download Invoice
                  </button>
                </div>
              </div>
            </div>
          ) : showForm ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-surface-100">Create Order</h3>
                <button type="button" onClick={() => setShowForm(false)} className="text-surface-500 hover:text-surface-300">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Institution *</label>
                <select value={formData.institution_id} onChange={e => setFormData(p => ({ ...p, institution_id: e.target.value }))} required className="w-full bg-surface-700 text-surface-200 rounded-lg px-3 py-2 text-sm border border-surface-600 focus:border-cyan-500 outline-none">
                  <option value="">Select institution...</option>
                  {institutions.map(inst => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Recommendation (optional)</label>
                <select value={formData.recommendation_id} onChange={e => setFormData(p => ({ ...p, recommendation_id: e.target.value }))} className="w-full bg-surface-700 text-surface-200 rounded-lg px-3 py-2 text-sm border border-surface-600 focus:border-cyan-500 outline-none">
                  <option value="">No recommendation...</option>
                  {recommendations.map(r => <option key={r.id} value={r.id}>Rec #{r.id.slice(0,8)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Total Amount (Rs)</label>
                <input type="number" value={formData.total_amount} onChange={e => setFormData(p => ({ ...p, total_amount: e.target.value }))} className="w-full bg-surface-700 text-surface-200 rounded-lg px-3 py-2 text-sm border border-surface-600 focus:border-cyan-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Delivery Date</label>
                <input type="date" value={formData.delivery_date} onChange={e => setFormData(p => ({ ...p, delivery_date: e.target.value }))} className="w-full bg-surface-700 text-surface-200 rounded-lg px-3 py-2 text-sm border border-surface-600 focus:border-cyan-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Notes</label>
                <textarea value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} className="w-full bg-surface-700 text-surface-200 rounded-lg px-3 py-2 text-sm border border-surface-600 focus:border-cyan-500 outline-none" rows={3} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary text-sm bg-cyan-500 hover:bg-cyan-400 text-surface-900">Create Order</button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-surface-400 bg-surface-700 hover:bg-surface-600">Cancel</button>
              </div>
            </form>
          ) : (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-surface-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              <p className="text-surface-400 text-sm">Select an order or create a new one</p>
            </div>
          )}
        </div>
      </div>

      {/* Invoice Modal */}
      {showInvoiceModal && invoiceData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => { setShowInvoiceModal(false); setInvoiceData(null); }}>
          <div className="absolute inset-0 bg-surface-900/80 backdrop-blur-sm" />
          <div className="relative bg-surface-800 border border-surface-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-surface-700/50">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <h2 className="text-lg font-semibold text-surface-100">Invoice {invoiceData.invoiceNumber}</h2>
                <span className="badge bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px]">{invoiceData.workflow_stage.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={downloadInvoicePdf} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Download PDF
                </button>
                <button onClick={() => { setShowInvoiceModal(false); setInvoiceData(null); }} className="text-surface-500 hover:text-surface-300">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {invoiceBlobUrl && (
                <iframe src={invoiceBlobUrl} className="w-full h-full min-h-[500px] rounded-lg border border-surface-700 bg-white" title="Invoice Preview" />
              )}
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} onDismiss={() => { setToast(null); if (toast?.undo) deletedItemRef.current = null; }} />
    </div>
  );
}
