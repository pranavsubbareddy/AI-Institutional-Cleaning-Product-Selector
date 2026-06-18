import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

// ── Role-Based Access Matrix (6 Roles) ──────────────────────────────
// Per spec:
//   SUPER_ADMIN (admin):   Full access to everything
//   SALES_ADMIN:            CRM, Customers, Leads, Quotations, Sales Reports
//   SALESMAN:               Assigned Leads, Customers, Visits, Follow-Ups
//   WAREHOUSE_STAFF:        Inventory, Orders, Dispatch, Delivery
//   ACCOUNTS_MANAGER:       Invoices, Payments, Financial Reports
//   COMPLIANCE_ADMIN:       Compliance, Standards, Approvals
//   field_staff:            Facility Management (form, dashboard)
//   dealer:                 Bulk Orders, Deliveries

// Routes accessible by all authenticated users
const PUBLIC_AUTH_ROUTES = [
  '/', '/form', '/dashboard', '/profile', '/detail', '/edit',
  '/recommendations'
];

// Role-specific route access
const ROLE_ROUTES = {
  // Super Admin - full access
  admin: [
    '/admin-portal', '/admin',
  ],
  // Sales Admin - CRM, customers, leads, quotations, sales reports
  sales_admin: [
    '/admin-portal', '/admin/users'
  ],
  // Salesman - assigned leads, customers, visits, follow-ups
  salesman: [],
  // Warehouse Staff - inventory, orders, dispatch, delivery
  warehouse_staff: [],
  // Accounts Manager - invoices, payments, financial reports
  accounts_manager: [],
  // Compliance Admin - compliance, standards, approvals
  compliance_admin: [],
  // Dealer - bulk orders, deliveries
  dealer: [],
  // Field Staff - facility management
  field_staff: []
};

// All restricted routes (for blocking unauthorized access)
const ALL_RESTRICTED_ROUTES = Array.from(
  new Set(Object.values(ROLE_ROUTES).flat())
);

// Combined PUBLIC_AUTH_ROUTES + role-specific allowed routes
function checkRouteAccess(pathname, role) {
  const allowedRoutes = ROLE_ROUTES[role] || [];

  // 1. Public auth routes are accessible by everyone
  if (PUBLIC_AUTH_ROUTES.some(p => p === '/' ? pathname === '/' : pathname.startsWith(p))) {
    return true;
  }

  // 2. Check if user's role grants access
  if (allowedRoutes.some(p => pathname.startsWith(p))) {
    return true;
  }

  // 3. Block known restricted routes
  if (ALL_RESTRICTED_ROUTES.some(p => pathname.startsWith(p))) {
    return false;
  }

  // 4. Unknown routes: allow (public fallback)
  return true;
}

const dotVariants = {
  initial: { scale: 0, opacity: 0 },
  animate: (i) => ({
    scale: [0, 1, 0],
    opacity: [0, 1, 0],
    transition: {
      duration: 1.4,
      repeat: Infinity,
      ease: 'easeInOut',
      delay: i * 0.16,
    },
  }),
};

export default function ProtectedRoute() {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <motion.div
        className="flex items-center justify-center py-24"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="text-center">
          <motion.div
            className="flex space-x-3 mb-6"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className={`w-4 h-4 rounded-full ${
                  i === 1 ? 'bg-emerald-500' : 'bg-cyan-500'
                }`}
                variants={dotVariants}
                initial="initial"
                animate="animate"
                custom={i}
              />
            ))}
          </motion.div>
          <motion.p
            className="text-surface-400 text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1, ease: 'easeOut' }}
          >
            Verifying your session...
          </motion.p>
        </div>
      </motion.div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Role-based route access check
  const role = user?.role || 'field_staff';
  if (!checkRouteAccess(location.pathname, role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
