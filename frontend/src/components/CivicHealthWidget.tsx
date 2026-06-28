// Props: summary (from GET /agents/summary), nearbyCount (number)

function getHealthStatus(summary: any, nearbyCount: number) {
  const critical = summary?.by_severity?.critical ?? 0;
  const high = summary?.by_severity?.high ?? 0;
  if (critical > 0) return { label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/10', icon: '🔴' };
  if (high > 2) return { label: 'Needs Attention', color: 'text-orange-400', bg: 'bg-orange-500/10', icon: '🟠' };
  if (nearbyCount > 0) return { label: 'Some Issues', color: 'text-yellow-400', bg: 'bg-yellow-500/10', icon: '🟡' };
  return { label: 'Safe', color: 'text-green-400', bg: 'bg-green-500/10', icon: '🟢' };
}

interface CivicHealthWidgetProps {
  summary: any;
  nearbyCount: number;
}

export default function CivicHealthWidget({ summary, nearbyCount }: CivicHealthWidgetProps) {
  const health = getHealthStatus(summary, nearbyCount);

  return (
    <div className="fixed top-4 right-4 z-[900] bg-slate-800/90 backdrop-blur-sm border border-slate-700/40 rounded-2xl p-3 shadow-xl min-w-[160px] select-none text-white">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">🛡️</span>
        <span className="text-xs font-semibold text-slate-300">Civic Health</span>
      </div>
      <div className={`flex items-center gap-1.5 rounded-lg px-2 py-1 mb-2 ${health.bg}`}>
        <span>{health.icon}</span>
        <span className={`text-sm font-bold ${health.color}`}>{health.label}</span>
      </div>
      <div className="space-y-1 text-[11px] text-slate-400">
        <div className="flex justify-between">
          <span>Nearby issues</span>
          <span className="text-white font-medium">{nearbyCount}</span>
        </div>
        <div className="flex justify-between">
          <span>🔴 Critical</span>
          <span className="text-red-400 font-medium">{summary?.by_severity?.critical ?? 0}</span>
        </div>
        <div className="flex justify-between">
          <span>✅ Resolved</span>
          <span className="text-green-400 font-medium">{summary?.resolved ?? 0}</span>
        </div>
      </div>
    </div>
  );
}
