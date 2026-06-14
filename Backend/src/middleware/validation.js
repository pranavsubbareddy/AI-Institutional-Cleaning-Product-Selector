function validateInstitutionInput(req, res, next) {
  const { name, institution_type, area_size, surface_types, hygiene_standard, budget, contact_name, contact_email, contact_phone } = req.body;
  const errors = [];

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Institution name is required (min 2 characters)');
  }

  const validTypes = ['hospital', 'school', 'hotel', 'office', 'restaurant', 'factory', 'warehouse', 'retail', 'gym', 'laboratory', 'pharmacy', 'airport', 'shopping_mall', 'cinema', 'library', 'community_center'];
  if (!institution_type || !validTypes.includes(institution_type)) {
    errors.push(`Institution type must be one of: ${validTypes.join(', ')}`);
  }

  if (area_size === undefined || area_size === null || isNaN(Number(area_size)) || Number(area_size) <= 0) {
    errors.push('Area size must be a positive number');
  }

  const validSurfaces = ['hard_floor', 'carpet', 'glass', 'tile', 'stainless_steel', 'wood', 'marble', 'countertop', 'porcelain', 'mirror', 'drain', 'air'];
  if (!surface_types || !Array.isArray(surface_types) || surface_types.length === 0) {
    errors.push('At least one surface type is required');
  } else {
    const invalidSurfaces = surface_types.filter(s => !validSurfaces.includes(s));
    if (invalidSurfaces.length > 0) {
      errors.push(`Invalid surface types: ${invalidSurfaces.join(', ')}. Valid: ${validSurfaces.join(', ')}`);
    }
  }

  const validHygiene = ['basic', 'standard', 'high', 'medical_grade'];
  if (!hygiene_standard || !validHygiene.includes(hygiene_standard)) {
    errors.push(`Hygiene standard must be one of: ${validHygiene.join(', ')}`);
  }

  const validBudgets = ['low', 'medium', 'high'];
  if (!budget || !validBudgets.includes(budget)) {
    errors.push(`Budget must be one of: ${validBudgets.join(', ')}`);
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors,
      timestamp: new Date().toISOString()
    });
  }

  // Sanitize and convert
  req.body.area_size = Number(area_size);
  req.body.name = name.trim();
  req.body.contact_name = contact_name ? contact_name.trim() : null;
  req.body.contact_email = contact_email ? contact_email.trim() : null;
  req.body.contact_phone = contact_phone ? contact_phone.trim() : null;
  next();
}

function validatePagination(req, res, next) {
  let page = parseInt(req.query.page) || 1;
  let limit = parseInt(req.query.limit) || 10;

  if (page < 1) page = 1;
  if (limit < 1) limit = 10;
  if (limit > 100) limit = 100;

  req.query.page = page;
  req.query.limit = limit;
  next();
}

module.exports = { validateInstitutionInput, validatePagination };
