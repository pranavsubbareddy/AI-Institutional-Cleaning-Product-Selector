import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import PageTransition from './PageTransition';
import RouteProgressBar from './RouteProgressBar';

export default function Layout() {
  return (
    <div className="min-h-screen bg-surface-900 text-surface-200">
      <RouteProgressBar />
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
    </div>
  );
}
