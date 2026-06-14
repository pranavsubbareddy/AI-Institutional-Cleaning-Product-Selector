import { Link } from 'react-router-dom';

export default function Workflow() {
  const steps = [
    {
      step: 1,
      title: 'Enter Facility Details',
      description: 'Provide institution type, area size, surface types, and contact information to define your facility profile.',
      link: '/form',
      icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
      color: 'cyan'
    },
    {
      step: 2,
      title: 'Set Requirements & Surfaces',
      description: 'Select the surface types that need cleaning, choose hygiene standards, and set your budget level.',
      link: '/form',
      icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
      color: 'cyan'
    },
    {
      step: 3,
      title: 'AI Engine Processing',
      description: 'Our AI engine analyzes your facility against our product database using a sophisticated scoring algorithm that matches facility type, surface requirements, hygiene standards, and budget constraints.',
      icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
      color: 'emerald',
      isProcessing: true
    },
    {
      step: 4,
      title: 'Email Confirmation & Report',
      description: 'A detailed recommendation report is automatically sent to the facility contact email address you provide. The email includes a summary, product table with quantities and pricing, cost breakdown, and any important alerts.',
      link: '/form',
      icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
      color: 'cyan',
      isEmail: true
    },
    {
      step: 5,
      title: 'View Recommendations',
      description: 'Review AI-generated product suggestions with quantities, cost breakdowns, dilution ratios, usage guidance, and safety information.',
      link: '/dashboard',
      icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
      color: 'cyan'
    },
    {
      step: 6,
      title: 'Generate & Copy Quotation',
      description: 'Generate a comprehensive quotation summary with all product details. Copy to clipboard with one click for your records or procurement process.',
      icon: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
      color: 'emerald'
    },
    {
      step: 7,
      title: 'Place Order',
      description: 'Contact the Ganga Maxx sales team to place your order. Leverage negotiated contract pricing and tier discounts for your institution.',
      icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z',
      color: 'emerald'
    }
  ];

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-surface-100 mb-2">Workflow</h1>
        <p className="text-surface-400">Follow these steps to get AI-powered cleaning product recommendations for your facility.</p>
      </div>

      <div className="max-w-3xl mx-auto">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-9 top-0 bottom-0 w-0.5 bg-gradient-to-b from-cyan-500/40 via-emerald-500/40 to-cyan-500/40 hidden sm:block"></div>

          <div className="space-y-8">
            {steps.map((item, index) => (
              <div key={index} className="relative flex items-start gap-6 group">
                {/* Step icon */}
                <div className={`relative z-10 w-18 h-18 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                  item.color === 'cyan' 
                    ? 'bg-cyan-500/10 border-2 border-cyan-500/30 group-hover:border-cyan-500/50' 
                    : 'bg-emerald-500/10 border-2 border-emerald-500/30 group-hover:border-emerald-500/50'
                }`}>
                  <svg className={`w-7 h-7 ${item.color === 'cyan' ? 'text-cyan-400' : 'text-emerald-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                  </svg>
                </div>
                
                {/* Content */}
                <div className="flex-1 pt-2">
                  {item.link ? (
                    <Link to={item.link} className="group/link">
                      <h3 className="text-lg font-semibold text-surface-100 group-hover/link:text-cyan-400 transition-colors">
                        Step {item.step}: {item.title}
                      </h3>
                    </Link>
                  ) : (
                    <h3 className="text-lg font-semibold text-surface-100">
                      Step {item.step}: {item.title}
                    </h3>
                  )}
                  <p className="text-surface-400 mt-1.5 leading-relaxed">{item.description}</p>
                  
                  {item.isProcessing && (
                    <div className="mt-4 p-5 bg-gradient-to-r from-cyan-500/5 to-emerald-500/5 rounded-xl border border-cyan-500/20">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex space-x-1.5">
                          <div className="w-2.5 h-2.5 bg-cyan-500 rounded-full animate-pulse"></div>
                          <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                          <div className="w-2.5 h-2.5 bg-cyan-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                        <span className="text-sm font-medium text-cyan-400">AI Processing</span>
                      </div>
                      <p className="text-sm text-surface-300 leading-relaxed">
                        <span className="text-emerald-400 font-medium">How it works:</span> Our recommendation engine uses a sophisticated scoring algorithm that matches your facility type, surface requirements, hygiene standards, and budget against our comprehensive product database of Ganga Maxx cleaning products. The AI system weighs factors like surface compatibility, dilution efficiency, safety compliance, and cost optimization to generate the most suitable product mix.
                      </p>
                    </div>
                  )}

                  {item.isEmail && (
                    <div className="mt-4 p-5 bg-gradient-to-r from-cyan-500/5 to-cyan-500/10 rounded-xl border border-cyan-500/20">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                          <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <span className="text-sm font-medium text-cyan-400">Email Delivery</span>
                      </div>
                      <div className="text-sm text-surface-300 space-y-2">
                        <p><span className="text-emerald-400 font-medium">Automated delivery:</span> Once the AI generates recommendations, an email is sent automatically to the contact email provided in the form. No manual action needed.</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <span className="badge bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[11px]">📋 Full product table with pricing</span>
                          <span className="badge bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[11px]">💰 Monthly cost breakdown</span>
                          <span className="badge bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[11px]">⚠️ Important alerts & notes</span>
                          <span className="badge bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[11px]">🏢 Facility profile summary</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {item.link && (
                    <Link to={item.link} className="inline-flex items-center mt-3 text-sm text-cyan-400 hover:text-cyan-300 font-medium transition-colors gap-1">
                      Go to step
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 card p-8 bg-gradient-to-r from-cyan-500/10 via-emerald-500/5 to-cyan-500/10 border-cyan-500/20 text-center">
          <div className="max-w-xl mx-auto">
            <h3 className="text-xl font-bold text-surface-100 mb-3">Ready to Get Started?</h3>
            <p className="text-surface-400 mb-6 leading-relaxed">
              Begin by entering your facility details. The entire process takes just a few minutes.
            </p>
            <Link to="/form" className="inline-flex items-center px-8 py-3.5 bg-gradient-to-r from-cyan-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-cyan-500 hover:to-emerald-500 transition-all duration-200 shadow-lg shadow-cyan-500/20">
              Start Now
              <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
