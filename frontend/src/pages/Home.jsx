import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <div className="text-center py-16">
        <div className="w-24 h-24 bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-cyan-500/20 shadow-lg shadow-cyan-500/5 animate-glow">
          <svg className="w-12 h-12 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400 mb-4">
          AI Institutional Cleaning<br />Product Selector
        </h1>
        <p className="text-lg text-surface-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Powered by <span className="text-emerald-400 font-semibold">Ganga Maxx Marketplace</span> — 
          Get AI-powered cleaning product recommendations tailored to your facility's needs. 
          Smart matching based on surface types, hygiene standards, and budget.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/form" className="btn-primary text-lg px-10 py-3.5 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30">
            <svg className="w-5 h-5 inline mr-2 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Get Started
          </Link>
          <Link to="/dashboard" className="btn-secondary text-lg px-10 py-3.5">
            <svg className="w-5 h-5 inline mr-2 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            View Dashboard
          </Link>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="card p-8 text-center hover:border-cyan-500/30 transition-all duration-300">
          <div className="w-16 h-16 bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-cyan-500/20">
            <svg className="w-8 h-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-semibold text-surface-100 mb-3 text-lg">Smart Recommendations</h3>
          <p className="text-sm text-surface-400 leading-relaxed">AI-powered product matching based on facility type, surface composition, and hygiene requirements for optimal cleaning solutions.</p>
        </div>

        <div className="card p-8 text-center hover:border-emerald-500/30 transition-all duration-300">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-emerald-500/20">
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-semibold text-surface-100 mb-3 text-lg">Cost Estimates</h3>
          <p className="text-sm text-surface-400 leading-relaxed">Detailed monthly quantity estimates and cost breakdowns for accurate budget planning and procurement.</p>
        </div>

        <div className="card p-8 text-center hover:border-cyan-500/30 transition-all duration-300">
          <div className="w-16 h-16 bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-cyan-500/20">
            <svg className="w-8 h-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="font-semibold text-surface-100 mb-3 text-lg">Dashboard & Reports</h3>
          <p className="text-sm text-surface-400 leading-relaxed">Comprehensive analytics dashboard with history tracking, budget insights, and actionable procurement reports.</p>
        </div>
      </div>

      {/* CTA Banner */}
      <div className="mt-16 bg-gradient-to-r from-surface-800 via-surface-800 to-surface-800 rounded-2xl border border-cyan-500/20 p-8 md:p-12 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-surface-100 mb-3">Ready to optimize your cleaning operations?</h2>
          <p className="text-surface-400 mb-8 leading-relaxed">
            Get instant AI-powered product recommendations for your facility. 
            The entire process takes just a few minutes.
          </p>
          <Link 
            to="/form" 
            className="inline-flex items-center px-8 py-3.5 bg-gradient-to-r from-cyan-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-cyan-500 hover:to-emerald-500 transition-all duration-200 shadow-lg shadow-cyan-500/20"
          >
            Start Now
            <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
