import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, INSTITUTION_TYPES, SURFACE_TYPES, HYGIENE_LEVELS, BUDGET_LEVELS } from '../services/api';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

const FLOOR_OPTIONS = [
  { value: 1, label: 'Single Floor' },
  { value: 2, label: '2-3 Floors' },
  { value: 4, label: '4-6 Floors' },
  { value: 7, label: '7-10 Floors' },
  { value: 11, label: '10+ Floors' },
];

const OCCUPANT_OPTIONS = [
  { value: 10, label: 'Under 50' },
  { value: 50, label: '50-200' },
  { value: 200, label: '200-500' },
  { value: 500, label: '500-1000' },
  { value: 1000, label: '1000+' },
];

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily', desc: 'Once per day' },
  { value: 'twice_daily', label: 'Twice Daily', desc: 'Morning & evening' },
  { value: 'weekly', label: 'Weekly', desc: 'Once per week' },
  { value: 'multiple_weekly', label: 'Multiple/Week', desc: '2-4 times per week' },
  { value: 'custom', label: 'As Needed', desc: 'On-demand cleaning' },
];

const AGE_OPTIONS = [
  { value: 'new', label: 'New (0-5 yrs)' },
  { value: 'moderate', label: 'Moderate (5-15 yrs)' },
  { value: 'old', label: 'Old (15-30 yrs)' },
  { value: 'vintage', label: 'Vintage (30+ yrs)' },
];

const EQUIPMENT_OPTIONS = [
  { value: 'mop', label: 'Mop & Bucket' },
  { value: 'vacuum', label: 'Vacuum Cleaner' },
  { value: 'scrubber', label: 'Floor Scrubber' },
  { value: 'pressure_washer', label: 'Pressure Washer' },
  { value: 'steam_cleaner', label: 'Steam Cleaner' },
  { value: 'carpet_extractor', label: 'Carpet Extractor' },
  { value: 'microfiber', label: 'Microfiber Cloths' },
  { value: 'auto_dispenser', label: 'Auto Dispenser' },
];

const PREFERENCES_OPTIONS = [
  { value: 'eco_friendly', label: 'Eco-Friendly', icon: '\🌿' },
  { value: 'fragrance_free', label: 'Fragrance-Free', icon: '\🚫' },
  { value: 'hypoallergenic', label: 'Hypoallergenic', icon: '\U0001f6e1\ufe0f' },
  { value: 'concentrated', label: 'Concentrated', icon: '\u26a1' },
  { value: 'ready_to_use', label: 'Ready-to-Use', icon: '\💧' },
  { value: 'industrial_grade', label: 'Industrial Grade', icon: '\🏭' },
];

const OPERATING_HOURS = [
  { value: 'day', label: 'Day (6AM-6PM)' },
  { value: 'night', label: 'Night (6PM-6AM)' },
  { value: '24x7', label: '24x7 Operation' },
  { value: 'business', label: 'Business Hours (9-5)' },
];

export default function EditInstitution() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    institution_type: '',
    area_size: '',
    surface_types: [],
    hygiene_standard: 'standard',
    budget: 'medium',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    floors: 1,
    occupants: 50,
    operating_hours: 'day',
    cleaning_frequency: 'daily',
    facility_age: 'moderate',
    equipment: [],
    preferences: [],
    special_requirements: '',
    facility_description: '',
    current_products: '',
  });

  useEffect(() => {
    loadInstitution();
  }, [id]);

  const loadInstitution = async () => {
    try {
      setFetching(true);
      const res = await api.getInstitution(id);
      const d = res.data;
      const m = d.metadata || {};

      setFormData({
        name: d.name || '',
        institution_type: d.institution_type || '',
        area_size: d.area_size || '',
        surface_types: d.surface_types || [],
        hygiene_standard: d.hygiene_standard || 'standard',
        budget: d.budget || 'medium',
        contact_name: d.contact_name || '',
        contact_email: d.contact_email || '',
        contact_phone: d.contact_phone || '',
        address: d.address || '',
        floors: m.floors || 1,
        occupants: m.occupants || 50,
        operating_hours: m.operating_hours || 'day',
        cleaning_frequency: m.cleaning_frequency || 'daily',
        facility_age: m.facility_age || 'moderate',
        equipment: m.equipment || [],
        preferences: m.preferences || [],
        special_requirements: m.special_requirements || '',
        facility_description: m.facility_description || '',
        current_products: m.current_products || '',
      });
    } catch (err) {
      setError(err.message || 'Failed to load institution');
    } finally {
      setLoading(false);
      setFetching(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleToggle = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(v => v !== value)
        : [...prev[field], value]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await api.updateInstitution(id, {
        name: formData.name,
        institution_type: formData.institution_type,
        area_size: Number(formData.area_size),
        surface_types: formData.surface_types,
        hygiene_standard: formData.hygiene_standard,
        budget: formData.budget,
        contact_name: formData.contact_name,
        contact_email: formData.contact_email,
        contact_phone: formData.contact_phone,
        address: formData.address || null,
        metadata: {
          floors: formData.floors,
          occupants: formData.occupants,
          operating_hours: formData.operating_hours,
          cleaning_frequency: formData.cleaning_frequency,
          facility_age: formData.facility_age,
          equipment: formData.equipment,
          preferences: formData.preferences,
          special_requirements: formData.special_requirements || null,
          facility_description: formData.facility_description || null,
          current_products: formData.current_products || null,
        },
      });

      setSuccess('Facility updated successfully!');
      setTimeout(() => navigate(`/detail/${id}`), 1200);
    } catch (err) {
      setError(err.message || 'Failed to update institution');
    } finally {
      setSaving(false);
    }
  };

  const isValid = formData.name && formData.institution_type && formData.area_size > 0 && formData.surface_types.length > 0;

  if (loading) return <LoadingState message="Loading facility details..." />;
  if (error && !fetching && !formData.name) return <ErrorState message={error} onRetry={loadInstitution} />;

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="mb-6">
        <button onClick={() => navigate(`/detail/${id}`)}
          className="text-sm text-cyan-400 hover:text-cyan-300 mb-2 inline-flex items-center gap-1 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Details
        </button>
        <h1 className="text-2xl font-bold text-surface-100">Edit Facility</h1>
        <p className="text-surface-400 mt-1">Update facility details for <span className="text-surface-200 font-medium">{formData.name || '...'}</span></p>
      </div>

      {success && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-sm flex items-center gap-2">
          <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {success}
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm flex items-center gap-2">
          <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-6 md:p-8">
        {/* Facility Name & Type */}
        <h2 className="text-base font-semibold text-surface-100 mb-5 flex items-center gap-2">
          <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          Facility Information
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div>
            <label className="label">Facility / Institution Name *</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange}
              className="input-field" placeholder="e.g., City General Hospital" required />
          </div>
          <div>
            <label className="label">Institution Type *</label>
            <select name="institution_type" value={formData.institution_type} onChange={handleChange}
              className="input-field" required>
              <option value="">Select type...</option>
              {INSTITUTION_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Total Area Size (sq. ft.) *</label>
            <input type="number" name="area_size" value={formData.area_size} onChange={handleChange}
              className="input-field" placeholder="e.g., 10000" min="100" required />
          </div>
          <div>
            <label className="label">Number of Floors / Levels</label>
            <div className="grid grid-cols-5 gap-1.5">
              {FLOOR_OPTIONS.map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setFormData(prev => ({ ...prev, floors: opt.value }))}
                  className={`py-2 px-1 rounded-lg border text-xs font-medium transition-all ${
                    formData.floors === opt.value
                      ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                      : 'border-surface-600 hover:border-surface-500 bg-surface-700/50 text-surface-300'
                  }`}>{opt.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Approx. Occupant / Staff Capacity</label>
            <div className="grid grid-cols-5 gap-1.5">
              {OCCUPANT_OPTIONS.map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setFormData(prev => ({ ...prev, occupants: opt.value }))}
                  className={`py-2 px-1 rounded-lg border text-xs font-medium transition-all ${
                    formData.occupants === opt.value
                      ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                      : 'border-surface-600 hover:border-surface-500 bg-surface-700/50 text-surface-300'
                  }`}>{opt.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Operating Hours</label>
            <div className="grid grid-cols-2 gap-1.5">
              {OPERATING_HOURS.map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setFormData(prev => ({ ...prev, operating_hours: opt.value }))}
                  className={`py-2 px-2 rounded-lg border text-xs font-medium transition-all ${
                    formData.operating_hours === opt.value
                      ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                      : 'border-surface-600 hover:border-surface-500 bg-surface-700/50 text-surface-300'
                  }`}>{opt.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Surface Types & Requirements */}
        <h2 className="text-base font-semibold text-surface-100 mb-5 flex items-center gap-2">
          <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Requirements
        </h2>
        <div className="space-y-4 mb-8">
          <div>
            <label className="label">Surface Types *</label>
            <p className="text-xs text-surface-500 mb-3">Select all surfaces that need cleaning</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SURFACE_TYPES.map(surface => (
                <button key={surface.value} type="button"
                  onClick={() => handleToggle('surface_types', surface.value)}
                  className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 ${
                    formData.surface_types.includes(surface.value)
                      ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/30'
                      : 'border-surface-600 hover:border-surface-500 bg-surface-700/50 text-surface-300'
                  }`}>
                  {surface.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Hygiene Standard</label>
              <div className="grid grid-cols-2 gap-2">
                {HYGIENE_LEVELS.map(level => (
                  <button key={level.value} type="button"
                    onClick={() => setFormData(prev => ({ ...prev, hygiene_standard: level.value }))}
                    className={`px-3 py-3 rounded-xl border text-center transition-all duration-200 ${
                      formData.hygiene_standard === level.value
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/30'
                        : 'border-surface-600 hover:border-surface-500 bg-surface-700/50 text-surface-300'
                    }`}>
                    <span className="text-sm font-medium">{level.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Budget Level</label>
              <div className="grid grid-cols-3 gap-2">
                {BUDGET_LEVELS.map(level => (
                  <button key={level.value} type="button"
                    onClick={() => setFormData(prev => ({ ...prev, budget: level.value }))}
                    className={`px-3 py-4 rounded-xl border text-center transition-all duration-200 ${
                      formData.budget === level.value
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/30'
                        : 'border-surface-600 hover:border-surface-500 bg-surface-700/50 text-surface-300'
                    }`}>
                    <span className="text-xl block mb-1">{level.icon}</span>
                    <span className="text-[11px] font-medium leading-tight block">{level.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Cleaning Frequency</label>
              <div className="grid grid-cols-1 gap-1.5">
                {FREQUENCY_OPTIONS.map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setFormData(prev => ({ ...prev, cleaning_frequency: opt.value }))}
                    className={`py-2 px-3 rounded-lg border text-xs transition-all ${
                      formData.cleaning_frequency === opt.value
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                        : 'border-surface-600 hover:border-surface-500 bg-surface-700/50 text-surface-300'
                    }`}>
                    <span className="font-medium block">{opt.label}</span>
                    <span className="text-[10px] text-surface-500 mt-0.5 block">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Facility Age / Condition</label>
              <div className="grid grid-cols-2 gap-1.5">
                {AGE_OPTIONS.map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setFormData(prev => ({ ...prev, facility_age: opt.value }))}
                    className={`py-2.5 px-2 rounded-lg border text-xs font-medium transition-all ${
                      formData.facility_age === opt.value
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                        : 'border-surface-600 hover:border-surface-500 bg-surface-700/50 text-surface-300'
                    }`}>{opt.label}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Facility Description</label>
              <textarea name="facility_description" value={formData.facility_description} onChange={handleChange}
                className="input-field" rows="3" placeholder="Brief description of your facility..."></textarea>
            </div>
          </div>
        </div>

        {/* Equipment & Preferences */}
        <h2 className="text-base font-semibold text-surface-100 mb-5 flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Equipment & Preferences
        </h2>
        <div className="space-y-4 mb-8">
          <div>
            <label className="label">Available Cleaning Equipment</label>
            <p className="text-xs text-surface-500 mb-3">Select equipment already available at your facility</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {EQUIPMENT_OPTIONS.map(item => (
                <button key={item.value} type="button"
                  onClick={() => handleToggle('equipment', item.value)}
                  className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 ${
                    formData.equipment.includes(item.value)
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30'
                      : 'border-surface-600 hover:border-surface-500 bg-surface-700/50 text-surface-300'
                  }`}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Product Preferences</label>
            <p className="text-xs text-surface-500 mb-3">Select preferred product attributes</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PREFERENCES_OPTIONS.map(item => (
                <button key={item.value} type="button"
                  onClick={() => handleToggle('preferences', item.value)}
                  className={`px-3 py-3 rounded-xl border text-sm font-medium transition-all duration-200 ${
                    formData.preferences.includes(item.value)
                      ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/30'
                      : 'border-surface-600 hover:border-surface-500 bg-surface-700/50 text-surface-300'
                  }`}>
                  <span className="mr-1.5">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Address */}
        <h2 className="text-base font-semibold text-surface-100 mb-5 flex items-center gap-2">
          <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Facility Address
        </h2>
        <div className="mb-8">
          <input type="text" name="address" value={formData.address} onChange={handleChange}
            className="input-field" placeholder="Facility address" />
        </div>

        {/* Special Requirements */}
        <div className="space-y-4 mb-8">
          <div>
            <label className="label">Special Requirements or Notes</label>
            <textarea name="special_requirements" value={formData.special_requirements} onChange={handleChange}
              className="input-field" rows="3" placeholder="Any specific requirements, challenges, or notes about your facility..."></textarea>
          </div>
          <div>
            <label className="label">Current Products Used (Optional)</label>
            <textarea name="current_products" value={formData.current_products} onChange={handleChange}
              className="input-field" rows="2" placeholder="List any cleaning products you currently use or brands you prefer..."></textarea>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-6 border-t border-surface-700">
          <button type="button" onClick={() => navigate(`/detail/${id}`)} className="btn-secondary">
            <svg className="w-4 h-4 inline mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Cancel
          </button>
          <button type="submit" disabled={!isValid || saving}
            className="btn-success shadow-lg shadow-emerald-500/20">
            {saving ? (
              <>
                <svg className="w-4 h-4 inline mr-1.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving Changes...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 inline mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
