import { Link, useLocation } from 'react-router-dom';

const navTabs = [
  { path: '/form', label: 'Requirement Form', icon: '📋' },
  { path: '/dashboard', label: 'B2B Dashboard', icon: '📊' },
  { path: '/recommendations/latest', label: 'Latest Report', icon: '📄' },
];

export default function Navbar() {
  const location = useLocation();

  // Determine active tab — check if current path starts with tab's base path
  const isActive = (path) => {
    if (path === '/recommendations/latest') {
      return location.pathname.startsWith('/recommendations');
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="bg-surface-900 border-b border-surface-700/50 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Brand */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/30 transition-all">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <div className="hidden sm:block">
              <span className="font-bold text-lg text-surface-100">Ganga Maxx</span>
              <span className="block text-[10px] text-surface-400 tracking-wider uppercase">Cleaning AI</span>
            </div>
          </Link>

          {/* Navigation Tabs */}
          <div className="flex items-center bg-surface-800/80 rounded-xl p-1 border border-surface-700/50">
            {navTabs.map(tab => (
              <Link
                key={tab.path}
                to={tab.path}
                className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive(tab.path)
                    ? 'bg-cyan-500/10 text-cyan-400 shadow-sm'
                    : 'text-surface-400 hover:text-surface-200 hover:bg-surface-700/50'
                }`}
              >
                <span className="mr-2 text-base">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </Link>
            ))}
          </div>

          {/* Home link */}
          <Link
            to="/"
            className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              location.pathname === '/'
                ? 'bg-cyan-500/10 text-cyan-400'
                : 'text-surface-400 hover:text-surface-200 hover:bg-surface-700/50'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </Link>
        </div>
      </div>
    </nav>
  );
}
