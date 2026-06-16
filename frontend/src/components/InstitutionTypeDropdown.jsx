import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { INSTITUTION_TYPES } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';

const CUSTOM_OPTION = { value: 'custom', label: 'Custom (type your own)', icon: '\u270f\ufe0f' };
const ALL_OPTIONS = [...INSTITUTION_TYPES.filter(t => t.value !== 'custom'), CUSTOM_OPTION];

export default function InstitutionTypeDropdown({ value, onChange, error, required = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (value) {
      const matchedPreset = INSTITUTION_TYPES.some(t => t.value === value);
      if (!matchedPreset && value !== '') {
        setIsCustom(true);
        setCustomValue(value);
      } else {
        setIsCustom(value === 'custom');
      }
    } else {
      setIsCustom(false);
      setCustomValue('');
    }
  }, [value]);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return ALL_OPTIONS;
    const q = search.toLowerCase();
    return ALL_OPTIONS.filter(opt => opt.label.toLowerCase().includes(q) || opt.icon.includes(q));
  }, [search]);

  const displayLabel = useMemo(() => {
    if (!value) return 'Select institution type...';
    const preset = INSTITUTION_TYPES.find(t => t.value === value);
    if (preset) return preset.icon + ' ' + preset.label;
    return 'Custom: ' + value;
  }, [value]);

  const displayIcon = useMemo(() => {
    if (!value) return null;
    const preset = INSTITUTION_TYPES.find(t => t.value === value);
    return preset?.icon || '\u270f\ufe0f';
  }, [value]);

  const isSelected = (optValue) => {
    if (optValue === 'custom') return isCustom;
    return value === optValue;
  };

  const handleSelect = useCallback((optValue) => {
    if (optValue === 'custom') {
      setIsCustom(true);
      onChange('custom');
      setSearch('');
      setTimeout(() => {
        const customInput = containerRef.current?.querySelector('.custom-type-input');
        if (customInput) customInput.focus();
      }, 100);
    } else {
      setIsCustom(false);
      setCustomValue('');
      onChange(optValue);
      setIsOpen(false);
      setSearch('');
    }
    setActiveIndex(-1);
  }, [onChange]);

  const handleCustomChange = useCallback((e) => {
    const val = e.target.value;
    setCustomValue(val);
    onChange(val);
  }, [onChange]);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setSearch('');
    setActiveIndex(-1);
    setTimeout(() => {
      if (searchInputRef.current) searchInputRef.current.focus();
    }, 50);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSearch('');
    setActiveIndex(-1);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) handleClose();
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, handleClose]);

  const handleKeyDown = useCallback((e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        handleOpen();
      }
      return;
    }
    switch (e.key) {
      case 'Escape': e.preventDefault(); handleClose(); break;
      case 'ArrowDown': e.preventDefault(); setActiveIndex(prev => prev < filteredOptions.length - 1 ? prev + 1 : 0); break;
      case 'ArrowUp': e.preventDefault(); setActiveIndex(prev => prev > 0 ? prev - 1 : filteredOptions.length - 1); break;
      case 'Enter': e.preventDefault(); if (activeIndex >= 0 && activeIndex < filteredOptions.length) handleSelect(filteredOptions[activeIndex].value); break;
      case 'Tab': handleClose(); break;
    }
  }, [isOpen, activeIndex, filteredOptions, handleOpen, handleClose, handleSelect]);

  const highlightText = (text, query) => {
    if (!query.trim()) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <span className="text-cyan-300 bg-cyan-500/20 rounded px-0.5">{text.slice(idx, idx + query.length)}</span>
        {text.slice(idx + query.length)}
      </>
    );
  };

  const groupedOptions = useMemo(() => {
    const presets = filteredOptions.filter(o => o.value !== 'custom');
    const custom = filteredOptions.filter(o => o.value === 'custom');
    return { presets, custom };
  }, [filteredOptions]);

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={() => isOpen ? handleClose() : handleOpen()}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-200 ${isOpen ? 'border-cyan-500 bg-surface-800 ring-1 ring-cyan-500/30 shadow-lg shadow-cyan-500/5' : value ? 'border-surface-600 bg-surface-700/80 hover:border-surface-500' : 'border-surface-600 bg-surface-700/50 hover:border-surface-500'} ${error ? 'border-red-500 ring-1 ring-red-500/30' : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="text-xl flex-shrink-0 w-8 h-8 rounded-lg bg-surface-700 flex items-center justify-center">
          {displayIcon || (
            <svg className="w-4 h-4 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          )}
        </span>
        <span className={`flex-1 text-sm truncate ${value ? 'text-surface-200' : 'text-surface-400'}`}>
          {displayLabel}
        </span>
        {required && !value && (
          <span className="text-[10px] font-semibold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full flex-shrink-0">Required</span>
        )}
        <motion.svg animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }} className="w-4 h-4 text-surface-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute z-50 mt-2 w-full bg-surface-800 border border-surface-600 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden"
          >
            <div className="p-3 border-b border-surface-700">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input ref={searchInputRef} type="text" value={search} onChange={(e) => { setSearch(e.target.value); setActiveIndex(-1); }} placeholder="Search institution types..." className="w-full pl-9 pr-3 py-2.5 bg-surface-700/50 border border-surface-600 rounded-xl text-sm text-surface-200 placeholder-surface-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all" />
                {search && (
                  <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-200 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div ref={listRef} className="overflow-y-auto" style={{ maxHeight: '320px' }} role="listbox">
              {filteredOptions.length === 0 && (
                <div className="p-8 text-center">
                  <div className="w-12 h-12 rounded-xl bg-surface-700/50 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <p className="text-sm text-surface-400 mb-1">No results found</p>
                  <p className="text-xs text-surface-500">Try a different search term</p>
                </div>
              )}

              {groupedOptions.presets.length > 0 && (
                <>
                  <div className="px-3 pt-2 pb-1">
                    <span className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider">Institution Types</span>
                  </div>
                  {groupedOptions.presets.map((opt, idx) => {
                    const selected = isSelected(opt.value);
                    const active = activeIndex === idx;
                    return (
                      <button key={opt.value} type="button" role="option" aria-selected={selected}
                        onClick={() => handleSelect(opt.value)} onMouseEnter={() => setActiveIndex(idx)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-150 ${active ? 'bg-cyan-500/10 text-surface-200' : selected ? 'bg-cyan-500/5 text-surface-200' : 'text-surface-300 hover:bg-surface-700/50 hover:text-surface-200'}`}
                      >
                        <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${selected ? 'bg-cyan-500/20 ring-1 ring-cyan-500/30' : active ? 'bg-surface-700 ring-1 ring-surface-500' : 'bg-surface-700'}`}>
                          {opt.icon}
                        </span>
                        <span className="flex-1 text-sm font-medium">{highlightText(opt.label, search)}</span>
                        {selected && (
                          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center flex-shrink-0">
                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          </motion.span>
                        )}
                      </button>
                    );
                  })}
                </>
              )}

              {groupedOptions.presets.length > 0 && groupedOptions.custom.length > 0 && (
                <div className="border-t border-surface-700 mx-3 my-1"></div>
              )}

              {groupedOptions.custom.length > 0 && (
                <>
                  <div className="px-3 pt-2 pb-1">
                    <span className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider">Custom</span>
                  </div>
                  <button key="custom-btn" type="button" role="option" aria-selected={isCustom}
                    onClick={() => handleSelect('custom')}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-150 ${isCustom ? 'bg-cyan-500/5 text-surface-200' : 'text-surface-300 hover:bg-surface-700/50 hover:text-surface-200'}`}
                  >
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${isCustom ? 'bg-cyan-500/20 ring-1 ring-cyan-500/30' : 'bg-surface-700'}`}>
                      {'\u270f\ufe0f'}
                    </span>
                    <span className="flex-1 text-sm font-medium">Custom (type your own)</span>
                    {isCustom && (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </motion.span>
                    )}
                  </button>
                </>
              )}
            </div>

            <div className="px-3 py-2 border-t border-surface-700 bg-surface-800 flex items-center justify-between">
              <span className="text-[11px] text-surface-500">{filteredOptions.length} option{filteredOptions.length !== 1 ? 's' : ''}</span>
              <div className="flex items-center gap-3 text-[11px] text-surface-500">
                <span>{'\u2191\u2193'}</span>
                <span className="text-surface-400">Navigate</span>
                <span>{'\u21B5'}</span>
                <span className="text-surface-400">Select</span>
                <span>Esc</span>
                <span className="text-surface-400">Close</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCustom && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="mt-2 p-3 rounded-xl bg-gradient-to-r from-cyan-500/5 to-emerald-500/5 border border-cyan-500/20">
              <label className="text-xs font-medium text-cyan-400 mb-2 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Type your own institution
              </label>
              <div className="relative">
                <input type="text" value={customValue} onChange={handleCustomChange} placeholder="e.g., House, Car, Apartment, Gym..." className="custom-type-input w-full px-4 py-2.5 bg-surface-700/80 border border-cyan-500/30 rounded-xl text-sm text-surface-200 placeholder-surface-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 transition-all" />
                {customValue && (
                  <button type="button" onClick={() => { setCustomValue(''); onChange('custom'); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-200 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <p className="text-[11px] text-cyan-400/70 mt-1.5 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                The AI can recommend products for any type of space
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
