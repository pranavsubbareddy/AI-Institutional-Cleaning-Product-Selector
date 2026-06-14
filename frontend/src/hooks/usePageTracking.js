import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Default tracker — logs page views to the browser console.
 * In production, swap this out for Google Analytics, Plausible, a custom API endpoint, etc.
 *
 * @param {'page_view'} event
 * @param {object}  properties — { path, search, referrer, title, timestamp, userId? }
 */
const defaultTracker = (event, properties) => {
  if (import.meta.env.DEV) {
    console.log(
      `%c[Analytics] %c${event} %c${properties.path}`,
      'color:#06b6d4;font-weight:600',
      'color:#10b981;font-weight:600',
      'color:#e2e8f0',
      properties
    );
  }
};

/**
 * usePageTracking — Fires a page_view event on every route change.
 *
 * @param {object}   options
 * @param {Function} [options.tracker=defaultTracker]  — custom analytics adapter
 * @param {boolean}  [options.enabled=true]             — set via VITE_ANALYTICS_ENABLED
 *
 * @example
 * // Basic usage (logs to console in dev)
 * usePageTracking();
 *
 * @example
 * // With a custom tracker (e.g. Plausible)
 * usePageTracking({
 *   tracker: (event, props) => { window.plausible?.(event, { props }); },
 *   enabled: import.meta.env.VITE_ANALYTICS_ENABLED !== 'false',
 * });
 */
export default function usePageTracking({
  tracker = defaultTracker,
  enabled = import.meta.env.VITE_ANALYTICS_ENABLED !== 'false',
} = {}) {
  const location = useLocation();
  const prevPath = useRef(location.pathname + location.search);

  useEffect(() => {
    const fullPath = location.pathname + location.search;

    // Skip the initial render (first page load) — only fire on actual navigations
    if (prevPath.current === fullPath) {
      prevPath.current = fullPath;
      return;
    }
    prevPath.current = fullPath;

    if (!enabled) return;

    const properties = {
      path: location.pathname,
      search: location.search || null,
      hash: location.hash || null,
      referrer: document.referrer || null,
      title: document.title,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      language: navigator.language,
      screen: `${window.screen.width}x${window.screen.height}`,
    };

    tracker('page_view', properties);
  }, [location.pathname, location.search]);
}
