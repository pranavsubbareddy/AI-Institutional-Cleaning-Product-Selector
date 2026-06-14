import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import PageTransition from './PageTransition';
import RouteProgressBar from './RouteProgressBar';
import { isEmailJSConfigured } from '../services/emailService';
import EmailJSConfigWarning from './EmailJSConfigWarning';

export default function Layout() {
  const emailjsNotConfigured = typeof window !== 'undefined' && !isEmailJSConfigured();
  const dismissed = typeof window !== 'undefined' && localStorage.getItem('gangamaxx_emailjs_warning_dismissed') === 'true';
  const showWarning = emailjsNotConfigured && !dismissed;

  return (
    <div className="min-h-screen bg-surface-900 text-surface-200">
      <RouteProgressBar />
      <Navbar />
      {showWarning && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2">
          <EmailJSConfigWarning />
        </div>
      )}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
    </div>
  );
}
