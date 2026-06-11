// DashboardSkeleton — a polished shimmer skeleton that mirrors the Dashboard layout

function SkeletonBar({ className = '', style = {} }) {
  return <div className={`shimmer rounded-md ${className}`} style={{ ...style }} />;
}

function SkeletonCard({ className = '' }) {
  return (
    <div className={`card p-5 ${className}`}>
      <div className="flex justify-between items-start mb-3">
        <SkeletonBar className="h-3 w-24" />
        <SkeletonBar className="h-5 w-5 rounded-full" />
      </div>
      <SkeletonBar className="h-7 w-20 mt-1 mb-2" />
      <SkeletonBar className="h-2.5 w-16" />
    </div>
  );
}

function SkeletonFacilityCard({ delay = 0 }) {
  const pairs = [['w-16', 'w-12'], ['w-24', 'w-12'], ['w-20', 'w-12'], ['w-14', 'w-12']];
  return (
    <div className="card p-5 animate-fade-in" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex justify-between items-start mb-3">
        <SkeletonBar className="h-4 w-32" />
        <SkeletonBar className="h-5 w-14 rounded-full" />
      </div>
      <div className="space-y-2">
        {pairs.map(([l, r], i) => (
          <div key={i} className="flex justify-between">
            <SkeletonBar className={`h-3 ${l}`} />
            <SkeletonBar className={`h-3 ${r}`} />
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-surface-700/50 flex justify-between">
        <SkeletonBar className="h-3 w-16" />
        <SkeletonBar className="h-4 w-20" />
      </div>
    </div>
  );
}

function SkeletonTableRow() {
  const widths = ['w-10', 'w-28', 'w-16', 'w-20', 'w-14', 'w-16 ml-auto'];
  return (
    <tr className="border-t border-surface-700/50">
      {widths.map((w, i) => (
        <td key={i} className="py-3.5 px-4">
          <SkeletonBar className={`h-3 ${w}`} />
        </td>
      ))}
    </tr>
  );
}

export default function DashboardSkeleton({ viewMode = 'cards' }) {
  return (
    <div className="animate-fade-in pointer-events-none">
      {/* Header skeleton */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <SkeletonBar className="h-7 w-64 mb-2" />
          <SkeletonBar className="h-4 w-80" />
        </div>
        <div className="flex items-center gap-3">
          <SkeletonBar className="h-9 w-32 rounded-xl" />
          <SkeletonBar className="h-9 w-20 rounded-lg" />
        </div>
      </div>

      {/* Profile Overview skeleton */}
      <div className="card p-6 mb-8">
        <div className="flex items-center gap-3 mb-5">
          <SkeletonBar className="h-10 w-10 rounded-xl" />
          <div>
            <SkeletonBar className="h-5 w-48 mb-1" />
            <SkeletonBar className="h-3.5 w-60" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-5">
          {[1, 2, 3, 4].map(i => <SkeletonBar key={i} className="h-7 w-32 rounded-full" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => (
            <div key={i}>
              <SkeletonBar className="h-3 w-24 mb-3" />
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(j => (
                  <div key={j}>
                    <div className="flex justify-between mb-0.5">
                      <SkeletonBar className="h-3 w-20" />
                      <SkeletonBar className="h-3 w-6" />
                    </div>
                    <SkeletonBar className="h-1.5 w-full rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stat Cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
      </div>

      {/* Charts Row skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {[1, 2].map(i => (
          <div key={i} className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <SkeletonBar className="h-2 w-2 rounded-full" />
              <SkeletonBar className="h-4 w-36" />
            </div>
            <div className="space-y-4">
              {[1, 2, 3].map(j => (
                <div key={j}>
                  <div className="flex justify-between mb-1.5">
                    <SkeletonBar className="h-3 w-24" />
                    <SkeletonBar className="h-3 w-8" />
                  </div>
                  <SkeletonBar className="h-2.5 rounded-full" style={{ width: `${40 + j * 20}%` }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Facilities header */}
      <div className="flex items-center gap-2 mb-4">
        <SkeletonBar className="h-5 w-5" />
        <SkeletonBar className="h-5 w-32" />
        <SkeletonBar className="h-3.5 w-8" />
      </div>

      {/* Cards or Table */}
      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <SkeletonFacilityCard key={i} delay={i * 60} />)}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-700 bg-surface-800/50">
                {['ID', 'Name', 'Type', 'Date', 'Status', 'Amount'].map(h => (
                  <th key={h} className="py-3.5 px-4"><SkeletonBar className="h-3 w-12" /></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map(i => <SkeletonTableRow key={i} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
