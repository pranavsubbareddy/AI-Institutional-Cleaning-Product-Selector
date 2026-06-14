import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navTabs = [
  { path: '/form', label: 'Requirement Form', icon: '📋' },
  { path: '/dashboard', label: 'B2B Dashboard', icon: '📊' },
];

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated, loading } = useAuth();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const isActive = (path) => location.pathname.startsWith(path);
  const isLoginPage = location.pathname === '/login';
  const closeMobile = () => setMobileOpen(false);

  const handleLogout = async () => {
    await logout();
    setProfileOpen(false);
    closeMobile();
    navigate('/');
  };

  // ── User avatar initials ────────────────────────────────────────────
  const initials = user?.displayName
    ? user.displayName.split(' ').map(s => s[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || 'U';

  return (
    <nav className="bg-surface-900 border-b border-surface-700/50 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Brand */}
          <Link to="/" onClick={closeMobile} className="flex items-center space-x-3 group">
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

          {/* Desktop Navigation Tabs - hidden on login page */}
          {!isLoginPage && (
            <div className="hidden md:flex items-center bg-surface-800/80 rounded-xl p-1 border border-surface-700/50">
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
          )}

          {/* Desktop right side: Home + Auth - hidden on login page */}
          {!isLoginPage && (
          <div className="hidden md:flex items-center gap-2">
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

            {/* Auth Section */}
            <div className="border-l border-surface-700/50 pl-2">
              {loading ? (
                <div className="w-20 h-8 bg-surface-700/30 rounded-lg animate-pulse" />
              ) : isAuthenticated ? (
                <div className="relative" ref={profileRef}>
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-surface-700/50 transition-all duration-200 group"
                  >
                    {/* Avatar */}
                    {user?.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt=""
                        className="w-8 h-8 rounded-full border-2 border-cyan-500/30 object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-xs font-bold text-white border-2 border-cyan-500/30">
                        {initials}
                      </div>
                    )}
                    <span className="text-sm font-medium text-surface-200 group-hover:text-surface-100 max-w-[100px] truncate">
                      {user?.displayName || user?.email?.split('@')[0] || 'User'}
                    </span>
                    <svg
                      className={`w-4 h-4 text-surface-400 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown */}
                  <div
                    className={`absolute right-0 mt-2 w-56 bg-surface-800 border border-surface-700/50 rounded-xl shadow-xl shadow-black/30 overflow-hidden transition-all duration-200 origin-top-right ${
                      profileOpen
                        ? 'opacity-100 scale-100 pointer-events-auto'
                        : 'opacity-0 scale-95 pointer-events-none'
                    }`}
                  >
                    <div className="p-3 border-b border-surface-700/50">
                      <p className="text-sm font-medium text-surface-100 truncate">
                        {user?.displayName || 'User'}
                      </p>
                      <p className="text-xs text-surface-400 truncate mt-0.5">
                        {user?.email || ''}
                      </p>
                    </div>
                    <div className="p-1.5">
                      <Link
                        to="/dashboard"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-surface-300 hover:text-surface-100 hover:bg-surface-700/50 transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                        </svg>
                        Dashboard
                      </Link>
                      <Link
                        to="/profile"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-surface-300 hover:text-surface-100 hover:bg-surface-700/50 transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Profile
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign Out
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-emerald-600 text-white text-sm font-medium hover:from-cyan-500 hover:to-emerald-500 transition-all duration-200 shadow-sm shadow-cyan-500/20"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Sign In
                </Link>
              )}
            </div>
          </div>
          )}

          {/* Mobile hamburger - hidden on login page */}
          {!isLoginPage && (
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-700/50 transition-all"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
          )}
        </div>

        {/* Mobile Drawer - hidden on login page */}
        {!isLoginPage && (
        <div
          className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
            mobileOpen ? 'max-h-96 opacity-100 pb-4' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="flex flex-col space-y-1 bg-surface-800/80 rounded-xl p-2 border border-surface-700/50">
            {/* Mobile user info */}
            {isAuthenticated && (
              <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-700/30 mb-1">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full border-2 border-cyan-500/30 object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-xs font-bold text-white">
                    {initials}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-surface-100 truncate">{user?.displayName || 'User'}</p>
                  <p className="text-xs text-surface-400 truncate">{user?.email || ''}</p>
                </div>
              </div>
            )}

            {navTabs.map(tab => (
              <Link
                key={tab.path}
                to={tab.path}
                onClick={closeMobile}
                className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive(tab.path)
                    ? 'bg-cyan-500/10 text-cyan-400'
                    : 'text-surface-400 hover:text-surface-200 hover:bg-surface-700/50'
                }`}
              >
                <span className="mr-3 text-lg">{tab.icon}</span>
                {tab.label}
              </Link>
            ))}
            <Link
              to="/"
              onClick={closeMobile}
              className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                location.pathname === '/'
                  ? 'bg-cyan-500/10 text-cyan-400'
                  : 'text-surface-400 hover:text-surface-200 hover:bg-surface-700/50'
              }`}
            >
              <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Home
            </Link>

            {/* Mobile auth actions */}
            <div className="border-t border-surface-700/30 pt-2 mt-1">
              {isAuthenticated ? (
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
                >
                  <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              ) : (
                <Link
                  to="/login"
                  onClick={closeMobile}
                  className="flex items-center px-4 py-3 rounded-lg text-sm font-medium text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition-all"
                >
                  <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
        )}
      </div>
    </nav>
  );
}
