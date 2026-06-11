export default function LoadingState({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
      <div className="flex space-x-3 mb-6">
        <div className="loading-dot w-3.5 h-3.5 bg-cyan-500 rounded-full"></div>
        <div className="loading-dot w-3.5 h-3.5 bg-cyan-500 rounded-full"></div>
        <div className="loading-dot w-3.5 h-3.5 bg-cyan-500 rounded-full"></div>
      </div>
      <p className="text-surface-400 text-sm">{message}</p>
    </div>
  );
}
