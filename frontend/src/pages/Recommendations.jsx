import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, formatCurrency } from '../services/api';
import ProductCard from '../components/ProductCard';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { sendReportToEmail, isEmailJSConfigured } from '../services/emailService';


export default function Recommendations() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedProductId, setCopiedProductId] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [toast, setToast] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const contentRef = useRef(null);

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
    const price = item.unit_price || item.base_price || 0;
    const text = `${item.product_name} - ${item.quantity_estimate} ${item.unit || 'litre'} @ Rs ${price}/${item.unit || 'litre'} = Rs ${item.monthly_cost?.toLocaleString('en-IN')}/month`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedProductId(item.id || item.product_name);
      setTimeout(() => setCopiedProductId(null), 2000);
    });
  };

  const handleDownloadPDF = async () => {
    if (!contentRef.current || downloading) return;
    setDownloading(true);
    let pdfContainer = null;
    try {
      const escapeHtml = (str) => String(str).replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
      const instName = data.institution_name || 'Recommendation';
      const items = data.items || [];

      const rowsHtml = items.map((item, i) => {
        const unitPrice = item.unit_price || item.base_price || 0;
        const monthlyCost = Number(item.monthly_cost || 0);
        const dilution = item.dilution_ratio || '-';
        return `<tr style="${i % 2 === 0 ? 'background-color: #ffffff;' : 'background-color: #f0fdfa;'}">
          <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:11px;color:#475569;">${i + 1}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#1e293b;font-weight:500;">${escapeHtml(item.product_name || 'Product')}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:11px;color:#475569;">${escapeHtml(item.category || '-')}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:11px;color:#475569;">${item.quantity_estimate || 0}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:11px;color:#475569;">${dilution}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:11px;color:#475569;">Rs ${Number(unitPrice).toLocaleString('en-IN')}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:11px;color:#059669;font-weight:600;">Rs ${monthlyCost.toLocaleString('en-IN')}</td>
        </tr>`;
      }).join('');

      const computedTotal = items.reduce((s, it) => s + Number(it.monthly_cost || 0), 0);
      const totalCost = computedTotal > 0 ? computedTotal : (data.total_estimated_cost || 0);

      const safeInstName = escapeHtml(instName);
      const safeSummary = data.summary ? escapeHtml(data.summary) : null;
      const safeFinancialAlert = data.financialStatusAlert ? escapeHtml(data.financialStatusAlert) : null;
      const safeInstType = escapeHtml((data.institution_type || '').replace(/_/g, ' '));

      // ── Label maps for facility profile fields ──
      const surfaceLabelsPdf = {
        hard_floor: 'Hard Floor', carpet: 'Carpet', glass: 'Glass / Windows',
        tile: 'Tile', stainless_steel: 'Stainless Steel', wood: 'Wood',
        marble: 'Marble', countertop: 'Countertop', porcelain: 'Porcelain', mirror: 'Mirror'
      };
      const prefLabelsPdf = {
        eco_friendly: 'Eco-Friendly', fragrance_free: 'Fragrance-Free',
        hypoallergenic: 'Hypoallergenic', concentrated: 'Concentrated',
        ready_to_use: 'Ready-to-Use', industrial_grade: 'Industrial Grade'
      };
      const equipLabelsPdf = {
        mop: 'Mop & Bucket', vacuum: 'Vacuum Cleaner', scrubber: 'Floor Scrubber',
        pressure_washer: 'Pressure Washer', steam_cleaner: 'Steam Cleaner',
        carpet_extractor: 'Carpet Extractor', microfiber: 'Microfiber Cloths',
        auto_dispenser: 'Auto Dispenser'
      };
      const freqLabelsPdf = {
        daily: 'Daily', twice_daily: 'Twice Daily', weekly: 'Weekly',
        multiple_weekly: 'Multiple/Week', custom: 'As Needed'
      };
      const hoursMapPdf = { day: 'Day (6AM-6PM)', night: 'Night (6PM-6AM)', '24x7': '24x7 Operation', business: 'Business Hours (9-5)' };
      const ageMapPdf = { new: 'New (0-5 yrs)', moderate: 'Moderate (5-15 yrs)', old: 'Old (15-30 yrs)', vintage: 'Vintage (30+ yrs)' };

      const metadata = data.metadata || {};
      const surfaceTypesArr = Array.isArray(data.surface_types)
        ? data.surface_types
        : (typeof data.surface_types === 'string' ? JSON.parse(data.surface_types) : []);
      const surfaceTypesStr = surfaceTypesArr.map(s => surfaceLabelsPdf[s] || s).join(', ') || 'N/A';
      const equipmentStr = (metadata.equipment || []).map(e => equipLabelsPdf[e] || e).join(', ') || 'None';
      const preferencesStr = (metadata.preferences || []).map(p => prefLabelsPdf[p] || p).join(', ') || 'None';
      const freqStr = freqLabelsPdf[metadata.cleaning_frequency] || metadata.cleaning_frequency || 'N/A';
      const hygieneStr = (data.hygiene_standard || '').replace(/_/g, ' ') || 'N/A';
      const budgetStr = data.budget || data.budget_level || 'N/A';
      const areaSizeStr = data.area_size ? Number(data.area_size).toLocaleString() : 'N/A';
      const opHoursStr = hoursMapPdf[metadata.operating_hours] || metadata.operating_hours || 'N/A';
      const ageStr = ageMapPdf[metadata.facility_age] || metadata.facility_age || 'N/A';

      // ── Product table (reusing rowsHtml from above) ──
      const productTableHtml = `
        <table style="width:100%;border-collapse:collapse;margin-top:12px;font-family:Arial,sans-serif;">
          <thead>
            <tr style="background:#0f766e;color:white;">
              <th style="padding:8px 6px;text-align:center;font-size:10px;font-weight:600;width:24px;">#</th>
              <th style="padding:8px 6px;text-align:left;font-size:10px;font-weight:600;">Product</th>
              <th style="padding:8px 6px;text-align:center;font-size:10px;font-weight:600;width:55px;">Category</th>
              <th style="padding:8px 6px;text-align:center;font-size:10px;font-weight:600;width:38px;">Qty</th>
              <th style="padding:8px 6px;text-align:center;font-size:10px;font-weight:600;width:65px;">Dilution</th>
              <th style="padding:8px 6px;text-align:right;font-size:10px;font-weight:600;width:65px;">Unit Price</th>
              <th style="padding:8px 6px;text-align:right;font-size:10px;font-weight:600;width:70px;">Monthly</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="7" style="text-align:center;padding:20px;color:#94a3b8;font-size:11px;">No products in this quotation.</td></tr>'}
          </tbody>
          <tfoot>
            <tr style="background:#f0fdfa;">
              <td colspan="4" style="padding:10px 8px;border-top:2px solid #0f766e;font-size:12px;font-weight:700;color:#0f172a;">Total Monthly Estimate (${items.length} product${items.length !== 1 ? 's' : ''})</td>
              <td style="padding:10px 8px;border-top:2px solid #0f766e;"></td>
              <td style="padding:10px 8px;border-top:2px solid #0f766e;"></td>
              <td style="padding:10px 8px;border-top:2px solid #0f766e;text-align:right;font-size:14px;font-weight:700;color:#059669;">Rs ${totalCost.toLocaleString('en-IN')}</td>
            </tr>
          </tfoot>
        </table>
      `;

      // ── Build email-template-matching HTML (all inline styles) ──
      const bodyHtml = `
        <div style="font-family:Arial,sans-serif;max-width:794px;margin:0 auto;padding:20px;color:#334155;">
          <!-- HEADER -->
          <div style="background:#0f766e;color:white;padding:24px;border-radius:8px 8px 0 0;">
            <h1 style="margin:0;font-size:24px;font-weight:800;">Ganga Maxx</h1>
            <p style="margin:6px 0 0;opacity:0.85;font-size:14px;">Cleaning Product Recommendations</p>
          </div>

          <!-- CONTENT -->
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:0;padding:24px;border-radius:0 0 8px 8px;">

            <!-- Contact Information -->
            <h2 style="font-size:16px;color:#0f172a;border-bottom:2px solid #0d9488;padding-bottom:8px;margin:0 0 14px 0;font-weight:700;">Contact Information</h2>
            <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
              <tr><td style="padding:6px 8px;color:#64748b;font-size:13px;">Name</td><td style="padding:6px 8px;font-weight:500;color:#1e293b;font-size:13px;">${escapeHtml(data.institution_name || 'N/A')}</td></tr>
              <tr><td style="padding:6px 8px;color:#64748b;font-size:13px;">Email</td><td style="padding:6px 8px;font-weight:500;color:#1e293b;font-size:13px;">${escapeHtml(data.contact_email || 'N/A')}</td></tr>
              <tr><td style="padding:6px 8px;color:#64748b;font-size:13px;">Phone</td><td style="padding:6px 8px;font-weight:500;color:#1e293b;font-size:13px;">${escapeHtml(data.contact_phone || 'N/A')}</td></tr>
              <tr><td style="padding:6px 8px;color:#64748b;font-size:13px;">Facility</td><td style="padding:6px 8px;font-weight:500;color:#1e293b;font-size:13px;">${escapeHtml(data.institution_name || 'N/A')}</td></tr>
              <tr><td style="padding:6px 8px;color:#64748b;font-size:13px;">Address</td><td style="padding:6px 8px;font-weight:500;color:#1e293b;font-size:13px;">${escapeHtml(data.address || 'N/A')}</td></tr>
            </table>

            <!-- Facility Profile -->
            <h2 style="font-size:16px;color:#0f172a;border-bottom:2px solid #0d9488;padding-bottom:8px;margin:18px 0 14px 0;font-weight:700;">Facility Profile</h2>
            <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
              <tr><td style="padding:6px 8px;color:#64748b;font-size:13px;">Type</td><td style="padding:6px 8px;font-weight:500;color:#1e293b;font-size:13px;text-transform:capitalize;">${escapeHtml((data.institution_type || '').replace(/_/g, ' ') || 'N/A')}</td></tr>
              <tr><td style="padding:6px 8px;color:#64748b;font-size:13px;">Area</td><td style="padding:6px 8px;font-weight:500;color:#1e293b;font-size:13px;">${areaSizeStr} sq. ft.</td></tr>
              <tr><td style="padding:6px 8px;color:#64748b;font-size:13px;">Budget</td><td style="padding:6px 8px;font-weight:500;color:#1e293b;font-size:13px;text-transform:capitalize;">${escapeHtml(budgetStr)}</td></tr>
              <tr><td style="padding:6px 8px;color:#64748b;font-size:13px;">Surfaces</td><td style="padding:6px 8px;font-weight:500;color:#1e293b;font-size:13px;">${escapeHtml(surfaceTypesStr)}</td></tr>
              <tr><td style="padding:6px 8px;color:#64748b;font-size:13px;">Hygiene</td><td style="padding:6px 8px;font-weight:500;color:#1e293b;font-size:13px;text-transform:capitalize;">${escapeHtml(hygieneStr)}</td></tr>
              <tr><td style="padding:6px 8px;color:#64748b;font-size:13px;">Frequency</td><td style="padding:6px 8px;font-weight:500;color:#1e293b;font-size:13px;">${escapeHtml(freqStr)}</td></tr>
              <tr><td style="padding:6px 8px;color:#64748b;font-size:13px;">Equipment</td><td style="padding:6px 8px;font-weight:500;color:#1e293b;font-size:13px;">${escapeHtml(equipmentStr)}</td></tr>
              <tr><td style="padding:6px 8px;color:#64748b;font-size:13px;">Preferences</td><td style="padding:6px 8px;font-weight:500;color:#1e293b;font-size:13px;">${escapeHtml(preferencesStr)}</td></tr>
              ${metadata.floors ? `<tr><td style="padding:6px 8px;color:#64748b;font-size:13px;">Floors</td><td style="padding:6px 8px;font-weight:500;color:#1e293b;font-size:13px;">${escapeHtml(String(metadata.floors))}</td></tr>` : ''}
              ${metadata.occupants ? `<tr><td style="padding:6px 8px;color:#64748b;font-size:13px;">Occupants</td><td style="padding:6px 8px;font-weight:500;color:#1e293b;font-size:13px;">${escapeHtml(String(metadata.occupants))}+</td></tr>` : ''}
              ${opHoursStr !== 'N/A' ? `<tr><td style="padding:6px 8px;color:#64748b;font-size:13px;">Operating Hours</td><td style="padding:6px 8px;font-weight:500;color:#1e293b;font-size:13px;">${escapeHtml(opHoursStr)}</td></tr>` : ''}
              ${ageStr !== 'N/A' ? `<tr><td style="padding:6px 8px;color:#64748b;font-size:13px;">Facility Age</td><td style="padding:6px 8px;font-weight:500;color:#1e293b;font-size:13px;">${escapeHtml(ageStr)}</td></tr>` : ''}
            </table>

            <!-- Recommendations / Summary -->
            <h2 style="font-size:16px;color:#0f172a;border-bottom:2px solid #0d9488;padding-bottom:8px;margin:18px 0 14px 0;font-weight:700;">Recommendations</h2>

            ${safeSummary ? `<p style="font-size:13px;color:#475569;line-height:1.5;margin:0 0 12px;">${safeSummary}</p>` : ''}

            <!-- Product Table -->
            ${productTableHtml}

            <p style="font-size:14px;font-weight:bold;color:#059669;margin:14px 0 4px;">Rs ${totalCost.toLocaleString('en-IN')}/month</p>
            <p style="font-size:12px;color:#64748b;margin:0 0 16px;">${items.length} product(s) recommended</p>

            <!-- Safety Alerts -->
            ${items.filter(item => item.alerts && Array.isArray(item.alerts) && item.alerts.length > 0).length > 0 ? `
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px;margin-top:12px;">
              <p style="font-size:13px;font-weight:600;color:#b91c1c;margin:0 0 6px;">⚠ Safety &amp; Handling Alerts</p>
              ${items.filter(item => item.alerts && Array.isArray(item.alerts) && item.alerts.length > 0).map(item => {
                const sn = escapeHtml(item.product_name || 'Product');
                const badges = item.alerts.map(a => `<span style="display:inline-block;padding:1px 6px;border-radius:2px;font-size:9px;font-weight:600;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;margin:1px 2px 1px 0;">${escapeHtml(a)}</span>`).join(' ');
                return `<div style="margin-bottom:4px;padding:4px 0;border-bottom:1px solid #fecaca;">
                  <div style="font-size:11px;font-weight:600;color:#991b1b;margin-bottom:2px;">${sn}</div>
                  <div>${badges}</div>
                </div>`;
              }).join('')}
              <div style="font-size:9px;color:#b91c1c;margin-top:4px;opacity:0.7;">Refer to product Safety Data Sheet (SDS) for complete safety information.</div>
            </div>` : ''}

            <!-- Financial Alert -->
            ${safeFinancialAlert ? `
            <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:12px;margin-top:12px;">
              <p style="font-size:13px;font-weight:600;color:#d97706;margin:0 0 4px;">Financial Notice</p>
              <p style="font-size:11px;color:#92400e;line-height:1.5;margin:0;">${safeFinancialAlert}</p>
            </div>` : ''}

            <!-- Footer -->
            <div style="text-align:center;padding-top:20px;margin-top:24px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;line-height:1.6;">
              <p style="margin:0;">Generated by <strong>Ganga Maxx</strong> &mdash; AI Institutional Cleaning Product Selector</p>
              <p style="margin:4px 0 0;">${new Date().toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>
      `;

      const fileName = `quotation-${instName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.pdf`;

      const { default: html2pdf } = await import('html2pdf.js');

      // Wrap the body HTML in a full page with explicit white background
      const fullHtml = `<div style="font-family:Arial,sans-serif;background:#ffffff;padding:0;margin:0;width:794px;">${bodyHtml}</div>`;

      // Create an off-screen container that html2canvas can properly render
      // CRITICAL: must NOT use z-index:-1 or opacity:0 — those break html2canvas capture
      pdfContainer = document.createElement('div');
      pdfContainer.id = 'pdf-export-container';
      pdfContainer.style.cssText = [
        'position:absolute',
        'left:-9999px',
        'top:0',
        'width:794px',
        'background:#ffffff',
        'color:#334155',
        'z-index:9999',
        'pointer-events:none',
        'overflow:visible'
      ].join(';');
      pdfContainer.innerHTML = fullHtml;
      document.body.appendChild(pdfContainer);

      // Wait for fonts and layout to fully render before capture
      await new Promise(resolve => setTimeout(resolve, 600));

      await html2pdf()
        .set({
          margin: [10, 8, 10, 8],
          filename: fileName,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            letterRendering: true,
            backgroundColor: '#ffffff',
            logging: false,
            windowWidth: 794,
            scrollX: 0,
            scrollY: 0
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] }
        })
        .from(pdfContainer)
        .save();
      setToast({ type: 'success', message: 'PDF downloaded successfully!' });
      setTimeout(() => setToast(null), 5000);
    } catch (err) {
      console.error('PDF generation failed:', err);
      setToast({ type: 'error', message: 'Failed to generate PDF. Please try again.' });
      setTimeout(() => setToast(null), 5000);
    } finally {
      // Clean up injected DOM elements
      if (pdfContainer && pdfContainer.parentNode) {
        pdfContainer.parentNode.removeChild(pdfContainer);
      }

      setDownloading(false);
    }
  };


  const handleSendEmail = async () => {
    if (!emailTo || emailSending || !data) return;
    setEmailSending(true);

    try {
      const reportData = {
        ...data,
        institution_name: data.institution_name,
        total_estimated_cost: data.total_estimated_cost,
        items: data.items,
        summary: data.summary,
        alerts: data.alerts,
      };

      const result = await sendReportToEmail(emailTo, data.institution_name || 'Valued Customer', reportData);

      if (result.success) {
        setToast({ type: 'success', message: `Report sent successfully to ${emailTo}` });
        setShowEmailModal(false);
        setEmailTo('');
      } else {
        setToast({ type: 'error', message: result.error || 'Failed to send email. Please try again.' });
      }
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to send email. Please try again.' });
    } finally {
      setEmailSending(false);
      setTimeout(() => setToast(null), 5000);
    }
  };

  const handleCopyAll = () => {
    if (!data?.items) return;
    const text = data.items.map(item =>
      `${item.product_name} | Qty: ${item.quantity_estimate} ${item.unit || 'litre'} | Price: Rs ${item.unit_price || item.base_price || 0} | Monthly: Rs ${item.monthly_cost?.toLocaleString('en-IN')} | ${item.dilution_ratio}`
    ).join('\n');
    
    // Compute total from items for reliability
    const computedTotal = data.items.reduce((sum, item) => sum + Number(item.monthly_cost || 0), 0);
    const totalCost = computedTotal > 0 ? computedTotal : data.total_estimated_cost;
    
    const fullText = `QUOTATION - ${data.institution_name}\n${'='.repeat(40)}\n${text}\n${'='.repeat(40)}\nTotal Monthly Cost: ${formatCurrency(totalCost)}\n`;
    
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
                {toast.type === 'success' ? 'Success' : toast.type === 'warning' ? 'Warning' : 'Error'}
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
            <button onClick={() => { setEmailTo(data?.contact_email || ''); setShowEmailModal(true); }} className="btn-secondary text-sm">
              <svg className="w-4 h-4 inline mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Send Email
            </button>
          </div>
        </div>
      </div>



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
      <div className="card p-4 sm:p-6">
        <h3 className="font-semibold text-surface-100 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Monthly Estimate Summary
        </h3>

        {/* ── Mobile Card View (visible below sm) ── */}
        <div className="block sm:hidden space-y-3 mb-4">
          {data.items?.map((item, i) => {
            const needsWater = item.dilution_ratio && 
              !item.dilution_ratio.toLowerCase().includes('ready to use') && 
              !item.dilution_ratio.toLowerCase().includes('no water');
            return (
              <div key={item.id || i} className="bg-surface-700/30 rounded-xl p-4 border border-surface-600/50 space-y-2">
                <div className="flex justify-between items-start">
                  <span className="font-medium text-surface-200 text-sm leading-tight flex-1 mr-2">{item.product_name}</span>
                  <span className="text-xs font-semibold text-emerald-400 whitespace-nowrap">Rs {Number(item.monthly_cost || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <div>
                    <span className="text-surface-500">Qty/Month</span>
                    <p className="text-surface-300 font-medium">{item.quantity_estimate} {item.unit || 'units'}</p>
                  </div>
                  <div>
                    <span className="text-surface-500">Unit Price</span>
                    <p className="text-surface-300 font-medium">Rs {item.unit_price || item.base_price || 0}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-surface-500">Dilution</span>
                    <p className={`font-mono mt-0.5 ${needsWater ? 'text-blue-400' : 'text-surface-400'}`}>
                      {needsWater ? '💧 ' : '✓ '}{item.dilution_ratio || '-'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
          {/* Mobile total */}
          <div className="bg-surface-700/50 rounded-xl p-4 border border-emerald-500/20">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-surface-200">Total Monthly Estimate</span>
              <span className="text-lg font-bold text-emerald-400">{formatCurrency(data.items?.reduce((sum, item) => sum + Number(item.monthly_cost || 0), 0) || data.total_estimated_cost)}</span>
            </div>
            <p className="text-xs text-surface-500 mt-1">{data.items?.length || 0} product{(data.items?.length || 0) !== 1 ? 's' : ''} &middot; {data.monthly_total_quantity || 0} {data.items?.[0]?.unit || 'units'}</p>
          </div>
        </div>

        {/* ── Desktop Table View (visible sm and up) ── */}
        <div className="hidden sm:block overflow-x-auto">
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
                <td className="text-right py-3 px-3 font-bold text-emerald-400">{formatCurrency(data.items?.reduce((sum, item) => sum + Number(item.monthly_cost || 0), 0) || data.total_estimated_cost)}</td>
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
        )}      </div>

      {/* ── Send Email Modal ────────────────────────────────────── */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => { if (!emailSending) setShowEmailModal(false); }}>
          <div className="absolute inset-0 bg-surface-900/80 backdrop-blur-sm" />
          <div className="relative bg-surface-800 border border-surface-700 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-surface-100">Send Report via Email</h3>
                <p className="text-sm text-surface-400">Send this quotation to the facility contact</p>
              </div>
            </div>

            {!isEmailJSConfigured() ? (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-sm text-amber-300">Email service is not configured. Please set your EmailJS API keys in the environment variables to enable email sending.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-surface-400 mb-1.5">Recipient Email Address</label>
                  <input
                    type="email"
                    value={emailTo}
                    onChange={e => setEmailTo(e.target.value)}
                    placeholder="email@example.com"
                    autoFocus
                    disabled={emailSending}
                    className="w-full px-4 py-2.5 bg-surface-700 border border-surface-600 rounded-xl text-surface-100 placeholder-surface-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-colors text-sm disabled:opacity-50"
                    onKeyDown={e => { if (e.key === 'Enter' && emailTo && !emailSending) { e.preventDefault(); handleSendEmail(); } }}
                  />
                </div>

                <div className="flex gap-3 justify-end pt-2">
                  <button
                    onClick={() => { setShowEmailModal(false); setEmailTo(''); }}
                    disabled={emailSending}
                    className="px-5 py-2.5 rounded-xl border border-surface-600 text-surface-300 hover:bg-surface-700/50 transition-all text-sm font-medium disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendEmail}
                    disabled={!emailTo || emailSending}
                    className="px-5 py-2.5 rounded-xl bg-cyan-600 text-white font-medium hover:bg-cyan-500 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-600/20 flex items-center gap-2"
                  >
                    {emailSending ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Sending...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        Send Report
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </>
  );
}
