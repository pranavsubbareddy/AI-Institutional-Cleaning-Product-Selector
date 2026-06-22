import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, formatCurrency } from '../services/api';
import { useAuth } from '../context/AuthContext';

// ── Reading Progress Bar ───────────────────────────────────────────────────
function ReadingProgressBar() {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (docHeight > 0) {
          setProgress(Math.min((scrollTop / docHeight) * 100, 100));
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // initial

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="fixed top-16 left-0 right-0 h-1 z-50 bg-surface-800/50">
      <div
        className="h-full rounded-r-full transition-[width] duration-150 ease-out bg-gradient-to-r from-cyan-500 via-emerald-400 to-cyan-400"
        style={{ width: `${Math.round(progress)}%` }}
      />
    </div>
  );
}

// ── Floating Particles Background ──────────────────────────────────────────
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full opacity-[0.03] animate-float-particle"
          style={{
            width: `${12 + (i % 7) * 8}px`,
            height: `${12 + (i % 7) * 8}px`,
            left: `${(i * 17 + 3) % 100}%`,
            top: `${(i * 23 + 11) % 100}%`,
            background: i % 2 === 0 ? '#06b6d4' : '#10b981',
            animationDelay: `${i * 1.2}s`,
            animationDuration: `${12 + (i % 5) * 4}s`,
          }}
        />
      ))}
    </div>
  );
}

// ── Section Reveal Hook ─────────────────────────────────────────────────────
function useReveal(options = { threshold: 0.15 }) {
  const [revealed, setRevealed] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || revealed) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          obs.disconnect();
        }
      },
      { threshold: options.threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [options.threshold, revealed]);

  return { ref, revealed };
}

// ── Section Header with Reveal Animation ────────────────────────────────────
function SectionHeader({ badge, title, subtitle, badgeColor = 'cyan' }) {
  const { ref, revealed } = useReveal();
  const badgeStyles = {
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  };
  return (
    <div
      ref={ref}
      className={`text-center mb-8 sm:mb-10 transition-all duration-700 ${
        revealed ? 'animate-section-reveal' : 'opacity-0'
      }`}
    >
      {badge && (
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${badgeStyles[badgeColor]} mb-3`}>
          {badge}
        </span>
      )}
      <h2 className="text-2xl sm:text-3xl font-bold text-surface-100">{title}</h2>
      {subtitle && (
        <p className="text-surface-400 mt-2 max-w-xl mx-auto text-sm sm:text-base">{subtitle}</p>
      )}
    </div>
  );
}

// ── Section Navigation ──────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'features', label: 'How It Works', icon: '⚡' },
];

function SectionNav() {
  const [activeId, setActiveId] = useState('features');
  const navRef = useRef(null);

  useEffect(() => {
    const observers = [];
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveId(id);
        },
        { rootMargin: '-40% 0px -40% 0px', threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach(obs => obs.disconnect());
  }, []);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav
      ref={navRef}
      className="sticky top-16 z-40 bg-surface-900/90 backdrop-blur-md border-b border-surface-700/30 shadow-lg shadow-black/10"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-3">
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1">
          {SECTIONS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
                activeId === id
                  ? 'bg-cyan-500/15 text-cyan-400 shadow-sm shadow-cyan-500/10'
                  : 'text-surface-400 hover:text-surface-200 hover:bg-surface-700/50'
              }`}
            >
              <span className="text-sm sm:text-base">{icon}</span>
              <span className="hidden xs:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}

// ── Main Home Page ─────────────────────────────────────────────────────────
// ── Dashboard Card (for authenticated views) ──────────────────────────────
function DashboardCard({ to, icon, label, desc, color = 'cyan', value }) {
  const colorMap = {
    cyan: 'from-cyan-600 to-emerald-600 border-cyan-500/30',
    amber: 'from-amber-600 to-orange-600 border-amber-500/30',
    purple: 'from-purple-600 to-pink-600 border-purple-500/30',
  };
  const iconColorMap = { cyan: 'text-cyan-400', amber: 'text-amber-400', purple: 'text-purple-400' };
  return (
    <Link to={to} className="card p-5 hover:border-cyan-500/30 transition-all duration-300 group animate-slide-up">
      <div className="flex items-start gap-4">
        <div className={'w-12 h-12 rounded-xl bg-gradient-to-br ' + (colorMap[color] || colorMap.cyan) + ' flex items-center justify-center flex-shrink-0 shadow-lg'}>
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-surface-100 group-hover:text-cyan-400 transition-colors">{label}</h3>
          <p className="text-xs text-surface-400 mt-0.5">{desc}</p>
          {value !== undefined && (
            <p className={'text-sm font-bold mt-1.5 ' + (iconColorMap[color] || iconColorMap.cyan)}>{value}</p>
          )}
        </div>
        <svg className="w-5 h-5 text-surface-500 group-hover:text-cyan-400 transition-colors flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

// ── Admin Home View ───────────────────────────────────────────────────────
function AdminHome({ overview, ops }) {
  const navigate = useNavigate();
  const adminCards = [
    { to: '/admin', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z', label: 'System Dashboard', desc: 'View system-wide metrics and activity logs', color: 'amber', value: null },
    { to: '/admin-portal', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', label: 'Admin Portal', desc: 'Operations dashboard with role-switching', color: 'amber', value: null },
    { to: '/dashboard', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', label: 'B2B Dashboard', desc: 'Analytics and facility management', color: 'emerald', value: null },
  ];
  const stats = [
    { label: 'Total Facilities', value: overview?.total_institutions || 0, color: 'cyan' },
    { label: 'Registered Users', value: overview?.total_users || 0, color: 'purple' },
    { label: 'Pipeline Value', value: formatCurrency(overview?.total_estimated_cost || 0), color: 'emerald' },
    { label: 'Active Recs', value: overview?.active_recommendations || 0, color: 'amber' },
  ];
  return (
    <div className="animate-fade-in max-w-5xl mx-auto px-4 py-8 sm:py-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-surface-100">Admin Dashboard</h1>
          <p className="text-sm text-surface-400">System overview — manage facilities, users, and operations</p>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s, i) => (
          <div key={i} className={'card p-4 border-l-4 border-l-' + s.color + '-500'}>
            <p className="text-[11px] text-surface-400 uppercase tracking-wider font-medium">{s.label}</p>
            <p className={'text-xl font-bold mt-1 text-' + s.color + '-400'}>{s.value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {adminCards.map((card, i) => (
          <DashboardCard key={i} {...card} />
        ))}
      </div>
      <div className="mt-8 flex gap-3">
        <button onClick={() => navigate('/form')} className="btn-primary text-sm">
          <svg className="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          New Facility
        </button>
        <button onClick={() => navigate('/admin')} className="btn-secondary text-sm">
          <svg className="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          Full Analytics
        </button>
      </div>
    </div>
  );
}

// ── User Home View ────────────────────────────────────────────────────────
function UserHome({ stats, user }) {
  const navigate = useNavigate();
  const userCards = [
    { to: '/dashboard', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', label: 'My Dashboard', desc: 'Track facilities, recommendations & costs', color: 'emerald' },
    { to: '/profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', label: 'My Profile', desc: 'Manage your account settings', color: 'purple' },
  ];
  const overview = stats?.overview || {};
  const userStatCards = [
    { label: 'My Facilities', value: overview.total_institutions || 0, color: 'cyan' },
    { label: 'Recommendations', value: overview.active_recommendations || 0, color: 'emerald' },
    { label: 'Pipeline Value', value: formatCurrency(overview.total_estimated_cost || 0), color: 'amber' },
  ];
  return (
    <div className="animate-fade-in max-w-5xl mx-auto px-4 py-8 sm:py-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-surface-100">Welcome back, {user?.displayName || 'User'}</h1>
          <p className="text-sm text-surface-400">Manage your facilities and cleaning recommendations</p>
        </div>
      </div>
      {overview.total_institutions > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {userStatCards.map((s, i) => (
            <div key={i} className={'card p-4 border-l-4 border-l-' + s.color + '-500'}>
              <p className="text-[11px] text-surface-400 uppercase tracking-wider">{s.label}</p>
              <p className={'text-xl font-bold mt-1 text-' + s.color + '-400'}>{s.value}</p>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {userCards.map((card, i) => (
          <DashboardCard key={i} {...card} />
        ))}
      </div>
      <div className="mt-8">
        <button onClick={() => navigate('/form')} className="btn-primary text-sm">
          <svg className="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Get New Recommendations
        </button>
      </div>
    </div>
  );
}

// ── Main Home Page ─────────────────────────────────────────────────────────
export default function Home() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [stats, setStats] = useState(null);
  const [adminData, setAdminData] = useState(null);

  const [loading, setLoading] = useState(true);

  // Redirect authenticated role users to their operation landing page
  useEffect(() => {
    if (isAuthenticated && user?.role) {
      const ROLE_HOME_PAGES = {
        admin: '/admin',
        sales_admin: '/admin-portal',
        salesman: '/salesman',
        warehouse_staff: '/warehouse',
        delivery_coordinator: '/deliveries',
        accounts_manager: '/orders',
        compliance_admin: '/compliance',
      };
      const targetPage = ROLE_HOME_PAGES[user.role];
      if (targetPage && targetPage !== window.location.pathname) {
        navigate(targetPage, { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);

  // Fetch dynamic data based on role
  useEffect(() => {
    async function fetchData() {
      try {
        if (user?.role === 'admin') {
          // Admin: fetch system-wide data
          const res = await api.getAdminDashboard();
          if (res.success) setAdminData(res.data);
        } else if (isAuthenticated) {
          // Regular user: fetch personal stats
          const [statsRes] = await Promise.allSettled([api.getDashboardStats()]);
          if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
        } else {
          // Unauthenticated: fetch public stats
          const [statsRes] = await Promise.allSettled([
            api.getDashboardStats(),
          ]);
          if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
        }
      } catch (_) { /* silently fall back */ }
      setLoading(false);
    }
    fetchData();
  }, [isAuthenticated, user]);

  // Reset loading when auth state changes (for re-fetch on login)
  useEffect(() => {
    setLoading(true);
  }, [isAuthenticated]);

  // If authenticated, render role-specific views
  // Role-based users (admin, salesman, warehouse, etc.) get redirected above,
  // but we still render for field_staff who stay on Home
  if (isAuthenticated) {
    if (user?.role === 'admin') {
      return (
        <div className="min-h-screen">
          <AdminHome overview={adminData?.overview} ops={adminData?.operations} />
          <footer className="max-w-5xl mx-auto px-4 py-6 border-t border-surface-700/50 mt-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-surface-500">
              <p>&copy; {new Date().getFullYear()} Ganga Maxx Marketplace. All rights reserved.</p>
              <p>Admin Access</p>
            </div>
          </footer>
        </div>
      );
    }
    // For field_staff and other roles not redirected above, show UserHome
    // Note: roles like salesman, warehouse_staff, etc. get redirected away by the useEffect above
    return (
      <div className="min-h-screen">
        <UserHome stats={stats} user={user} />
        <footer className="max-w-5xl mx-auto px-4 py-6 border-t border-surface-700/50 mt-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-surface-500">
            <p>&copy; {new Date().getFullYear()} Ganga Maxx Marketplace. All rights reserved.</p>
            <p>Welcome, {user?.displayName || 'User'}</p>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Reading Progress Bar */}
      <ReadingProgressBar />

      {/* ═══════════════════════════════════════════════════════════════════
         HERO SECTION
         ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden py-20 sm:py-24">
        <FloatingParticles />

        {/* Gradient orbs */}
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '2s' }} />

        <div className="relative z-10 text-center px-4 sm:px-6 max-w-5xl mx-auto">
          {/* Logo icon */}
          <div className="w-16 h-16 sm:w-24 sm:h-24 bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto mb-6 sm:mb-8 border border-cyan-500/20 shadow-lg shadow-cyan-500/5 animate-glow">
            <svg className="w-8 h-8 sm:w-12 sm:h-12 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-emerald-400 to-cyan-300 mb-4 sm:mb-6 leading-tight">
            AI Institutional Cleaning<br className="hidden xs:block" /> Product Selector
          </h1>

          <p className="text-base sm:text-lg text-surface-400 max-w-3xl mx-auto mb-8 sm:mb-10 leading-relaxed px-2">
            Powered by <span className="text-emerald-400 font-semibold">Ganga Maxx Marketplace</span> —
            Get AI-powered cleaning product recommendations tailored to your facility&apos;s needs.
            Smart matching based on surface types, hygiene standards, and budget.
          </p>

          <div className="flex flex-col xs:flex-row gap-3 sm:gap-4 justify-center items-center">
            <Link to="/form" className="w-full xs:w-auto btn-primary text-base sm:text-lg px-6 sm:px-10 py-3 sm:py-3.5 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 inline-flex items-center justify-center">
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Get Started
            </Link>
            <Link to="/dashboard" className="w-full xs:w-auto btn-secondary text-base sm:text-lg px-6 sm:px-10 py-3 sm:py-3.5 inline-flex items-center justify-center">
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              View Dashboard
            </Link>
          </div>

          {/* Trust badges */}
          <div className="mt-10 sm:mt-12 flex flex-wrap justify-center gap-3 sm:gap-6 text-xs sm:text-sm text-surface-500">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Free to use
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              Secure & private
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              AI-powered
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Instant reports
            </span>
          </div>
        </div>
      </section>

      {/* Section Navigation */}
      <SectionNav />

      {/* ═══════════════════════════════════════════════════════════════════
         FEATURES GRID
         ═══════════════════════════════════════════════════════════════════ */}
      <section id="features" className="py-12 sm:py-16 scroll-mt-28">
        <SectionHeader
          title="How It Works"
          subtitle="Four simple steps to optimize your cleaning operations"
        />

        <div className="relative">
          {/* Connecting line - hidden on mobile */}
          <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-cyan-500/40 via-emerald-500/40 to-cyan-500/40 -translate-x-1/2 z-0" />

          {/* Step 1 */}
          <div className="relative z-10 flex flex-col lg:flex-row items-center gap-6 sm:gap-8 mb-8 sm:mb-12">
            <div className="w-full lg:w-1/2 lg:pr-8 lg:text-right">
              <div className="card p-5 sm:p-6 lg:p-7 hover:border-cyan-500/30 transition-all duration-300 group">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-cyan-500/10 text-cyan-400 text-sm font-bold border border-cyan-500/20 mb-3">1</span>
                <h3 className="font-semibold text-surface-100 mb-2 text-base sm:text-lg group-hover:text-cyan-400 transition-colors">Tell Us About Your Facility</h3>
                <p className="text-sm text-surface-400 leading-relaxed">Fill out a simple form with your facility type, size, surface types, hygiene requirements, and budget. Our intelligent form guides you through every step.</p>
              </div>
            </div>
            <div className="flex-shrink-0">
              <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <div className="w-full lg:w-1/2 lg:pl-8 hidden lg:block" />
          </div>

          {/* Step 2 */}
          <div className="relative z-10 flex flex-col lg:flex-row-reverse items-center gap-6 sm:gap-8 mb-8 sm:mb-12">
            <div className="w-full lg:w-1/2 lg:pl-8">
              <div className="card p-5 sm:p-6 lg:p-7 hover:border-emerald-500/30 transition-all duration-300 group">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-bold border border-emerald-500/20 mb-3">2</span>
                <h3 className="font-semibold text-surface-100 mb-2 text-base sm:text-lg group-hover:text-emerald-400 transition-colors">Get AI-Powered Recommendations</h3>
                <p className="text-sm text-surface-400 leading-relaxed">Our AI engine analyzes your inputs against a comprehensive product database of Ganga Maxx cleaning solutions, matching products by compatibility, cost-efficiency, and safety.</p>
              </div>
            </div>
            <div className="flex-shrink-0">
              <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <div className="w-full lg:w-1/2 lg:pr-8 hidden lg:block" />
          </div>

          {/* Step 3 */}
          <div className="relative z-10 flex flex-col lg:flex-row items-center gap-6 sm:gap-8 mb-8 sm:mb-12">
            <div className="w-full lg:w-1/2 lg:pr-8 lg:text-right">
              <div className="card p-5 sm:p-6 lg:p-7 hover:border-cyan-500/30 transition-all duration-300 group">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-cyan-500/10 text-cyan-400 text-sm font-bold border border-cyan-500/20 mb-3">3</span>
                <h3 className="font-semibold text-surface-100 mb-2 text-base sm:text-lg group-hover:text-cyan-400 transition-colors">Review &amp; Procure</h3>
                <p className="text-sm text-surface-400 leading-relaxed">View detailed product recommendations with quantities, cost breakdowns, and usage guidance. Generate reports and contact the Ganga Maxx sales team to place your order.</p>
              </div>
            </div>
            <div className="flex-shrink-0">
              <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <div className="w-full lg:w-1/2 lg:pl-8 hidden lg:block" />
          </div>

          {/* Step 4 */}
          <div className="relative z-10 flex flex-col lg:flex-row-reverse items-center gap-6 sm:gap-8">
            <div className="w-full lg:w-1/2 lg:pl-8">
              <div className="card p-5 sm:p-6 lg:p-7 hover:border-emerald-500/30 transition-all duration-300 group">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-bold border border-emerald-500/20 mb-3">4</span>
                <h3 className="font-semibold text-surface-100 mb-2 text-base sm:text-lg group-hover:text-emerald-400 transition-colors">Track &amp; Optimize</h3>
                <p className="text-sm text-surface-400 leading-relaxed">Use the B2B Dashboard to track recommendations across multiple facilities, monitor budget, view history, and generate procurement reports for informed decisions.</p>
              </div>
            </div>
            <div className="flex-shrink-0">
              <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </div>
            </div>
            <div className="w-full lg:w-1/2 lg:pr-8 hidden lg:block" />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
         CTA BANNER
         ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-12 sm:py-16">
        <div className="bg-gradient-to-r from-surface-800 via-surface-800 to-surface-800 rounded-2xl border border-cyan-500/20 p-6 sm:p-8 md:p-12 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-surface-100 mb-3">Ready to optimize your cleaning operations?</h2>
            <p className="text-sm sm:text-base text-surface-400 mb-6 sm:mb-8 leading-relaxed">
              Get instant AI-powered product recommendations for your facility.
              The entire process takes just a few minutes.
            </p>
            <Link
              to="/form"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-3.5 bg-gradient-to-r from-cyan-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-cyan-500 hover:to-emerald-500 transition-all duration-200 shadow-lg shadow-cyan-500/20 text-sm sm:text-base"
            >
              Start Now — It&apos;s Free
              <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
         FOOTER
         ═══════════════════════════════════════════════════════════════════ */}
      <footer className="py-8 sm:py-12 border-t border-surface-700/50 mt-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-emerald-500 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <span className="font-bold text-surface-100">Ganga Maxx</span>
            </div>
            <p className="text-xs sm:text-sm text-surface-400 leading-relaxed">
              AI-powered cleaning product selection platform for institutional facilities.
              Part of the Ganga Maxx Marketplace ecosystem.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-surface-200 text-sm mb-3">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/form" className="text-surface-400 hover:text-cyan-400 transition-colors">Get Recommendations</Link></li>
              <li><Link to="/dashboard" className="text-surface-400 hover:text-cyan-400 transition-colors">Dashboard</Link></li>
              <li><Link to="/#features" className="text-surface-400 hover:text-cyan-400 transition-colors">How It Works</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-surface-200 text-sm mb-3">Contact</h4>
            <ul className="space-y-2 text-sm text-surface-400">
              <li>sales@ganga-maxx.com</li>
              <li>+91-1800-123-GANGA</li>
              <li>Mumbai, Maharashtra, India</li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-surface-700/50 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-surface-500">
          <p>&copy; {new Date().getFullYear()} Ganga Maxx Marketplace. All rights reserved.</p>
          <p>Made with ❤️ for cleaner facilities</p>
        </div>
      </footer>
    </div>
  );
}
