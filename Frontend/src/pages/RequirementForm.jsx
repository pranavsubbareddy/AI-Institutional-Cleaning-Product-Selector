import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, INSTITUTION_TYPES, SURFACE_TYPES, HYGIENE_LEVELS, BUDGET_LEVELS } from '../services/api';

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
  { value: 'eco_friendly', label: 'Eco-Friendly', icon: '🌿' },
  { value: 'fragrance_free', label: 'Fragrance-Free', icon: '🚫' },
  { value: 'hypoallergenic', label: 'Hypoallergenic', icon: '🛡️' },
  { value: 'concentrated', label: 'Concentrated', icon: '⚡' },
  { value: 'ready_to_use', label: 'Ready-to-Use', icon: '💧' },
  { value: 'industrial_grade', label: 'Industrial Grade', icon: '🏭' },
];

const CERTIFICATION_OPTIONS = [
  { value: 'iso_9001', label: 'ISO 9001' },
  { value: 'iso_14001', label: 'ISO 14001' },
  { value: 'haccp', label: 'HACCP' },
  { value: 'gmp', label: 'GMP' },
  { value: 'osha', label: 'OSHA Compliant' },
  { value: 'green_seal', label: 'Green Seal Certified' },
];

const OPERATING_HOURS = [
  { value: 'day', label: 'Day (6AM-6PM)' },
  { value: 'night', label: 'Night (6PM-6AM)' },
  { value: '24x7', label: '24x7 Operation' },
  { value: 'business', label: 'Business Hours (9-5)' },
];

export default function RequirementForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);

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
    // Advanced fields
    floors: 1,
    occupants: 50,
    operating_hours: 'day',
    cleaning_frequency: 'daily',
    facility_age: 'moderate',
    equipment: [],
    preferences: [],
    certifications: [],
    special_requirements: '',
    facility_description: '',
    current_products: '',
  });

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
    setLoading(true);
    setError('');

    try {
      const response = await api.createInstitution({
        name: formData.name,
        institution_type: formData.institution_type,
        area_size: Number(formData.area_size),
        surface_types: formData.surface_types,
        hygiene_standard: formData.hygiene_standard,
        budget: formData.budget,
        contact_name: formData.contact_name || null,
        contact_email: formData.contact_email || null,
        contact_phone: formData.contact_phone || null,
        address: formData.address || null,
        metadata: {
          floors: formData.floors,
          occupants: formData.occupants,
          operating_hours: formData.operating_hours,
          cleaning_frequency: formData.cleaning_frequency,
          facility_age: formData.facility_age,
          equipment: formData.equipment,
          preferences: formData.preferences,
          certifications: formData.certifications,
          special_requirements: formData.special_requirements || null,
          facility_description: formData.facility_description || null,
          current_products: formData.current_products || null,
        },
      });

      const institutionId = response.data.id;
      const recResponse = await api.processRecommendation(institutionId);

      navigate('/recommendations/' + recResponse.data.recommendation.id);
    } catch (err) {
      setError(err.message || 'Failed to process request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isValid = formData.name && formData.institution_type && formData.area_size > 0 && formData.surface_types.length > 0;
  const stepLabels = ['Facility Info', 'Requirements', 'Preferences', 'Review'];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
        <div className="flex space-x-3 mb-8">
          <div className="loading-dot w-4 h-4 bg-cyan-500 rounded-full"></div>
          <div className="loading-dot w-4 h-4 bg-emerald-500 rounded-full"></div>
          <div className="loading-dot w-4 h-4 bg-cyan-500 rounded-full"></div>
        </div>
        <div className="card p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-surface-100 mb-3">Generating Recommendations</h3>
          <p className="text-surface-400 leading-relaxed">Analyzing your facility requirements with our AI engine...</p>
          <div className="mt-6 w-full bg-surface-700 rounded-full h-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-cyan-500 to-emerald-500 h-1.5 rounded-full animate-pulse" style={{ width: '60%' }}></div>
          </div>
          <div className="mt-4 text-xs text-surface-500 space-y-1">
            <p>✓ Facility profile created</p>
            <p className="animate-pulse">⟳ Matching products to your requirements...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-surface-100 mb-2">New Facility Requirement</h1>
        <p className="text-surface-400">Enter your facility details to get AI-powered cleaning product recommendations.</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center mb-8 overflow-x-auto pb-2">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className="flex items-center flex-shrink-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all duration-300 ${
              step >= s 
                ? 'bg-gradient-to-br from-cyan-500 to-emerald-500 text-white shadow-lg shadow-cyan-500/20' 
                : 'bg-surface-700 text-surface-400 border border-surface-600'
            }`}>
              {step > s ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : s}
            </div>
            {s < 4 && (
              <div className={`w-12 sm:w-20 h-1 mx-2 rounded-full transition-all duration-300 ${
                step > s ? 'bg-gradient-to-r from-cyan-500 to-emerald-500' : 'bg-surface-700'
              }`}></div>
            )}
          </div>
        ))}
        <div className="ml-3 text-sm text-surface-400 flex-shrink-0">
          {stepLabels[step - 1]}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-6 md:p-8">
        {/* Step 1: Facility Info */}
        {step === 1 && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <label className="label">Facility / Institution Name *</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange}
                className="input-field" placeholder="e.g., City General Hospital, Delhi Public School" required />
            </div>
            <div>
              <label className="label">Institution Type *</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {INSTITUTION_TYPES.map(type => (
                  <button key={type.value} type="button"
                    onClick={() => setFormData(prev => ({ ...prev, institution_type: type.value }))}
                    className={`p-4 rounded-xl border text-center transition-all duration-200 ${
                      formData.institution_type === type.value 
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/30' 
                        : 'border-surface-600 hover:border-surface-500 bg-surface-700/50 text-surface-300 hover:text-surface-200'
                    }`}>
                    <span className="text-2xl block mb-1.5">{type.icon}</span>
                    <span className="text-[11px] font-medium leading-tight block">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Total Area Size (sq. ft.) *</label>
                <div className="relative">
                  <input type="number" name="area_size" value={formData.area_size} onChange={handleChange}
                    className="input-field pl-8" placeholder="e.g., 10000" min="100" required />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm">📐</span>
                </div>
                <p className="text-xs text-surface-500 mt-1.5">Include all cleanable floor space</p>
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
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div>
              <label className="label">Facility Description (Optional)</label>
              <textarea name="facility_description" value={formData.facility_description} onChange={handleChange}
                className="input-field" rows="2" placeholder="Brief description of your facility..."></textarea>
            </div>
          </div>
        )}

        {/* Step 2: Requirements */}
        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Hygiene Standard Required</label>
                <div className="grid grid-cols-2 gap-2">
                  {HYGIENE_LEVELS.map(level => (
                    <button key={level.value} type="button"
                      onClick={() => setFormData(prev => ({ ...prev, hygiene_standard: level.value }))}
                      className={`px-4 py-3 rounded-xl border text-center transition-all duration-200 ${
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
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Current Cleaning Frequency</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {FREQUENCY_OPTIONS.map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setFormData(prev => ({ ...prev, cleaning_frequency: opt.value }))}
                      className={`py-2.5 px-2 rounded-lg border text-xs transition-all ${
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
            </div>
          </div>
        )}

        {/* Step 3: Preferences & Equipment */}
        {step === 3 && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <label className="label text-base">Available Cleaning Equipment</label>
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
              <label className="label text-base">Product Preferences</label>
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

            <div>
              <label className="label text-base">Industry Certifications / Compliance</label>
              <p className="text-xs text-surface-500 mb-3">Select certifications your facility requires</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CERTIFICATION_OPTIONS.map(item => (
                  <button key={item.value} type="button"
                    onClick={() => handleToggle('certifications', item.value)}
                    className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 ${
                      formData.certifications.includes(item.value) 
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/30' 
                        : 'border-surface-600 hover:border-surface-500 bg-surface-700/50 text-surface-300'
                    }`}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Contact Section */}
            <div className="pt-4 border-t border-surface-700">
              <h3 className="text-base font-semibold text-surface-100 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Contact Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Contact Person</label>
                  <input type="text" name="contact_name" value={formData.contact_name} onChange={handleChange}
                    className="input-field" placeholder="e.g., John Doe" />
                </div>
                <div>
                  <label className="label">Email Address</label>
                  <input type="email" name="contact_email" value={formData.contact_email} onChange={handleChange}
                    className="input-field" placeholder="john@hospital.com" />
                </div>
                <div>
                  <label className="label">Phone Number</label>
                  <input type="tel" name="contact_phone" value={formData.contact_phone} onChange={handleChange}
                    className="input-field" placeholder="+91-9876543210" />
                </div>
                <div>
                  <label className="label">Facility Address</label>
                  <input type="text" name="address" value={formData.address} onChange={handleChange}
                    className="input-field" placeholder="Facility address" />
                </div>
              </div>
            </div>

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
        )}

        {/* Step 4: Review & Submit */}
        {step === 4 && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-surface-100">Review Your Requirements</h3>
                <p className="text-sm text-surface-400">Please verify all details before submitting</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-surface-700/30 rounded-xl p-4 border border-surface-600/50">
                <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Facility Info</h4>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between"><dt className="text-surface-400">Name</dt><dd className="text-surface-200 font-medium">{formData.name}</dd></div>
                  <div className="flex justify-between"><dt className="text-surface-400">Type</dt><dd className="text-surface-200 capitalize">{formData.institution_type}</dd></div>
                  <div className="flex justify-between"><dt className="text-surface-400">Area</dt><dd className="text-surface-200">{Number(formData.area_size).toLocaleString()} sq. ft.</dd></div>
                  <div className="flex justify-between"><dt className="text-surface-400">Floors</dt><dd className="text-surface-200">{formData.floors}</dd></div>
                  <div className="flex justify-between"><dt className="text-surface-400">Occupants</dt><dd className="text-surface-200">{formData.occupants}+</dd></div>
                  <div className="flex justify-between"><dt className="text-surface-400">Hours</dt><dd className="text-surface-200 capitalize">{OPERATING_HOURS.find(o=>o.value===formData.operating_hours)?.label||formData.operating_hours}</dd></div>
                </dl>
              </div>
              <div className="bg-surface-700/30 rounded-xl p-4 border border-surface-600/50">
                <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Requirements</h4>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between"><dt className="text-surface-400">Surfaces</dt><dd className="text-surface-200">{formData.surface_types.length} selected</dd></div>
                  <div className="flex justify-between"><dt className="text-surface-400">Hygiene</dt><dd className="text-surface-200 capitalize">{formData.hygiene_standard}</dd></div>
                  <div className="flex justify-between"><dt className="text-surface-400">Budget</dt><dd className="text-surface-200 capitalize">{formData.budget}</dd></div>
                  <div className="flex justify-between"><dt className="text-surface-400">Frequency</dt><dd className="text-surface-200 capitalize">{FREQUENCY_OPTIONS.find(o=>o.value===formData.cleaning_frequency)?.label||formData.cleaning_frequency}</dd></div>
                  <div className="flex justify-between"><dt className="text-surface-400">Age</dt><dd className="text-surface-200 capitalize">{AGE_OPTIONS.find(o=>o.value===formData.facility_age)?.label||formData.facility_age}</dd></div>
                </dl>
              </div>
            </div>

            {(formData.equipment.length > 0 || formData.preferences.length > 0 || formData.certifications.length > 0) && (
              <div className="bg-surface-700/30 rounded-xl p-4 border border-surface-600/50">
                <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Preferences & Equipment</h4>
                <div className="flex flex-wrap gap-2">
                  {formData.equipment.map(e => <span key={e} className="badge bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{EQUIPMENT_OPTIONS.find(o=>o.value===e)?.label||e}</span>)}
                  {formData.preferences.map(p => <span key={p} className="badge bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">{PREFERENCES_OPTIONS.find(o=>o.value===p)?.icon} {PREFERENCES_OPTIONS.find(o=>o.value===p)?.label||p}</span>)}
                  {formData.certifications.map(c => <span key={c} className="badge bg-purple-500/10 text-purple-400 border border-purple-500/20">{CERTIFICATION_OPTIONS.find(o=>o.value===c)?.label||c}</span>)}
                </div>
              </div>
            )}

            {formData.contact_name && (
              <div className="bg-surface-700/30 rounded-xl p-4 border border-surface-600/50">
                <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Contact</h4>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between"><dt className="text-surface-400">Person</dt><dd className="text-surface-200">{formData.contact_name}</dd></div>
                  {formData.contact_email && <div className="flex justify-between"><dt className="text-surface-400">Email</dt><dd className="text-surface-200">{formData.contact_email}</dd></div>}
                  {formData.contact_phone && <div className="flex justify-between"><dt className="text-surface-400">Phone</dt><dd className="text-surface-200">{formData.contact_phone}</dd></div>}
                </dl>
              </div>
            )}

            {formData.special_requirements && (
              <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/20">
                <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">Special Requirements</h4>
                <p className="text-sm text-amber-300">{formData.special_requirements}</p>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-6 border-t border-surface-700">
          <div>
            {step > 1 ? (
              <button type="button" onClick={() => setStep(step - 1)} className="btn-secondary">
                <svg className="w-4 h-4 inline mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>
            ) : (
              <button type="button" onClick={() => navigate('/')} className="btn-secondary">
                <svg className="w-4 h-4 inline mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Cancel
              </button>
            )}
          </div>
          
          <div className="flex gap-3">
            {step < 4 ? (
              <button type="button" onClick={() => setStep(step + 1)} className="btn-primary"
                disabled={step === 1 && (!formData.name || !formData.institution_type || !formData.area_size)}>
                Next
                <svg className="w-4 h-4 inline ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <button type="submit" disabled={!isValid || loading} className="btn-success shadow-lg shadow-emerald-500/20">
                <svg className="w-4 h-4 inline mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                Generate Recommendations
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
