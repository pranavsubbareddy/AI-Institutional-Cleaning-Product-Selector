const { validateInstitutionInput, validatePagination } = require('../validation');

// ---------------------------------------------------------------------------
// Helper: create mock request/response objects
// ---------------------------------------------------------------------------
function mockReqRes(body = {}, query = {}) {
  const req = { body, query };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

// ---------------------------------------------------------------------------
// 1. validateInstitutionInput TESTS
// ---------------------------------------------------------------------------
describe('validateInstitutionInput', () => {
  const validBody = {
    name: 'Test Hospital',
    institution_type: 'hospital',
    area_size: 5000,
    surface_types: ['hard_floor', 'tile'],
    hygiene_standard: 'standard',
    budget: 'medium',
    contact_name: 'John Doe',
    contact_email: 'john@hospital.com',
    contact_phone: '+91-9876543210',
  };

  test('passes with valid input and calls next()', () => {
    const { req, res, next } = mockReqRes(validBody);
    validateInstitutionInput(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('converts area_size to number and trims name/contact', () => {
    const { req, res, next } = mockReqRes({
      ...validBody,
      name: '  Test Hospital  ',
      area_size: '5000',
      contact_name: '  John Doe  ',
      contact_email: '  john@hospital.com  ',
      contact_phone: '  +91-9876543210  ',
    });
    validateInstitutionInput(req, res, next);
    expect(req.body.area_size).toBe(5000);
    expect(req.body.name).toBe('Test Hospital');
    expect(req.body.contact_name).toBe('John Doe');
    expect(req.body.contact_email).toBe('john@hospital.com');
    expect(req.body.contact_phone).toBe('+91-9876543210');
    expect(next).toHaveBeenCalled();
  });

  describe('name validation', () => {
    test('rejects missing name', () => {
      const { req, res, next } = mockReqRes({ ...validBody, name: undefined });
      validateInstitutionInput(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.arrayContaining([expect.stringContaining('name')]),
        })
      );
    });

    test('rejects empty name', () => {
      const { req, res, next } = mockReqRes({ ...validBody, name: '' });
      validateInstitutionInput(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('rejects too short name', () => {
      const { req, res, next } = mockReqRes({ ...validBody, name: 'A' });
      validateInstitutionInput(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('rejects non-string name', () => {
      const { req, res, next } = mockReqRes({ ...validBody, name: 123 });
      validateInstitutionInput(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('institution_type validation', () => {
    test('rejects missing type', () => {
      const { req, res, next } = mockReqRes({ ...validBody, institution_type: undefined });
      validateInstitutionInput(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('rejects invalid type', () => {
      const { req, res, next } = mockReqRes({ ...validBody, institution_type: 'invalid_type' });
      validateInstitutionInput(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('accepts all valid types', () => {
      const types = ['hospital', 'school', 'hotel', 'office', 'restaurant', 'factory', 'warehouse', 'retail'];
      types.forEach(type => {
        const { req, res, next } = mockReqRes({ ...validBody, institution_type: type });
        validateInstitutionInput(req, res, next);
        expect(next).toHaveBeenCalled();
        next.mockClear();
        res.status.mockClear();
        res.json.mockClear();
      });
    });
  });

  describe('area_size validation', () => {
    test('rejects missing area_size', () => {
      const { req, res, next } = mockReqRes({ ...validBody, area_size: undefined });
      validateInstitutionInput(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('rejects null area_size', () => {
      const { req, res, next } = mockReqRes({ ...validBody, area_size: null });
      validateInstitutionInput(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('rejects zero area_size', () => {
      const { req, res, next } = mockReqRes({ ...validBody, area_size: 0 });
      validateInstitutionInput(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('rejects negative area_size', () => {
      const { req, res, next } = mockReqRes({ ...validBody, area_size: -100 });
      validateInstitutionInput(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('surface_types validation', () => {
    test('rejects missing surface_types', () => {
      const { req, res, next } = mockReqRes({ ...validBody, surface_types: undefined });
      validateInstitutionInput(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('rejects empty array', () => {
      const { req, res, next } = mockReqRes({ ...validBody, surface_types: [] });
      validateInstitutionInput(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('rejects non-array surface_types', () => {
      const { req, res, next } = mockReqRes({ ...validBody, surface_types: 'hard_floor' });
      validateInstitutionInput(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('rejects invalid surface types', () => {
      const { req, res, next } = mockReqRes({ ...validBody, surface_types: ['invalid_surface'] });
      validateInstitutionInput(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.arrayContaining([expect.stringContaining('Invalid surface types')]),
        })
      );
    });

    test('rejects partially invalid surface types', () => {
      const { req, res, next } = mockReqRes({ ...validBody, surface_types: ['hard_floor', 'invalid_type'] });
      validateInstitutionInput(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('accepts all valid surface types', () => {
      const surfaces = ['hard_floor', 'carpet', 'glass', 'tile', 'stainless_steel', 'wood', 'marble', 'countertop', 'porcelain', 'mirror', 'drain', 'air'];
      const { req, res, next } = mockReqRes({ ...validBody, surface_types: surfaces });
      validateInstitutionInput(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('hygiene_standard validation', () => {
    test('rejects missing hygiene_standard', () => {
      const { req, res, next } = mockReqRes({ ...validBody, hygiene_standard: undefined });
      validateInstitutionInput(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('rejects invalid hygiene level', () => {
      const { req, res, next } = mockReqRes({ ...validBody, hygiene_standard: 'extra_high' });
      validateInstitutionInput(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('accepts valid hygiene levels', () => {
      ['basic', 'standard', 'high', 'medical_grade'].forEach(level => {
        const { req, res, next } = mockReqRes({ ...validBody, hygiene_standard: level });
        validateInstitutionInput(req, res, next);
        expect(next).toHaveBeenCalled();
        next.mockClear();
        res.status.mockClear();
        res.json.mockClear();
      });
    });
  });

  describe('budget validation', () => {
    test('rejects missing budget', () => {
      const { req, res, next } = mockReqRes({ ...validBody, budget: undefined });
      validateInstitutionInput(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('rejects invalid budget', () => {
      const { req, res, next } = mockReqRes({ ...validBody, budget: 'ultra' });
      validateInstitutionInput(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('accepts valid budgets', () => {
      ['low', 'medium', 'high'].forEach(b => {
        const { req, res, next } = mockReqRes({ ...validBody, budget: b });
        validateInstitutionInput(req, res, next);
        expect(next).toHaveBeenCalled();
        next.mockClear();
        res.status.mockClear();
        res.json.mockClear();
      });
    });
  });

  describe('contact fields — now optional', () => {
    test('passes with all contact fields missing', () => {
      const { req, res, next } = mockReqRes({
        ...validBody,
        contact_name: undefined,
        contact_email: undefined,
        contact_phone: undefined,
      });
      validateInstitutionInput(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(400);
      // Contact fields should be sanitised to null when not provided
      expect(req.body.contact_name).toBeNull();
      expect(req.body.contact_email).toBeNull();
      expect(req.body.contact_phone).toBeNull();
    });

    test('passes with contact fields empty strings', () => {
      const { req, res, next } = mockReqRes({
        ...validBody,
        contact_name: '',
        contact_email: '',
        contact_phone: '',
      });
      validateInstitutionInput(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(400);
      // Empty strings are falsy → set to null
      expect(req.body.contact_name).toBeNull();
      expect(req.body.contact_email).toBeNull();
      expect(req.body.contact_phone).toBeNull();
    });

    test('passes with partial contact fields', () => {
      const { req, res, next } = mockReqRes({
        ...validBody,
        contact_name: 'Alice',
        contact_email: undefined,
        contact_phone: undefined,
      });
      validateInstitutionInput(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.contact_name).toBe('Alice');
      expect(req.body.contact_email).toBeNull();
      expect(req.body.contact_phone).toBeNull();
    });

    test('trims and sets contact fields when provided', () => {
      const { req, res, next } = mockReqRes({
        ...validBody,
        contact_name: '  Alice  ',
        contact_email: '  alice@test.com  ',
        contact_phone: '  +91-9999999999  ',
      });
      validateInstitutionInput(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.contact_name).toBe('Alice');
      expect(req.body.contact_email).toBe('alice@test.com');
      expect(req.body.contact_phone).toBe('+91-9999999999');
    });
  });

  describe('multiple validation errors', () => {
    test('returns all validation errors at once (contact fields no longer cause errors)', () => {
      const { req, res, next } = mockReqRes({
        name: 'X',
        institution_type: '',
        area_size: -5,
        surface_types: [],
        hygiene_standard: 'bogus',
        budget: '',
        contact_name: '',
        contact_email: 'bad',
        contact_phone: '',
      });
      validateInstitutionInput(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      const details = res.json.mock.calls[0][0].details;
      // Expect errors only for name, institution_type, area_size, surface_types, hygiene, budget
      // Contact fields are now optional so they should NOT produce error entries
      expect(details.length).toBeGreaterThanOrEqual(6);
      expect(details.length).toBeLessThanOrEqual(6);
      // Verify contact fields don't appear in the errors
      const allErrors = details.join(' ').toLowerCase();
      expect(allErrors).not.toContain('contact');
    });
  });
});

// ---------------------------------------------------------------------------
// 2. validatePagination TESTS
// ---------------------------------------------------------------------------
describe('validatePagination', () => {
  test('applies default page=1 and limit=10 when not provided', () => {
    const { req, res, next } = mockReqRes({}, {});
    validatePagination(req, res, next);
    expect(req.query.page).toBe(1);
    expect(req.query.limit).toBe(10);
    expect(next).toHaveBeenCalled();
  });

  test('parses page and limit from query', () => {
    const { req, res, next } = mockReqRes({}, { page: '3', limit: '20' });
    validatePagination(req, res, next);
    expect(req.query.page).toBe(3);
    expect(req.query.limit).toBe(20);
  });

  test('enforces minimum page of 1', () => {
    const { req, res, next } = mockReqRes({}, { page: '0', limit: '5' });
    validatePagination(req, res, next);
    expect(req.query.page).toBe(1);
  });

  test('enforces minimum limit of 1', () => {
    const { req, res, next } = mockReqRes({}, { page: '1', limit: '0' });
    validatePagination(req, res, next);
    expect(req.query.limit).toBe(10); // falls back to default
  });

  test('enforces maximum limit of 100', () => {
    const { req, res, next } = mockReqRes({}, { page: '1', limit: '500' });
    validatePagination(req, res, next);
    expect(req.query.limit).toBe(100);
  });

  test('handles negative page', () => {
    const { req, res, next } = mockReqRes({}, { page: '-5', limit: '10' });
    validatePagination(req, res, next);
    expect(req.query.page).toBe(1);
  });

  test('handles non-numeric page gracefully', () => {
    const { req, res, next } = mockReqRes({}, { page: 'abc', limit: '10' });
    validatePagination(req, res, next);
    expect(req.query.page).toBe(1);
  });
});
