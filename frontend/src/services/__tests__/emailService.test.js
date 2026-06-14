import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mock @emailjs/browser to avoid actually sending emails
// ---------------------------------------------------------------------------
const mockEmailjsSend = jest.fn();
const mockEmailjsInit = jest.fn();

jest.mock('@emailjs/browser', () => ({
  __esModule: true,
  default: {
    init: (...args) => mockEmailjsInit(...args),
    send: (...args) => mockEmailjsSend(...args),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function setEnvVars(opts = {}) {
  process.env.VITE_EMAILJS_PUBLIC_KEY = opts.publicKey ?? '';
  process.env.VITE_EMAILJS_SERVICE_ID = opts.serviceId ?? '';
  process.env.VITE_EMAILJS_CONFIRMATION_TEMPLATE_ID = opts.templateId ?? '';
}

function clearEnvVars() {
  delete process.env.VITE_EMAILJS_PUBLIC_KEY;
  delete process.env.VITE_EMAILJS_SERVICE_ID;
  delete process.env.VITE_EMAILJS_CONFIRMATION_TEMPLATE_ID;
}

// Sample data for sendFormWithReportEmail tests
const sampleFormData = {
  contact_email: 'test@example.com',
  contact_name: 'John Doe',
  contact_phone: '+91-9876543210',
  address: '123 Main St, Mumbai',
  name: 'Test Facility',
  institution_type: 'hospital',
  area_size: '5000',
  floors: 3,
  occupants: 200,
  operating_hours: 'day',
  surface_types: ['hard_floor', 'tile', 'glass'],
  hygiene_standard: 'medical_grade',
  budget: 'high',
  cleaning_frequency: 'daily',
  facility_age: 'moderate',
  equipment: ['mop', 'scrubber', 'microfiber'],
  preferences: ['eco_friendly', 'concentrated'],
  special_requirements: 'Need hypoallergenic products',
  facility_description: 'A large hospital facility',
  current_products: 'Various local brands',
};

const sampleRecommendationData = {
  items: [
    {
      product_name: 'Ganga Maxx Disinfectant',
      product_id: 'prod-dsf-002',
      quantity_estimate: 25,
      unit: 'liters',
      unit_price: 450,
      base_price: 450,
      monthly_cost: 11250,
      category: 'Disinfectant',
    },
    {
      product_name: 'Ganga Maxx Hand Sanitizer',
      product_id: 'prod-hnd-009',
      quantity_estimate: 40,
      unit: 'liters',
      unit_price: 320,
      base_price: 320,
      monthly_cost: 12800,
      category: 'Hand Sanitizer',
    },
  ],
  grossAggregatedCost: 24050,
  total_estimated_cost: 24050,
  summary: 'Recommended products for your facility based on requirements.',
  alerts: ['High hygiene area - increase disinfection frequency', 'Consider eco-friendly options'],
};

// ---------------------------------------------------------------------------
// Setup & Teardown
// ---------------------------------------------------------------------------
beforeEach(() => {
  jest.clearAllMocks();
  clearEnvVars();
});

// ===========================================================================
// 1. isEmailJSConfigured
// ===========================================================================
describe('isEmailJSConfigured()', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('returns true when all env vars are set', async () => {
    setEnvVars({ publicKey: 'pk_test', serviceId: 'svc_test', templateId: 'tmpl_test' });
    const { isEmailJSConfigured } = await import('../emailService');
    expect(isEmailJSConfigured()).toBe(true);
  });

  test('returns false when all env vars are empty strings', async () => {
    setEnvVars({ publicKey: '', serviceId: '', templateId: '' });
    const { isEmailJSConfigured } = await import('../emailService');
    expect(isEmailJSConfigured()).toBe(false);
  });

  test('returns false when env vars are deleted', async () => {
    clearEnvVars();
    const { isEmailJSConfigured } = await import('../emailService');
    expect(isEmailJSConfigured()).toBe(false);
  });

  test('returns false when only public key is set', async () => {
    setEnvVars({ publicKey: 'pk_test', serviceId: '', templateId: '' });
    const { isEmailJSConfigured } = await import('../emailService');
    expect(isEmailJSConfigured()).toBe(false);
  });

  test('returns false when only service id is set', async () => {
    setEnvVars({ publicKey: '', serviceId: 'svc_test', templateId: '' });
    const { isEmailJSConfigured } = await import('../emailService');
    expect(isEmailJSConfigured()).toBe(false);
  });

  test('returns false when only template id is set', async () => {
    setEnvVars({ publicKey: '', serviceId: '', templateId: 'tmpl_test' });
    const { isEmailJSConfigured } = await import('../emailService');
    expect(isEmailJSConfigured()).toBe(false);
  });
});

// ===========================================================================
// 2. getEmailJSConfig
// ===========================================================================
describe('getEmailJSConfig()', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('returns config with all values when configured', async () => {
    setEnvVars({ publicKey: 'pk_test', serviceId: 'svc_test', templateId: 'tmpl_test' });
    const { getEmailJSConfig } = await import('../emailService');
    const config = getEmailJSConfig();
    expect(config).toEqual({ serviceId: 'svc_test', templateId: 'tmpl_test', configured: true });
  });

  test('returns configured: false when not configured', async () => {
    setEnvVars({ publicKey: '', serviceId: '', templateId: '' });
    const { getEmailJSConfig } = await import('../emailService');
    const config = getEmailJSConfig();
    expect(config.configured).toBe(false);
    expect(config.serviceId).toBe('');
    expect(config.templateId).toBe('');
  });

  test('reflects partial configuration', async () => {
    setEnvVars({ publicKey: 'pk_test', serviceId: '', templateId: 'tmpl_test' });
    const { getEmailJSConfig } = await import('../emailService');
    const config = getEmailJSConfig();
    expect(config.configured).toBe(false);
    expect(config.serviceId).toBe('');
    expect(config.templateId).toBe('tmpl_test');
  });
});

// ===========================================================================
// 3. sendFormWithReportEmail
// ===========================================================================
describe('sendFormWithReportEmail()', () => {
  describe('when not configured', () => {
    beforeEach(async () => {
      setEnvVars({ publicKey: '', serviceId: '', templateId: '' });
      // Ensure module is loaded with clean state
      jest.resetModules();
    });

    test('returns error without calling emailjs.send', async () => {
      const { sendFormWithReportEmail } = await import('../emailService');
      const result = await sendFormWithReportEmail(sampleFormData, sampleRecommendationData);

      expect(result).toEqual({
        success: false,
        error: 'EmailJS not configured',
      });
      expect(mockEmailjsSend).not.toHaveBeenCalled();
      expect(mockEmailjsInit).not.toHaveBeenCalled();
    });
  });

  describe('when configured and emailjs.send succeeds', () => {
    beforeEach(async () => {
      setEnvVars({
        publicKey: 'pk_test',
        serviceId: 'svc_test',
        templateId: 'tmpl_test',
      });
      jest.resetModules();
      mockEmailjsSend.mockResolvedValue({ status: 200, text: 'OK' });
    });

    test('returns success result', async () => {
      const { sendFormWithReportEmail } = await import('../emailService');
      const result = await sendFormWithReportEmail(sampleFormData, sampleRecommendationData);

      expect(result).toEqual({ success: true, status: 200, text: 'OK' });
    });

    test('initializes emailjs with public key', async () => {
      const { sendFormWithReportEmail } = await import('../emailService');
      await sendFormWithReportEmail(sampleFormData, sampleRecommendationData);

      expect(mockEmailjsInit).toHaveBeenCalledWith({
        publicKey: 'pk_test',
        blockHeadless: true,
      });
    });

    test('calls emailjs.send with correct service and template ids', async () => {
      const { sendFormWithReportEmail } = await import('../emailService');
      await sendFormWithReportEmail(sampleFormData, sampleRecommendationData);

      expect(mockEmailjsSend).toHaveBeenCalledWith(
        'svc_test',
        'tmpl_test',
        expect.objectContaining({
          to_email: 'test@example.com',
          contact_name: 'John Doe',
        })
      );
    });

    test('passes correct form fields in template params', async () => {
      const { sendFormWithReportEmail } = await import('../emailService');
      await sendFormWithReportEmail(sampleFormData, sampleRecommendationData);

      const params = mockEmailjsSend.mock.calls[0][2];
      expect(params.facility_name).toBe('Test Facility');
      expect(params.institution_type).toBe('hospital');
      expect(params.area_size).toBe('5,000');
      expect(params.floors).toBe('3');
      expect(params.occupants).toBe('200');
      expect(params.operating_hours).toBe('day');
      expect(params.facility_address).toBe('123 Main St, Mumbai');
      expect(params.contact_phone).toBe('+91-9876543210');
    });

    test('passes correct surface, hygiene, and budget fields', async () => {
      const { sendFormWithReportEmail } = await import('../emailService');
      await sendFormWithReportEmail(sampleFormData, sampleRecommendationData);

      const params = mockEmailjsSend.mock.calls[0][2];
      expect(params.surface_types).toContain('Hard Floor');
      expect(params.surface_types).toContain('Tile');
      expect(params.surface_types).toContain('Glass / Windows');
      expect(params.hygiene_standard).toBe('medical grade');
      expect(params.budget).toBe('high');
    });

    test('passes correct cleaning frequency label', async () => {
      const { sendFormWithReportEmail } = await import('../emailService');
      await sendFormWithReportEmail(sampleFormData, sampleRecommendationData);

      const params = mockEmailjsSend.mock.calls[0][2];
      expect(params.cleaning_frequency).toBe('Daily');
    });

    test('passes equipment and preferences as comma-separated labels', async () => {
      const { sendFormWithReportEmail } = await import('../emailService');
      await sendFormWithReportEmail(sampleFormData, sampleRecommendationData);

      const params = mockEmailjsSend.mock.calls[0][2];
      expect(params.equipment).toContain('Mop & Bucket');
      expect(params.equipment).toContain('Floor Scrubber');
      expect(params.equipment).toContain('Microfiber Cloths');
      expect(params.preferences).toContain('Eco-Friendly');
      expect(params.preferences).toContain('Concentrated');
    });

    test('passes special requirements and current products', async () => {
      const { sendFormWithReportEmail } = await import('../emailService');
      await sendFormWithReportEmail(sampleFormData, sampleRecommendationData);

      const params = mockEmailjsSend.mock.calls[0][2];
      expect(params.special_requirements).toBe('Need hypoallergenic products');
      expect(params.current_products).toBe('Various local brands');
    });

    test('passes recommendation data correctly', async () => {
      const { sendFormWithReportEmail } = await import('../emailService');
      await sendFormWithReportEmail(sampleFormData, sampleRecommendationData);

      const params = mockEmailjsSend.mock.calls[0][2];
      expect(params.recommendation_summary).toBe(sampleRecommendationData.summary);
      expect(params.total_cost).toContain('Rs');
      expect(params.total_cost).toContain('/month');
      expect(params.item_count).toBe('2');
    });

    test('passes alerts text and html', async () => {
      const { sendFormWithReportEmail } = await import('../emailService');
      await sendFormWithReportEmail(sampleFormData, sampleRecommendationData);

      const params = mockEmailjsSend.mock.calls[0][2];
      expect(params.alerts_text).toContain('High hygiene area');
      expect(params.alerts_text).toContain('Consider eco-friendly');
      expect(params.alerts_html).toContain('<li>');
      expect(params.alerts_text).not.toBe('None');
    });

    test('generates product_details_html with table structure', async () => {
      const { sendFormWithReportEmail } = await import('../emailService');
      await sendFormWithReportEmail(sampleFormData, sampleRecommendationData);

      const params = mockEmailjsSend.mock.calls[0][2];
      expect(params.product_details_html).toContain('<table');
      expect(params.product_details_html).toContain('Ganga Maxx Disinfectant');
      expect(params.product_details_html).toContain('Ganga Maxx Hand Sanitizer');
      expect(params.product_details_html).toContain('Total Estimated Monthly Cost');
      expect(params.product_details_html).toContain('</table>');
    });

    test('includes total cost in product table footer', async () => {
      const { sendFormWithReportEmail } = await import('../emailService');
      await sendFormWithReportEmail(sampleFormData, sampleRecommendationData);

      const params = mockEmailjsSend.mock.calls[0][2];
      // Rs 24,050 should appear in the table footer
      expect(params.product_details_html).toContain('Rs 24,050');
    });
  });

  describe('edge cases for sendFormWithReportEmail', () => {
    beforeEach(async () => {
      setEnvVars({
        publicKey: 'pk_test',
        serviceId: 'svc_test',
        templateId: 'tmpl_test',
      });
      jest.resetModules();
    });

    test('handles empty items gracefully', async () => {
      mockEmailjsSend.mockResolvedValue({ status: 200, text: 'OK' });
      const { sendFormWithReportEmail } = await import('../emailService');
      const result = await sendFormWithReportEmail(sampleFormData, { items: [], total_estimated_cost: 0 });

      expect(result.success).toBe(true);
      const params = mockEmailjsSend.mock.calls[0][2];
      expect(params.item_count).toBe('0');
      expect(params.product_details_html).toBe('<p>No product recommendations.</p>');
    });

    test('handles empty form data (nulls/undefined)', async () => {
      mockEmailjsSend.mockResolvedValue({ status: 200, text: 'OK' });
      const { sendFormWithReportEmail } = await import('../emailService');
      const result = await sendFormWithReportEmail({}, {});

      expect(result.success).toBe(true);
      const params = mockEmailjsSend.mock.calls[0][2];
      expect(params.facility_name).toBeUndefined();
      expect(params.contact_name).toBe('N/A');
      expect(params.surface_types).toBe('N/A');
      expect(params.equipment).toBe('None selected');
      expect(params.preferences).toBe('None selected');
    });

    test('handles missing recommendation data gracefully', async () => {
      mockEmailjsSend.mockResolvedValue({ status: 200, text: 'OK' });
      const { sendFormWithReportEmail } = await import('../emailService');
      const result = await sendFormWithReportEmail(sampleFormData, undefined);

      expect(result.success).toBe(true);
      const params = mockEmailjsSend.mock.calls[0][2];
      expect(params.item_count).toBe('0');
      expect(params.alerts_text).toBe('None');
    });

    test('uses grossAggregatedCost over total_estimated_cost', async () => {
      mockEmailjsSend.mockResolvedValue({ status: 200, text: 'OK' });
      const { sendFormWithReportEmail } = await import('../emailService');
      const data = {
        items: sampleRecommendationData.items,
        grossAggregatedCost: 50000,
        total_estimated_cost: 24050,
      };
      const result = await sendFormWithReportEmail(sampleFormData, data);

      expect(result.success).toBe(true);
      const params = mockEmailjsSend.mock.calls[0][2];
      // Should use grossAggregatedCost (50000) instead of total_estimated_cost (24050)
      expect(params.total_cost).toContain('Rs 50,000');
    });
  });

  describe('when emailjs.send fails', () => {
    beforeEach(async () => {
      setEnvVars({
        publicKey: 'pk_test',
        serviceId: 'svc_test',
        templateId: 'tmpl_test',
      });
      jest.resetModules();
    });

    test('returns error result when emailjs.send throws', async () => {
      mockEmailjsSend.mockRejectedValue(new Error('Network error'));
      const { sendFormWithReportEmail } = await import('../emailService');
      const result = await sendFormWithReportEmail(sampleFormData, sampleRecommendationData);

      expect(result).toEqual({
        success: false,
        error: 'Network error',
      });
    });
  });
});

// ===========================================================================
// 4. sendReportToEmail
// ===========================================================================
describe('sendReportToEmail()', () => {
  const reportData = {
    institution_name: 'Test Hospital',
    institution_type: 'hospital',
    items: [
      {
        product_name: 'Ganga Maxx Disinfectant',
        product_id: 'prod-dsf-002',
        quantity_estimate: 25,
        unit: 'liters',
        unit_price: 450,
        base_price: 450,
        monthly_cost: 11250,
      },
    ],
    total_estimated_cost: 11250,
    summary: 'Custom summary for report',
    alerts: ['Important alert'],
  };

  describe('when not configured', () => {
    beforeEach(async () => {
      setEnvVars({ publicKey: '', serviceId: '', templateId: '' });
      jest.resetModules();
    });

    test('returns error without calling emailjs.send', async () => {
      const { sendReportToEmail } = await import('../emailService');
      const result = await sendReportToEmail('recipient@example.com', 'Recipient', reportData);

      expect(result).toEqual({
        success: false,
        error: 'EmailJS not configured',
      });
      expect(mockEmailjsSend).not.toHaveBeenCalled();
    });
  });

  describe('when configured and emailjs.send succeeds', () => {
    beforeEach(async () => {
      setEnvVars({
        publicKey: 'pk_test',
        serviceId: 'svc_test',
        templateId: 'tmpl_test',
      });
      jest.resetModules();
      mockEmailjsSend.mockResolvedValue({ status: 200, text: 'OK' });
    });

    test('returns success result', async () => {
      const { sendReportToEmail } = await import('../emailService');
      const result = await sendReportToEmail('recipient@example.com', 'Recipient', reportData);

      expect(result).toEqual({ success: true, status: 200, text: 'OK' });
    });

    test('calls emailjs.send with correct params', async () => {
      const { sendReportToEmail } = await import('../emailService');
      await sendReportToEmail('recipient@example.com', 'Recipient', reportData);

      expect(mockEmailjsSend).toHaveBeenCalledWith(
        'svc_test',
        'tmpl_test',
        expect.objectContaining({
          to_email: 'recipient@example.com',
          contact_name: 'Recipient',
          facility_name: 'Test Hospital',
          institution_type: 'hospital',
        })
      );
    });

    test('passes recommendation data correctly', async () => {
      const { sendReportToEmail } = await import('../emailService');
      await sendReportToEmail('recipient@example.com', 'Recipient', reportData);

      const params = mockEmailjsSend.mock.calls[0][2];
      expect(params.recommendation_summary).toBe('Custom summary for report');
      expect(params.total_cost).toContain('Rs 11,250');
      expect(params.item_count).toBe('1');
      expect(params.alerts_text).toContain('Important alert');
    });

    test('uses default name when recipientName is not provided', async () => {
      const { sendReportToEmail } = await import('../emailService');
      await sendReportToEmail('recipient@example.com', undefined, reportData);

      const params = mockEmailjsSend.mock.calls[0][2];
      expect(params.contact_name).toBe('Valued Customer');
    });

    test('uses default facility name when not provided', async () => {
      const { sendReportToEmail } = await import('../emailService');
      await sendReportToEmail('recipient@example.com', 'Recipient', {
        items: [],
        total_estimated_cost: 0,
      });

      const params = mockEmailjsSend.mock.calls[0][2];
      expect(params.facility_name).toBe('Your Facility');
    });

    test('generates product details table from items', async () => {
      const { sendReportToEmail } = await import('../emailService');
      await sendReportToEmail('recipient@example.com', 'Recipient', reportData);

      const params = mockEmailjsSend.mock.calls[0][2];
      expect(params.product_details_html).toContain('<table');
      expect(params.product_details_html).toContain('Ganga Maxx Disinfectant');
      expect(params.product_details_html).toContain('</table>');
    });

    test('handles empty items with fallback message', async () => {
      const { sendReportToEmail } = await import('../emailService');
      await sendReportToEmail('recipient@example.com', 'Recipient', {
        items: [],
        total_estimated_cost: 0,
      });

      const params = mockEmailjsSend.mock.calls[0][2];
      expect(params.product_details_html).toBe('<p>No product recommendations.</p>');
    });
  });

  describe('when emailjs.send fails', () => {
    beforeEach(async () => {
      setEnvVars({
        publicKey: 'pk_test',
        serviceId: 'svc_test',
        templateId: 'tmpl_test',
      });
      jest.resetModules();
    });

    test('returns error result on failure', async () => {
      mockEmailjsSend.mockRejectedValue(new Error('Service unavailable'));
      const { sendReportToEmail } = await import('../emailService');
      const result = await sendReportToEmail('recipient@example.com', 'Recipient', reportData);

      expect(result).toEqual({
        success: false,
        error: 'Service unavailable',
      });
    });
  });
});
