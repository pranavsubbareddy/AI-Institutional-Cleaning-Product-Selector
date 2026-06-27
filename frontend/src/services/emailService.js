import emailjs from '@emailjs/browser';

const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '';
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || '';
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_CONFIRMATION_TEMPLATE_ID || '';

let initialized = false;

function initEmailJS() {
  if (!initialized && EMAILJS_PUBLIC_KEY) {
    emailjs.init({
      publicKey: EMAILJS_PUBLIC_KEY,
      blockHeadless: true,
    });
    initialized = true;
  }
}

export function isEmailJSConfigured() {
  return !!(EMAILJS_PUBLIC_KEY && EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID);
}

export function getEmailJSConfig() {
  return {
    serviceId: EMAILJS_SERVICE_ID,
    templateId: EMAILJS_TEMPLATE_ID,
    configured: isEmailJSConfigured(),
  };
}

function buildProductTable(productRows, totalCost) {
  const cost = Number(totalCost).toLocaleString('en-IN');
  return (
    '<table style="width:100%;border-collapse:collapse;margin-top:16px;font-family:Arial,sans-serif;">' +
    '<thead><tr style="background:#059669;color:white;">' +
    '<th style="padding:10px 8px;text-align:left;font-size:13px;">Product</th>' +
    '<th style="padding:10px 8px;text-align:center;font-size:13px;">Qty/Month</th>' +
    '<th style="padding:10px 8px;text-align:right;font-size:13px;">Unit Price</th>' +
    '<th style="padding:10px 8px;text-align:right;font-size:13px;">Monthly Cost</th>' +
    '</tr></thead><tbody>' +
    productRows +
    '</tbody><tfoot><tr style="background:#f0fdf4;">' +
    '<td style="padding:10px 8px;font-weight:bold;font-size:14px;" colspan="3">Total Estimated Monthly Cost</td>' +
    '<td style="padding:10px 8px;text-align:right;font-weight:bold;font-size:15px;color:#059669;">Rs ' +
    cost +
    '</td></tr></tfoot></table>'
  );
}

export async function sendFormWithReportEmail(formData, recommendationData) {
  if (!isEmailJSConfigured()) {
    console.warn('[EmailJS] Not configured.');
    return { success: false, error: 'EmailJS not configured' };
  }
  initEmailJS();

  const surfaceLabels = {
    hard_floor: 'Hard Floor', carpet: 'Carpet', glass: 'Glass / Windows',
    tile: 'Tile', stainless_steel: 'Stainless Steel', wood: 'Wood',
    marble: 'Marble', countertop: 'Countertop', porcelain: 'Porcelain', mirror: 'Mirror'
  };
  const preferenceLabels = {
    eco_friendly: 'Eco-Friendly', fragrance_free: 'Fragrance-Free',
    hypoallergenic: 'Hypoallergenic', concentrated: 'Concentrated',
    ready_to_use: 'Ready-to-Use', industrial_grade: 'Industrial Grade'
  };
  const equipmentLabels = {
    mop: 'Mop & Bucket', vacuum: 'Vacuum Cleaner', scrubber: 'Floor Scrubber',
    pressure_washer: 'Pressure Washer', steam_cleaner: 'Steam Cleaner',
    carpet_extractor: 'Carpet Extractor', microfiber: 'Microfiber Cloths',
    auto_dispenser: 'Auto Dispenser'
  };
  const frequencyLabels = {
    daily: 'Daily', twice_daily: 'Twice Daily', weekly: 'Weekly',
    multiple_weekly: 'Multiple/Week', custom: 'As Needed'
  };

  const items = recommendationData?.items || [];
  const productRows = items.map((item, i) => `<tr style="background:${i % 2 === 0 ? '#f9f9f9' : '#ffffff'}">
<td style="padding:10px 8px;border-bottom:1px solid #eee;">${item.product_name || 'Unknown'}</td>
<td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:center;">${item.quantity_estimate || 0} ${item.unit || 'units'}</td>
<td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right;">Rs ${Number(item.unit_price || item.base_price || 0).toLocaleString('en-IN')}</td>
<td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;">Rs ${Number(item.monthly_cost || 0).toLocaleString('en-IN')}</td>
</tr>`).join('\n');

  const totalCost = recommendationData?.grossAggregatedCost || recommendationData?.total_estimated_cost || 0;
  const alerts = recommendationData?.alerts || [];

  // Build contact info section
  const contactInfoHtml = [];
  if (formData.contact_name) contactInfoHtml.push('<tr><td style="padding:6px 12px;color:#64748b;font-size:13px;">Name</td><td style="padding:6px 12px;color:#1e293b;font-size:13px;font-weight:500;">' + formData.contact_name + '</td></tr>');
  if (formData.contact_email) contactInfoHtml.push('<tr><td style="padding:6px 12px;color:#64748b;font-size:13px;">Email</td><td style="padding:6px 12px;color:#1e293b;font-size:13px;font-weight:500;">' + formData.contact_email + '</td></tr>');
  if (formData.contact_phone) contactInfoHtml.push('<tr><td style="padding:6px 12px;color:#64748b;font-size:13px;">Phone</td><td style="padding:6px 12px;color:#1e293b;font-size:13px;font-weight:500;">' + formData.contact_phone + '</td></tr>');
  if (formData.address) contactInfoHtml.push('<tr><td style="padding:6px 12px;color:#64748b;font-size:13px;">Address</td><td style="padding:6px 12px;color:#1e293b;font-size:13px;font-weight:500;">' + formData.address + '</td></tr>');

  // Build facility info section
  const facilityInfoHtml = [
    '<tr><td style="padding:6px 12px;color:#64748b;font-size:13px;">Facility Name</td><td style="padding:6px 12px;color:#1e293b;font-size:13px;font-weight:500;">' + (formData.name || 'N/A') + '</td></tr>',
    '<tr><td style="padding:6px 12px;color:#64748b;font-size:13px;">Type</td><td style="padding:6px 12px;color:#1e293b;font-size:13px;font-weight:500;">' + (formData.institution_type || 'N/A') + '</td></tr>',
    '<tr><td style="padding:6px 12px;color:#64748b;font-size:13px;">Area</td><td style="padding:6px 12px;color:#1e293b;font-size:13px;font-weight:500;">' + Number(formData.area_size || 0).toLocaleString() + ' sq. ft.</td></tr>',
    '<tr><td style="padding:6px 12px;color:#64748b;font-size:13px;">Floors</td><td style="padding:6px 12px;color:#1e293b;font-size:13px;font-weight:500;">' + (formData.floors || 1) + '</td></tr>',
    '<tr><td style="padding:6px 12px;color:#64748b;font-size:13px;">Occupants</td><td style="padding:6px 12px;color:#1e293b;font-size:13px;font-weight:500;">' + (formData.occupants || 'N/A') + '+</td></tr>',
    '<tr><td style="padding:6px 12px;color:#64748b;font-size:13px;">Operating Hours</td><td style="padding:6px 12px;color:#1e293b;font-size:13px;font-weight:500;">' + (formData.operating_hours || 'N/A') + '</td></tr>',
    '<tr><td style="padding:6px 12px;color:#64748b;font-size:13px;">Surfaces</td><td style="padding:6px 12px;color:#1e293b;font-size:13px;font-weight:500;">' + ((formData.surface_types || []).map(s => surfaceLabels[s] || s).join(', ') || 'N/A') + '</td></tr>',
    '<tr><td style="padding:6px 12px;color:#64748b;font-size:13px;">Hygiene Standard</td><td style="padding:6px 12px;color:#1e293b;font-size:13px;font-weight:500;">' + ((formData.hygiene_standard || '').replace('_', ' ') || 'N/A') + '</td></tr>',
    '<tr><td style="padding:6px 12px;color:#64748b;font-size:13px;">Budget</td><td style="padding:6px 12px;color:#1e293b;font-size:13px;font-weight:500;">' + (formData.budget || 'N/A') + '</td></tr>',
    '<tr><td style="padding:6px 12px;color:#64748b;font-size:13px;">Cleaning Frequency</td><td style="padding:6px 12px;color:#1e293b;font-size:13px;font-weight:500;">' + (frequencyLabels[formData.cleaning_frequency] || formData.cleaning_frequency || 'N/A') + '</td></tr>',
    '<tr><td style="padding:6px 12px;color:#64748b;font-size:13px;">Facility Age</td><td style="padding:6px 12px;color:#1e293b;font-size:13px;font-weight:500;">' + (formData.facility_age || 'N/A') + '</td></tr>',
  ];
  if ((formData.equipment || []).length > 0) {
    facilityInfoHtml.push('<tr><td style="padding:6px 12px;color:#64748b;font-size:13px;">Equipment</td><td style="padding:6px 12px;color:#1e293b;font-size:13px;font-weight:500;">' + formData.equipment.map(e => equipmentLabels[e] || e).join(', ') + '</td></tr>');
  }

  // Optional fields - only include if user filled them in
  const optionalFieldsHtml = [];
  if ((formData.preferences || []).length > 0) {
    optionalFieldsHtml.push('<tr><td style="padding:6px 12px;color:#64748b;font-size:13px;">Product Preferences</td><td style="padding:6px 12px;color:#1e293b;font-size:13px;font-weight:500;">' + formData.preferences.map(p => preferenceLabels[p] || p).join(', ') + '</td></tr>');
  }
  if (formData.current_products) {
    optionalFieldsHtml.push('<tr><td style="padding:6px 12px;color:#64748b;font-size:13px;">Current Products Used</td><td style="padding:6px 12px;color:#1e293b;font-size:13px;font-weight:500;">' + formData.current_products + '</td></tr>');
  }
  if (formData.special_requirements) {
    optionalFieldsHtml.push('<tr><td style="padding:6px 12px;color:#64748b;font-size:13px;">Special Requirements</td><td style="padding:6px 12px;color:#1e293b;font-size:13px;font-weight:500;">' + formData.special_requirements + '</td></tr>');
  }
  if (formData.facility_description) {
    optionalFieldsHtml.push('<tr><td style="padding:6px 12px;color:#64748b;font-size:13px;">Description</td><td style="padding:6px 12px;color:#1e293b;font-size:13px;font-weight:500;">' + formData.facility_description + '</td></tr>');
  }

  const allInfoRows = contactInfoHtml.join('') + facilityInfoHtml.join('') + optionalFieldsHtml.join('');

  // Build human-readable labels for enum values
  const hoursMap = { day: 'Day (6AM-6PM)', night: 'Night (6PM-6AM)', '24x7': '24x7 Operation', business: 'Business Hours (9-5)' };
  const operatingHoursLabel = hoursMap[formData.operating_hours] || formData.operating_hours || 'N/A';

  const ageMap = { new: 'New (0-5 yrs)', moderate: 'Moderate (5-15 yrs)', old: 'Old (15-30 yrs)', vintage: 'Vintage (30+ yrs)' };
  const facilityAgeLabel = ageMap[formData.facility_age] || formData.facility_age || 'N/A';

  const hygieneLabel = (formData.hygiene_standard || '').replace('_', ' ') || 'N/A';
  const surfaceTypesLabel = (formData.surface_types || []).map(s => surfaceLabels[s] || s).join(', ') || 'N/A';
  const equipmentLabel = (formData.equipment || []).map(e => equipmentLabels[e] || e).join(', ') || 'None';
  const preferencesLabel = (formData.preferences || []).length > 0 ? formData.preferences.map(p => preferenceLabels[p] || p).join(', ') : 'None';
  const areaSizeLabel = formData.area_size ? Number(formData.area_size).toLocaleString() : 'N/A';

  // Build a complete HTML email body that can be used as a single {{full_email_html}} variable
  const fullEmailHtml = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#334155;">
      <div style="background:#0f766e;color:white;padding:20px;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:20px;">Ganga Maxx - Cleaning Product Recommendations</h1>
        <p style="margin:6px 0 0;opacity:0.85;font-size:13px;">AI Institutional Cleaning Product Selector</p>
      </div>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:0;padding:20px;border-radius:0 0 8px 8px;">
        <h2 style="font-size:14px;color:#0f172a;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #0d9488;">Contact Information</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Name</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;">${formData.contact_name || 'N/A'}</td></tr>
          <tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Email</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;">${formData.contact_email || 'N/A'}</td></tr>
          <tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Phone</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;">${formData.contact_phone || 'N/A'}</td></tr>
          <tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Facility</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;">${formData.name || 'N/A'}</td></tr>
          <tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Address</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;">${formData.address || 'N/A'}</td></tr>
        </table>

        <h2 style="font-size:14px;color:#0f172a;margin:16px 0 12px;padding-bottom:8px;border-bottom:2px solid #0d9488;">Facility Profile</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Type</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;text-transform:capitalize;">${formData.institution_type || 'N/A'}</td></tr>
          <tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Area</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;">${areaSizeLabel} sq. ft.</td></tr>
          <tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Floors</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;">${formData.floors || 'N/A'}</td></tr>
          <tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Occupants</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;">${formData.occupants || 'N/A'}${formData.occupants ? '+' : ''}</td></tr>
          <tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Operating Hours</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;">${operatingHoursLabel}</td></tr>
          <tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Surface Types</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;">${surfaceTypesLabel}</td></tr>
          <tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Hygiene Standard</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;text-transform:capitalize;">${hygieneLabel}</td></tr>
          <tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Budget</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;text-transform:capitalize;">${formData.budget || 'N/A'}</td></tr>
          <tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Cleaning Frequency</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;">${frequencyLabels[formData.cleaning_frequency] || formData.cleaning_frequency || 'N/A'}</td></tr>
          <tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Facility Age</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;">${facilityAgeLabel}</td></tr>
          <tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Equipment</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;">${equipmentLabel}</td></tr>
          <tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Product Preferences</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;">${preferencesLabel}</td></tr>
          ${formData.current_products ? `<tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Current Products</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;">${formData.current_products}</td></tr>` : ''}
          ${formData.special_requirements ? `<tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Special Requirements</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;">${formData.special_requirements}</td></tr>` : ''}
          ${formData.facility_description ? `<tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Description</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;">${formData.facility_description}</td></tr>` : ''}
        </table>

        ${items.length > 0 ? `
        <h2 style="font-size:14px;color:#0f172a;margin:16px 0 12px;padding-bottom:8px;border-bottom:2px solid #0d9488;">Recommended Products</h2>
        ${buildProductTable(productRows, totalCost)}
        <p style="font-size:12px;color:#64748b;margin-top:12px;">${items.length} product(s) recommended with a total estimated monthly cost of Rs ${Number(totalCost).toLocaleString('en-IN')}</p>
        ` : ''}

        ${alerts.length > 0 ? `
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px;margin-top:16px;">
          <p style="font-size:13px;font-weight:600;color:#b91c1c;margin:0 0 6px;">Alerts & Notes</p>
          <ul style="margin:0;padding-left:18px;font-size:12px;color:#991b1b;">${alerts.map(a => '<li>' + a + '</li>').join('')}</ul>
        </div>
        ` : ''}

        <div style="text-align:center;padding-top:20px;margin-top:20px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;">
          <p style="margin:0;">Generated by <strong>Ganga Maxx</strong> — AI Institutional Cleaning Product Selector</p>
          <p style="margin:4px 0 0;">${new Date().toLocaleString('en-IN')}</p>
        </div>
      </div>
    </div>
  `;

  const templateParams = {
    // ── Recipient ──
    to_email: formData.contact_email,
    // ── Common / generic names (for template compatibility) ──
    name: formData.contact_name || 'N/A',
    email: formData.contact_email || 'N/A',
    phone: formData.contact_phone || 'N/A',
    facility: formData.name || 'N/A',
    address: formData.address || 'N/A',
    type: formData.institution_type || 'N/A',
    area: areaSizeLabel,
    message: recommendationData?.summary || 'Recommendation generated successfully.',
    // ── Original specific names (backward compat) ──
    contact_name: formData.contact_name || 'N/A',
    contact_phone: formData.contact_phone || 'N/A',
    contact_email: formData.contact_email || 'N/A',
    facility_address: formData.address || 'N/A',
    facility_name: formData.name,
    institution_type: formData.institution_type || 'N/A',
    area_size: areaSizeLabel,
    floors: String(formData.floors || 1),
    occupants: String(formData.occupants || 'N/A'),
    operating_hours: operatingHoursLabel,
    facility_description: formData.facility_description || '',
    surface_types: surfaceTypesLabel,
    hygiene_standard: hygieneLabel,
    budget: formData.budget || 'N/A',
    cleaning_frequency: frequencyLabels[formData.cleaning_frequency] || formData.cleaning_frequency || 'N/A',
    facility_age: facilityAgeLabel,
    equipment: equipmentLabel,
    preferences: preferencesLabel,
    special_requirements: formData.special_requirements || '',
    current_products: formData.current_products || '',
    // ── Recommendation data ──
    recommendation_summary: recommendationData?.summary || 'Recommendation generated successfully.',
    total_cost: 'Rs ' + Number(totalCost).toLocaleString('en-IN') + '/month',
    item_count: String(items.length),
    // ── HTML blocks ──
    alerts_text: alerts.length > 0 ? alerts.join('\n• ') : 'None',
    alerts_html: alerts.length > 0 ? alerts.map(a => '<li>' + a + '</li>').join('') : '<li>No alerts</li>',
    product_details_html: items.length > 0 ? buildProductTable(productRows, totalCost) : '<p>No product recommendations.</p>',
    contact_info_html: contactInfoHtml.length > 0 ? '<table style="width:100%;border-collapse:collapse;margin-bottom:8px;">' + contactInfoHtml.join('') + '</table>' : '<p style="color:#94a3b8;font-size:13px;">No contact information provided</p>',
    facility_info_html: '<table style="width:100%;border-collapse:collapse;margin-bottom:8px;">' + facilityInfoHtml.join('') + '</table>',
    optional_fields_html: optionalFieldsHtml.length > 0 ? '<table style="width:100%;border-collapse:collapse;margin-top:8px;">' + optionalFieldsHtml.join('') + '</table>' : '',
    all_info_html: '<table style="width:100%;border-collapse:collapse;">' + allInfoRows + '</table>',
    // ── COMPLETE HTML EMAIL BODY (use {{full_email_html}} in your template) ──
    full_email_html: fullEmailHtml,
  };

  try {
    const response = await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
    return { success: true, status: response.status, text: response.text };
  } catch (error) {
    console.error('[EmailJS] Failed - full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    console.error('[EmailJS] Failed - message:', error?.message);
    console.error('[EmailJS] Failed - name:', error?.name);
    console.error('[EmailJS] Failed - stack:', error?.stack);
    const errMsg = typeof error === 'object' ? (error?.message || error?.text || JSON.stringify(error)) : String(error);
    return { success: false, error: errMsg || 'Failed to send email' };
  }
}

export async function sendReportToEmail(recipientEmail, recipientName, reportData) {
  if (!isEmailJSConfigured()) {
    console.warn('[EmailJS] Not configured.');
    return { success: false, error: 'EmailJS not configured' };
  }
  initEmailJS();

  const items = reportData?.items || [];
  const productRows = items.map((item, i) => `<tr style="background:${i % 2 === 0 ? '#f9f9f9' : '#ffffff'}">
<td style="padding:10px 8px;border-bottom:1px solid #eee;">${item.product_name || 'Unknown'}</td>
<td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:center;">${item.quantity_estimate || 0} ${item.unit || 'units'}</td>
<td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right;">Rs ${Number(item.unit_price || item.base_price || 0).toLocaleString('en-IN')}</td>
<td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;">Rs ${Number(item.monthly_cost || 0).toLocaleString('en-IN')}</td>
</tr>`).join('\n');

  const totalCost = reportData?.total_estimated_cost || 0;
  const alerts = reportData?.alerts || [];
  const instName = reportData?.institution_name || 'Your Facility';

  // ── Label maps ──
  const surfaceLabels = {
    hard_floor: 'Hard Floor', carpet: 'Carpet', glass: 'Glass / Windows',
    tile: 'Tile', stainless_steel: 'Stainless Steel', wood: 'Wood',
    marble: 'Marble', countertop: 'Countertop', porcelain: 'Porcelain', mirror: 'Mirror'
  };
  const preferenceLabels = {
    eco_friendly: 'Eco-Friendly', fragrance_free: 'Fragrance-Free',
    hypoallergenic: 'Hypoallergenic', concentrated: 'Concentrated',
    ready_to_use: 'Ready-to-Use', industrial_grade: 'Industrial Grade'
  };
  const equipmentLabels = {
    mop: 'Mop & Bucket', vacuum: 'Vacuum Cleaner', scrubber: 'Floor Scrubber',
    pressure_washer: 'Pressure Washer', steam_cleaner: 'Steam Cleaner',
    carpet_extractor: 'Carpet Extractor', microfiber: 'Microfiber Cloths',
    auto_dispenser: 'Auto Dispenser'
  };
  const frequencyLabels = {
    daily: 'Daily', twice_daily: 'Twice Daily', weekly: 'Weekly',
    multiple_weekly: 'Multiple/Week', custom: 'As Needed'
  };
  const hoursMap = { day: 'Day (6AM-6PM)', night: 'Night (6PM-6AM)', '24x7': '24x7 Operation', business: 'Business Hours (9-5)' };
  const ageMap = { new: 'New (0-5 yrs)', moderate: 'Moderate (5-15 yrs)', old: 'Old (15-30 yrs)', vintage: 'Vintage (30+ yrs)' };

  // ── Extract values from reportData (including nested metadata) ──
  const metadata = reportData?.metadata || {};
  const surfaceTypesArr = Array.isArray(reportData?.surface_types)
    ? reportData.surface_types
    : (typeof reportData?.surface_types === 'string' ? JSON.parse(reportData.surface_types) : []);
  const surfaceTypesLabel = surfaceTypesArr.map(s => surfaceLabels[s] || s).join(', ') || 'N/A';
  const hygieneLabel = (reportData?.hygiene_standard || '').replace(/_/g, ' ') || 'N/A';
  const frequencyLabel = frequencyLabels[metadata.cleaning_frequency] || metadata.cleaning_frequency || 'N/A';
  const equipmentArr = metadata.equipment || [];
  const equipmentLabel = equipmentArr.map(e => equipmentLabels[e] || e).join(', ') || 'None';
  const preferencesArr = metadata.preferences || [];
  const preferencesLabel = preferencesArr.map(p => preferenceLabels[p] || p).join(', ') || 'None';
  const areaSizeLabel = reportData?.area_size ? Number(reportData.area_size).toLocaleString() : 'N/A';
  const budgetLabel = reportData?.budget || reportData?.budget_level || 'N/A';
  const operatingHoursLabel = hoursMap[metadata.operating_hours] || metadata.operating_hours || 'N/A';
  const facilityAgeLabel = ageMap[metadata.facility_age] || metadata.facility_age || 'N/A';

  // Build a complete self-contained HTML email body — use {{{full_email_html}}} in your EmailJS template
  // (triple braces prevent HTML escaping). This is the most reliable way to render formatted HTML.
  const fullEmailHtml = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#334155;">
      <div style="background:#0f766e;color:white;padding:20px;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:20px;">Ganga Maxx</h1>
        <p style="margin:6px 0 0;opacity:0.85;font-size:13px;">Cleaning Product Recommendations</p>
      </div>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:0;padding:20px;border-radius:0 0 8px 8px;">
        <h2 style="font-size:14px;color:#0f172a;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #0d9488;">Contact Information</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Name</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;">${recipientName || 'N/A'}</td></tr>
          <tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Email</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;">${recipientEmail}</td></tr>
          <tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Phone</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;">${reportData?.contact_phone || 'N/A'}</td></tr>
          <tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Facility</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;">${instName}</td></tr>
          <tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Address</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;">${reportData?.address || 'N/A'}</td></tr>
        </table>

        <h2 style="font-size:14px;color:#0f172a;margin:16px 0 12px;padding-bottom:8px;border-bottom:2px solid #0d9488;">Facility Profile</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Type</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;text-transform:capitalize;">${reportData?.institution_type || 'N/A'}</td></tr>
          <tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Area</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;">${areaSizeLabel} sq. ft.</td></tr>
          <tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Surfaces</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;">${surfaceTypesLabel}</td></tr>
          <tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Hygiene Level</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;text-transform:capitalize;">${hygieneLabel}</td></tr>
          <tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Budget</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;text-transform:capitalize;">${budgetLabel}</td></tr>
          <tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Cleaning Frequency</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;">${frequencyLabel}</td></tr>
          <tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Equipment</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;">${equipmentLabel}</td></tr>
          ${metadata.floors ? `<tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Floors</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;">${metadata.floors}</td></tr>` : ''}
          ${metadata.occupants ? `<tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Occupants</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;">${metadata.occupants}+</td></tr>` : ''}
          <tr><td style="padding:5px 8px;color:#64748b;font-size:13px;">Product Preferences</td><td style="padding:5px 8px;color:#1e293b;font-size:13px;font-weight:500;">${preferencesLabel}</td></tr>

        ${items.length > 0 ? `
        <h2 style="font-size:14px;color:#0f172a;margin:16px 0 12px;padding-bottom:8px;border-bottom:2px solid #0d9488;">Recommendations</h2>
        <p style="font-size:13px;color:#475569;margin-bottom:12px;">${reportData?.summary || ''}</p>
        ${buildProductTable(productRows, totalCost)}
        <p style="font-size:12px;color:#64748b;margin-top:12px;"><strong>Rs ${Number(totalCost).toLocaleString('en-IN')}/month</strong> &middot; ${items.length} product(s) recommended</p>
        ` : ''}

        ${alerts.length > 0 ? `
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px;margin-top:16px;">
          <p style="font-size:13px;font-weight:600;color:#b91c1c;margin:0 0 6px;">Alerts & Notes</p>
          <ul style="margin:0;padding-left:18px;font-size:12px;color:#991b1b;">${alerts.map(a => '<li>' + a + '</li>').join('')}</ul>
        </div>
        ` : ''}

        <div style="text-align:center;padding-top:20px;margin-top:20px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;">
          <p style="margin:0;">Generated by <strong>Ganga Maxx</strong> &mdash; AI Institutional Cleaning Product Selector</p>
          <p style="margin:4px 0 0;">${new Date().toLocaleString('en-IN')}</p>
          <p style="margin:4px 0 0;">Email sent via EmailJS.com</p>
        </div>
      </div>
    </div>
  `;

  const templateParams = {
    // ── Recipient ──
    to_email: recipientEmail,
    // ── Common / generic names (for template compatibility) ──
    name: recipientName || 'Valued Customer',
    email: recipientEmail,
    phone: reportData?.contact_phone || 'N/A',
    facility: instName,
    address: reportData?.address || 'N/A',
    type: reportData?.institution_type || 'N/A',
    area: areaSizeLabel,
    message: reportData?.summary || 'Recommendation generated successfully.',
    // ── Original specific names (backward compat) ──
    contact_name: recipientName || 'Valued Customer',
    contact_phone: reportData?.contact_phone || 'N/A',
    contact_email: recipientEmail,
    facility_address: reportData?.address || 'N/A',
    facility_name: instName,
    institution_type: reportData?.institution_type || 'N/A',
    area_size: areaSizeLabel,
    floors: String(metadata.floors || 1),
    occupants: String(metadata.occupants || 'N/A'),
    operating_hours: operatingHoursLabel,
    facility_description: metadata.facility_description || '',
    surface_types: surfaceTypesLabel,
    hygiene_standard: hygieneLabel,
    budget: budgetLabel,
    cleaning_frequency: frequencyLabel,
    facility_age: facilityAgeLabel,
    equipment: equipmentLabel,
    preferences: preferencesLabel,
    special_requirements: metadata.special_requirements || '',
    current_products: metadata.current_products || '',
    // ── Recommendation data ──
    recommendation_summary: reportData?.summary || 'Your personalized cleaning product recommendations.',
    total_cost: 'Rs ' + Number(totalCost).toLocaleString('en-IN') + '/month',
    item_count: String(items.length),
    // ── HTML blocks ──
    alerts_text: alerts.length > 0 ? alerts.join('\n• ') : 'None',
    alerts_html: alerts.length > 0 ? alerts.map(a => '<li>' + a + '</li>').join('') : '<li>No alerts</li>',
    product_details_html: items.length > 0 ? buildProductTable(productRows, totalCost) : '<p>No product recommendations.</p>',
    // ── Complete self-contained HTML — use {{{full_email_html}}} in your EmailJS template ──
    full_email_html: fullEmailHtml,
  };

  try {
    const response = await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
    return { success: true, status: response.status, text: response.text };
  } catch (error) {
    console.error('[EmailJS] Failed - full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    console.error('[EmailJS] Failed - message:', error?.message);
    console.error('[EmailJS] Failed - name:', error?.name);
    const errMsg = typeof error === 'object' ? (error?.message || error?.text || JSON.stringify(error)) : String(error);
    return { success: false, error: errMsg || 'Failed to send email' };
  }
}
