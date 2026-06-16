import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { api, formatCurrency } from '../services/api';
import ProductCard from '../components/ProductCard';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import html2pdf from 'html2pdf.js';
import { sendReportToEmail, isEmailJSConfigured } from '../services/emailService';

export default function Recommendations() {
  const { id } = useParams();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedProductId, setCopiedProductId] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [toast, setToast] = useState(null);
  const emailProcessedRef = useRef(false);
  const contentRef = useRef(null);

  // Handle email result from location state (passed from RequirementForm)
  useEffect(() => {
    const emailResult = location.state?.emailResult;
    if (!emailResult || emailProcessedRef.current) return;
    emailProcessedRef.current = true;

    if (emailResult.skipped) return;

    if (emailResult.success) {
      setToast({ type: 'success', message: 'Confirmation email sent successfully to your inbox!' });
    } else if (emailResult.timedOut) {
      setToast({ type: 'warning', message: 'Email is being sent in the background. Check your inbox shortly.' });
    } else {
      setToast({ type: 'error', message: `Failed to send email: ${emailResult.error}` });
    }

    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [location.state]);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  useEffect(() => {
    fetchRecommendation();
  }, [id]);

  const fetchRecommendation = async () => {
    try {
      setLoading(true);
      const response = await api.getRecommendation(id);
      setData(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyQuotation = (item) => {
    const text = `${item.product_name} - ${item.quantity_estimate} ${item.unit} @ Rs ${item.unit_price}/${item.unit} = Rs ${item.monthly_cost?.toLocaleString('en-IN')}/month`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedProductId(item.id || item.product_name);
      setTimeout(() => setCopiedProductId(null), 2000);
    });
  };

  // Emoji to SVG map for professional PDF rendering
  const emojiSvgMap = {
    '🌿': '<svg viewBox="0 0 20 20" width="16" height="16" style="display:inline;vertical-align:middle;margin-right:2px"><path fill="#10b981" d="M10 2C6 2 2 6 2 10s4 8 8 8 8-4 8-8-4-8-8-8z"/><path fill="#34d399" d="M10 5l-2 5 5-2-5-2z"/></svg>',
    '🚫': '<svg viewBox="0 0 20 20" width="16" height="16" style="display:inline;vertical-align:middle;margin-right:2px"><circle cx="10" cy="10" r="8" fill="none" stroke="#ef4444" stroke-width="1.5"/><path stroke="#ef4444" stroke-width="1.5" d="M6 6l8 8"/></svg>',
    '🛡️': '<svg viewBox="0 0 20 20" width="16" height="16" style="display:inline;vertical-align:middle;margin-right:2px"><path fill="#6366f1" d="M10 2L3 5v5c0 4.4 3 8.5 7 9 4-.5 7-4.6 7-9V5l-7-3z"/></svg>',
    '⚡': '<svg viewBox="0 0 20 20" width="16" height="16" style="display:inline;vertical-align:middle;margin-right:2px"><path fill="#f59e0b" d="M11.5 2L5 11h4l-1.5 7L14 9h-4l1.5-7z"/></svg>',
    '💧': '<svg viewBox="0 0 20 20" width="16" height="16" style="display:inline;vertical-align:middle;margin-right:2px"><path fill="#38bdf8" d="M10 2C7 6 5 9.5 5 12c0 2.8 2.2 5 5 5s5-2.2 5-5c0-2.5-2-6-5-10z"/></svg>',
    '🏭': '<svg viewBox="0 0 20 20" width="16" height="16" style="display:inline;vertical-align:middle;margin-right:2px"><path fill="#78716c" d="M3 18V8l4 3V8l4 3V8l4 3v7H3z"/><rect fill="#a8a29e" x="5" y="13" width="2" height="3" rx="0.5"/><rect fill="#a8a29e" x="9" y="13" width="2" height="3" rx="0.5"/><rect fill="#a8a29e" x="13" y="13" width="2" height="3" rx="0.5"/><path fill="#57534e" d="M2 18h16v1H2z"/></svg>',
    '✅': '<svg viewBox="0 0 20 20" width="16" height="16" style="display:inline;vertical-align:middle;margin-right:2px"><circle cx="10" cy="10" r="8" fill="#10b981"/><path fill="#fff" d="M7 10.5l2 2 4-4"/></svg>',
    '🪣': '<svg viewBox="0 0 20 20" width="16" height="16" style="display:inline;vertical-align:middle;margin-right:2px"><path fill="#60a5fa" d="M4 12l2 6h8l2-6H4z"/><rect fill="#94a3b8" x="8" y="3" width="4" height="4" rx="1"/></svg>',
    '⚠': '<svg viewBox="0 0 20 20" width="16" height="16" style="display:inline;vertical-align:middle;margin-right:2px"><path fill="#f59e0b" d="M10 2L1 18h18L10 2z"/><path fill="#f59e0b" d="M10 8c-.6 0-1 .4-1 1v3c0 .6.4 1 1 1s1-.4 1-1V9c0-.6-.4-1-1-1z"/></svg>',
    '✓': '<svg viewBox="0 0 16 16" width="14" height="14" style="display:inline;vertical-align:middle;margin-right:1px"><path fill="#10b981" d="M6 10.5l-2.5-2.5L2 9.5 6 13.5 14 5.5 12.5 4z"/></svg>',
  };

  // Replace emoji in visible DOM temporarily, generate PDF, then restore
  const handleDownloadPDF = async () => {
    if (!contentRef.current || downloading) return;
    setDownloading(true);
    const restored = [];
    try {
      // Walk text nodes and replace emoji with SVGs directly in the visible DOM
      const walker = document.createTreeWalker(contentRef.current, NodeFilter.SHOW_TEXT, null, false);
      while (walker.nextNode()) {
        const textNode = walker.currentNode;
        let text = textNode.textContent;
        let modified = false;
        for (const [emoji, svgHtml] of Object.entries(emojiSvgMap)) {
          if (text.includes(emoji)) {
            text = text.split(emoji).join(svgHtml);
            modified = true;
          }
        }
        if (modified) {
          const span = document.createElement('span');
          span.innerHTML = text;
          restored.push({ parent: textNode.parentNode, nextSibling: textNode.nextSibling, oldNode: textNode });
          textNode.parentNode.replaceChild(span, textNode);
        }
      }

      const fileName = `quotation-${(data.institution_name || 'recommendation').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.pdf`;
      const opt = {
        margin: [8, 8, 8, 8],
        filename: fileName,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          letterRendering: true,
          backgroundColor: '#0f172a',
          width: contentRef.current.scrollWidth,
          windowWidth: contentRef.current.scrollWidth,
          logging: false
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: 'avoid-all' }
      };
      await html2pdf().set(opt).from(contentRef.current).save();
      setToast({ type: 'success', message: 'PDF downloaded successfully!' });
      setTimeout(() => setToast(null), 5000);
    } catch (err) {
      console.error('PDF generation failed:', err);
      setToast({ type: 'error', message: 'Failed to generate PDF. Please try again.' });
      setTimeout(() => setToast(null), 5000);
    } finally {
      // Restore all original text nodes
      for (const { parent, nextSibling, oldNode } of restored) {
        if (nextSibling) {
          parent.insertBefore(oldNode, nextSibling);
        } else {
          parent.appendChild(oldNode);
        }
      }
      setDownloading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailAddress || !emailAddress.includes('@') || sendingEmail) return;
    setSendingEmail(true);
    try {
      const result = await sendReportToEmail(
        emailAddress,
        data.institution_name || 'Valued Customer',
        {
          items: data.items,
          total_estimated_cost: data.total_estimated_cost,
          summary: data.summary,
          alerts: data.alerts || [],
          institution_name: data.institution_name,
          institution_type: data.institution_type
        }
      );
      if (result.success) {
        setToast({ type: 'success', message: 'Quotation emailed successfully to ' + emailAddress });
        setShowEmailModal(false);
        setEmailAddress('');
      } else {
        setToast({ type: 'error', message: 'Failed to send email: ' + (result.error || 'Unknown error') });
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to send email: ' + (err.message || 'Unknown error') });
    } finally {
      setSendingEmail(false);
      setTimeout(() => setToast(null), 6000);
    }
  };

  const handleCopyAll = () => {
    if (!data?.items) return;
    const text = data.items.map(item =>
      `${item.product_name} | Qty: ${item.quantity_estimate} ${item.unit} | Price: Rs ${item.unit_price} | Monthly: Rs ${item.monthly_cost?.toLocaleString('en-IN')} | ${item.dilution_ratio}`
    ).join('\n');
    
    const fullText = `QUOTATION - ${data.institution_name}\n${'='.repeat(40)}\n${text}\n${'='.repeat(40)}\nTotal Monthly Cost: ${formatCurrency(data.total_estimated_cost)}\n`;
    
    navigator.clipboard.writeText(fullText).then(() => {
      setCopiedProductId('all');
      setTimeout(() => setCopiedProductId(null), 2000);
    });
  };

  if (loading) return <LoadingState message="Loading recommendations..." />;
  if (error) return <ErrorState message={error} onRetry={fetchRecommendation} />;
  if (!data) return <ErrorState message="No recommendation data found" />;

  return (
    <>
      {/* Email Toast Notification (outside contentRef so it doesn't appear in PDF) */}
      {toast && (
        <div className={`fixed top-20 right-4 sm:right-6 z-50 max-w-sm animate-slide-in-right transition-all duration-300 ${
          toast ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
        }`}>
          <div className={`rounded-xl p-4 shadow-2xl border flex items-start gap-3 ${
            toast.type === 'success'
              ? 'bg-emerald-900/95 border-emerald-500/30 text-emerald-200'
              : toast.type === 'warning'
                ? 'bg-amber-900/95 border-amber-500/30 text-amber-200'
                : 'bg-red-900/95 border-red-500/30 text-red-200'
          }`}>
            <div className="flex-shrink-0 mt-0.5">
              {toast.type === 'success' ? (
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : toast.type === 'warning' ? (
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {toast.type === 'success' ? 'Email Sent' : toast.type === 'warning' ? 'Sending Email' : 'Email Failed'}
              </p>
              <p className="text-xs mt-1 opacity-80">{toast.message}</p>
            </div>
            <button onClick={dismissToast} className="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Header & action buttons - OUTSIDE contentRef so they don't appear in PDF */}
      <div className="animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <Link to="/dashboard" className="text-sm text-cyan-400 hover:text-cyan-300 mb-1 inline-block transition-colors">
              &larr; Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-surface-100">Product Recommendations</h1>
            <p className="text-surface-400 mt-1">For <span className="text-surface-200 font-medium">{data.institution_name}</span></p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowEmailModal(true)} className="btn-accent text-sm">
              <svg className="w-4 h-4 inline mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email Report
            </button>
            <button onClick={handleDownloadPDF} disabled={downloading} className="btn-primary text-sm">
              <svg className="w-4 h-4 inline mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={downloading ? 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' : 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'} />
              </svg>
              {downloading ? 'Generating PDF...' : 'Download PDF'}
            </button>
            <button onClick={handleCopyAll} className="btn-secondary text-sm">
              <svg className="w-4 h-4 inline mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={copiedProductId === 'all' ? 'M5 13l4 4L19 7' : 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'} />
              </svg>
              {copiedProductId === 'all' ? 'Copied!' : 'Copy Quotation'}
            </button>
          </div>
        </div>
      </div>

      {/* Email Modal Dialog - OUTSIDE contentRef */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowEmailModal(false)} onKeyDown={e => { if (e.key === 'Escape') setShowEmailModal(false); }} tabIndex={-1}>
          <div className="absolute inset-0 bg-surface-900/80 backdrop-blur-sm" />
          <div className="relative bg-surface-800 border border-surface-700 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-surface-100">Email Quotation</h3>
              <button onClick={() => setShowEmailModal(false)} className="p-1.5 rounded-lg hover:bg-surface-700 transition-colors">
                <svg className="w-5 h-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {!isEmailJSConfigured() ? (
              <div className="space-y-4">
                <div className="p-4 bg-surface-700/30 rounded-xl border border-surface-600/50">
                  <p className="text-sm text-surface-400">
                    Email reporting is not available at the moment.
                  </p>
                </div>
                <div className="flex justify-end">
                  <button onClick={() => setShowEmailModal(false)} className="btn-secondary text-sm">
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-surface-400">
                  Send the full quotation with product recommendations and cost summary to:
                </p>
                <div>
                  <label className="block text-xs font-medium text-surface-400 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    value={emailAddress}
                    onChange={e => setEmailAddress(e.target.value)}
                    placeholder="recipient@example.com"
                    autoFocus
                    className="w-full px-4 py-2.5 bg-surface-700 border border-surface-600 rounded-xl text-surface-100 placeholder-surface-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-colors text-sm"
                    onKeyDown={e => { if (e.key === 'Enter' && emailAddress.includes('@') && !sendingEmail) handleSendEmail(); }}
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <button onClick={() => setShowEmailModal(false)} className="btn-secondary text-sm">
                    Cancel
                  </button>
                  <button
                    onClick={handleSendEmail}
                    disabled={!emailAddress.includes('@') || sendingEmail}
                    className="btn-accent text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingEmail ? (
                      <>
                        <svg className="animate-spin w-4 h-4 inline mr-1.5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Sending...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 inline mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Send Email
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Report content wrapped for PDF capture - no nav/buttons here */}
      <div className="animate-fade-in" ref={contentRef}>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card p-5 animate-slide-up" style={{ animationDelay: '0ms' }}>
          <p className="text-[11px] text-surface-400 uppercase tracking-wider">Facility Type</p>
          <p className="text-lg font-semibold text-surface-100 mt-2 capitalize">{data.institution_type}</p>
          <p className="text-xs text-surface-500 mt-1">{data.area_size?.toLocaleString()} sq. ft.</p>
        </div>
        <div className="card p-5 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <p className="text-[11px] text-surface-400 uppercase tracking-wider">Hygiene Level</p>
          <p className="text-lg font-semibold text-surface-100 mt-2 capitalize">{data.hygiene_level || data.hygiene_standard || 'Standard'}</p>
          <p className="text-xs text-surface-500 mt-1">Required standard</p>
        </div>
        <div className="card p-5 animate-slide-up" style={{ animationDelay: '200ms' }}>
          <p className="text-[11px] text-surface-400 uppercase tracking-wider">Budget Level</p>
          <p className="text-lg font-semibold text-surface-100 mt-2 capitalize">{data.budget_level || data.budget || 'Medium'}</p>
          <p className="text-xs text-surface-500 mt-1">Budget tier</p>
        </div>
        <div className="card-accent p-5 animate-slide-up" style={{ animationDelay: '300ms' }}>
          <p className="text-[11px] text-cyan-400 uppercase tracking-wider font-medium">Monthly Est. Cost</p>
          <p className="text-xl font-bold text-emerald-400 mt-2">{formatCurrency(data.total_estimated_cost)}</p>
          <p className="text-xs text-surface-500 mt-1">Total estimated monthly spend</p>
        </div>
      </div>

      {/* Facility Profile - derived from metadata */}
      {data.metadata && (
        <div className="card p-6 mb-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-surface-100">Facility Profile</h2>
              <p className="text-sm text-surface-400">Characteristics used for recommendation scoring</p>
            </div>
          </div>

          {/* Profile stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
            {data.metadata.floors > 0 && (
              <div className="bg-surface-700/30 rounded-xl p-3 border border-surface-600/50 text-center">
                <p className="text-xl font-bold text-surface-100">{data.metadata.floors}</p>
                <p className="text-[10px] text-surface-400 uppercase tracking-wider mt-1">Floors</p>
              </div>
            )}
            {data.metadata.occupants > 0 && (
              <div className="bg-surface-700/30 rounded-xl p-3 border border-surface-600/50 text-center">
                <p className="text-xl font-bold text-surface-100">{data.metadata.occupants}+</p>
                <p className="text-[10px] text-surface-400 uppercase tracking-wider mt-1">Occupants</p>
              </div>
            )}
            {data.metadata.operating_hours && (
              <div className="bg-surface-700/30 rounded-xl p-3 border border-surface-600/50 text-center">
                <p className="text-sm font-bold text-surface-100">{{
                  day: 'Day', night: 'Night', '24x7': '24x7', business: '9-5'
                }[data.metadata.operating_hours] || data.metadata.operating_hours}</p>
                <p className="text-[10px] text-surface-400 uppercase tracking-wider mt-1">Hours</p>
              </div>
            )}
            {data.metadata.cleaning_frequency && (
              <div className="bg-surface-700/30 rounded-xl p-3 border border-surface-600/50 text-center">
                <p className="text-sm font-bold text-surface-100 capitalize">{{
                  daily: 'Daily', twice_daily: '2x Day', weekly: 'Weekly',
                  multiple_weekly: 'Multi/Wk', custom: 'As Needed'
                }[data.metadata.cleaning_frequency] || data.metadata.cleaning_frequency}</p>
                <p className="text-[10px] text-surface-400 uppercase tracking-wider mt-1">Cleaning</p>
              </div>
            )}
            {data.metadata.facility_age && (
              <div className="bg-surface-700/30 rounded-xl p-3 border border-surface-600/50 text-center">
                <p className="text-sm font-bold text-surface-100 capitalize">{{
                  new: '0-5 yrs', moderate: '5-15 yrs', old: '15-30 yrs', vintage: '30+ yrs'
                }[data.metadata.facility_age] || data.metadata.facility_age}</p>
                <p className="text-[10px] text-surface-400 uppercase tracking-wider mt-1">Age</p>
              </div>
            )}
          </div>

          {/* Equipment badges */}
          {data.metadata.equipment?.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-1.5">Equipment Available</p>
              <div className="flex flex-wrap gap-1.5">
                {data.metadata.equipment.map(eq => (
                  <span key={eq} className="badge bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px]">
                    {{
                      mop: 'Mop & Bucket', vacuum: 'Vacuum Cleaner', scrubber: 'Floor Scrubber',
                      pressure_washer: 'Pressure Washer', steam_cleaner: 'Steam Cleaner',
                      carpet_extractor: 'Carpet Extractor', microfiber: 'Microfiber Cloths',
                      auto_dispenser: 'Auto Dispenser'
                    }[eq] || eq}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Preferences + Certifications badges */}
          <div className="flex flex-wrap gap-4">
            {data.metadata.preferences?.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-1.5">Preferences</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.metadata.preferences.map(p => (
                    <span key={p} className="badge bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[11px]">
                      {{
                        eco_friendly: '🌿 Eco-Friendly', fragrance_free: '🚫 Fragrance-Free',
                        hypoallergenic: '🛡️ Hypoallergenic', concentrated: '⚡ Concentrated',
                        ready_to_use: '💧 Ready-to-Use', industrial_grade: '🏭 Industrial'
                      }[p] || p}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {data.metadata.certifications?.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-1.5">Certifications</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.metadata.certifications.map(c => (
                    <span key={c} className="badge bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[11px]">
                      {{
                        iso_9001: 'ISO 9001', iso_14001: 'ISO 14001', haccp: 'HACCP',
                        gmp: 'GMP', osha: 'OSHA Compliant', green_seal: 'Green Seal'
                      }[c] || c}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Special Requirements */}
          {data.metadata.special_requirements && (
            <div className="mt-3 bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
              <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-1">Special Requirements</p>
              <p className="text-sm text-amber-300">{data.metadata.special_requirements}</p>
            </div>
          )}
        </div>
      )}

      {/* Financial Status Alert */}
      {data.financialStatusAlert && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl animate-fade-in">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-amber-300">{data.financialStatusAlert}</p>
          </div>
        </div>
      )}

      {/* Alerts */}
      {data.alerts?.length > 0 && (
        <div className="mb-6 space-y-2">
          {data.alerts.map((alert, i) => (
            <div key={i} className="flex items-start p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <svg className="w-5 h-5 text-amber-400 mt-0.5 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm text-amber-300">{alert}</p>
            </div>
          ))}
        </div>
      )}

      {/* Summary & Engine Source Badge */}
      {data.summary && (
        <div className="mb-6 p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm text-cyan-300">{data.summary}</p>
            </div>
            <span className={`flex-shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
              (data.engine_source || data.recommendation?.source) === 'AI_Engine'
                ? 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}>
              {(data.engine_source || data.recommendation?.source) === 'AI_Engine' ? (
                <><span className="inline-block w-1.5 h-1.5 bg-fuchsia-400 rounded-full animate-pulse mr-1.5"></span>AI Powered</>
              ) : (
                <><span className="inline-block w-1.5 h-1.5 bg-amber-400 rounded-full mr-1.5"></span>Rule Engine</>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Products */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          Recommended Products
          <span className="text-sm font-normal text-surface-400">({data.items?.length || 0} items)</span>
        </h2>
        <div className="space-y-4">
          {data.items?.map((item, i) => (
            <div key={item.id || i} style={{ animationDelay: `${i * 100}ms` }}>
              <ProductCard key={item.id || i} item={item} onCopyQuotation={handleCopyQuotation} copiedProductId={copiedProductId} />
            </div>
          ))}
        </div>
      </div>

      {/* Summary Table */}
      <div className="card p-6">
        <h3 className="font-semibold text-surface-100 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Monthly Estimate Summary
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-700">
                <th className="text-left py-3 px-3 text-surface-400 font-medium text-xs uppercase tracking-wider">Product</th>
                <th className="text-left py-3 px-3 text-surface-400 font-medium text-xs uppercase tracking-wider">Dilution / Water</th>
                <th className="text-right py-3 px-3 text-surface-400 font-medium text-xs uppercase tracking-wider">Qty/Month</th>
                <th className="text-right py-3 px-3 text-surface-400 font-medium text-xs uppercase tracking-wider">Unit Price</th>
                <th className="text-right py-3 px-3 text-surface-400 font-medium text-xs uppercase tracking-wider">Cost/Month</th>
              </tr>
            </thead>
            <tbody>
              {data.items?.map((item, i) => {
                const needsWater = item.dilution_ratio && 
                  !item.dilution_ratio.toLowerCase().includes('ready to use') && 
                  !item.dilution_ratio.toLowerCase().includes('no water');
                return (
                  <tr key={item.id || i} className="border-b border-surface-700/50 last:border-0 hover:bg-surface-700/30 transition-colors">
                    <td className="py-3 px-3">
                      <span className="font-medium text-surface-200">{item.product_name}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`text-xs font-mono ${needsWater ? 'text-blue-400' : 'text-surface-400'}`}>
                        {needsWater ? '💧 ' : '✓ '}
                        {item.dilution_ratio || '-'}
                      </span>
                    </td>
                    <td className="text-right py-3 px-3 text-surface-300 whitespace-nowrap">{item.quantity_estimate} {item.unit || 'units'}</td>
                    <td className="text-right py-3 px-3 text-surface-300">Rs {item.unit_price || item.base_price || 0}</td>
                    <td className="text-right py-3 px-3 text-surface-100 font-semibold whitespace-nowrap">Rs {Number(item.monthly_cost || 0).toLocaleString('en-IN')}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-surface-600">
                <td className="py-3 px-3 font-semibold text-surface-200" colSpan="2">Total Monthly Estimate</td>
                <td className="text-right py-3 px-3 font-semibold text-surface-200">{data.monthly_total_quantity || 0} {data.items?.[0]?.unit || 'units'}</td>
                <td className="text-right py-3 px-3"></td>
                <td className="text-right py-3 px-3 font-bold text-emerald-400">{formatCurrency(data.total_estimated_cost)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Water Consumption Summary */}
        {data.items?.some(item => item.dilution_ratio && 
          !item.dilution_ratio.toLowerCase().includes('ready to use') && 
          !item.dilution_ratio.toLowerCase().includes('no water')
        ) && (
          <div className="mt-5 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-blue-300">💧 Water Usage Notice</p>
                <p className="text-xs text-blue-200/70 mt-1">
                  Some recommended products require water for dilution. Follow the specified dilution ratio for each product above. 
                  For concentrates, mix the indicated amount of product with water before use. Ready-to-use (RTU) products require no additional water.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
