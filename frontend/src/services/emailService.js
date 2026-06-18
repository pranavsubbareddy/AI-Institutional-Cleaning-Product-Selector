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

  const templateParams = {
    to_email: formData.contact_email,
    contact_name: formData.contact_name || 'N/A',
    contact_phone: formData.contact_phone || 'N/A',
    contact_email: formData.contact_email || 'N/A',
    facility_address: formData.address || 'N/A',
    facility_name: formData.name,
    institution_type: formData.institution_type || 'N/A',
    area_size: String(Number(formData.area_size || 0).toLocaleString()),
    floors: String(formData.floors || 1),
    occupants: String(formData.occupants || 'N/A'),
    operating_hours: formData.operating_hours || 'N/A',
    facility_description: formData.facility_description || '',
    surface_types: (formData.surface_types || []).map(s => surfaceLabels[s] || s).join(', ') || 'N/A',
    hygiene_standard: (formData.hygiene_standard || '').replace('_', ' ') || 'N/A',
    budget: formData.budget || 'N/A',
    cleaning_frequency: frequencyLabels[formData.cleaning_frequency] || formData.cleaning_frequency || 'N/A',
    facility_age: formData.facility_age || 'N/A',
    equipment: (formData.equipment || []).map(e => equipmentLabels[e] || e).join(', ') || '',
    preferences: (formData.preferences || []).length > 0 ? formData.preferences.map(p => preferenceLabels[p] || p).join(', ') : '',
    special_requirements: formData.special_requirements || '',
    current_products: formData.current_products || '',
    recommendation_summary: recommendationData?.summary || 'Recommendation generated successfully.',
    total_cost: 'Rs ' + Number(totalCost).toLocaleString('en-IN') + '/month',
    item_count: String(items.length),
    alerts_text: alerts.length > 0 ? alerts.join('\n• ') : 'None',
    alerts_html: alerts.length > 0 ? alerts.map(a => '<li>' + a + '</li>').join('') : '<li>No alerts</li>',
    product_details_html: items.length > 0 ? buildProductTable(productRows, totalCost) : '<p>No product recommendations.</p>',
    contact_info_html: contactInfoHtml.length > 0 ? '<table style="width:100%;border-collapse:collapse;margin-bottom:8px;">' + contactInfoHtml.join('') + '</table>' : '<p style="color:#94a3b8;font-size:13px;">No contact information provided</p>',
    facility_info_html: '<table style="width:100%;border-collapse:collapse;margin-bottom:8px;">' + facilityInfoHtml.join('') + '</table>',
    optional_fields_html: optionalFieldsHtml.length > 0 ? '<table style="width:100%;border-collapse:collapse;margin-top:8px;">' + optionalFieldsHtml.join('') + '</table>' : '',
    all_info_html: '<table style="width:100%;border-collapse:collapse;">' + allInfoRows + '</table>',
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

  const templateParams = {
    to_email: recipientEmail,
    contact_name: recipientName || 'Valued Customer',
    facility_name: reportData?.institution_name || 'Your Facility',
    institution_type: reportData?.institution_type || '',
    recommendation_summary: reportData?.summary || 'Your personalized cleaning product recommendations.',
    total_cost: 'Rs ' + Number(totalCost).toLocaleString('en-IN') + '/month',
    item_count: String(items.length),
    alerts_text: alerts.length > 0 ? alerts.join('\n• ') : 'None',
    alerts_html: alerts.length > 0 ? alerts.map(a => '<li>' + a + '</li>').join('') : '<li>No alerts</li>',
    product_details_html: items.length > 0 ? buildProductTable(productRows, totalCost) : '<p>No product recommendations.</p>',
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
