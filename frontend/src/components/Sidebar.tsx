import { useState, useEffect } from 'react';
import {
  BarChart3, AlertTriangle, Droplets, Trash2, Lightbulb, HelpCircle,
  Megaphone, Loader2, Search, X,
} from 'lucide-react';
import { getSummary, triggerEscalation } from '../api';
import type { Issue, SummaryStats, AgentHealth } from '../types';
import toast from 'react-hot-toast';

const categoryEmoji: Record<string, string> = {
  pothole: '🕳️',
  water_leakage: '💧',
  garbage: '🗑️',
  streetlight: '💡',
  other: '⚠️',
};

const severityColor: Record<string, string> = {
  critical: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-black',
  low: 'bg-green-500 text-white',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="px-3 pt-4 pb-1">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">{title}</p>
    </div>
  );
}

function Divider() {
  return <div className="mx-3 border-t border-slate-700/40 my-1" />;
}

const FILTER_CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'pothole', label: 'Pothole' },
  { value: 'water_leakage', label: 'Water' },
  { value: 'garbage', label: 'Garbage' },
  { value: 'streetlight', label: 'Light' },
  { value: 'other', label: 'Other' },
];

interface SidebarProps {
  issues: Issue[];
  onSelectIssue: (issue: Issue) => void;
  selectedIssueId: string | null;
  agentAlive: boolean;
  agentHealth?: AgentHealth | null;
  onToggleLegend: () => void;
}

export default function Sidebar({ issues, onSelectIssue, selectedIssueId, agentAlive, agentHealth, onToggleLegend }: SidebarProps) {
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [escalating, setEscalating] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showHealthTooltip, setShowHealthTooltip] = useState(false);

  useEffect(() => {
    getSummary()
      .then(setStats)
      .catch(() => {});
  }, [issues]);

  const handleEscalate = async () => {
    setEscalating(true);
    try {
      const result = await triggerEscalation();
      toast.success(result.message || 'Escalation triggered!');
    } catch {
      toast.error('Escalation failed');
    } finally {
      setEscalating(false);
    }
  };

  const filtered = issues
    .filter((i) => filter === 'all' || i.category === filter)
    .filter((i) =>
      !search || i.title.toLowerCase().includes(search.toLowerCase()) ||
      i.address?.toLowerCase().includes(search.toLowerCase()),
    )
    .slice(0, 10);

  return (
    <div className="h-full bg-civic-sidebar flex flex-col overflow-hidden">
      {/* ── Header ─── */}
      <div className="px-4 py-4 flex items-center justify-between border-b border-slate-700/40">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-blue-400" />
          <span className="text-sm font-semibold text-white">Dashboard</span>
        </div>
        {/* Agent status dot with hover tooltip */}
        <div className="relative flex items-center gap-1.5 text-xs text-slate-400"
          onMouseEnter={() => setShowHealthTooltip(true)}
          onMouseLeave={() => setShowHealthTooltip(false)}>
          <span
            className={`w-2 h-2 rounded-full cursor-help transition-all ${
              !agentAlive ? 'bg-red-500' :
              agentHealth?.overall === 'degraded' ? 'bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.6)]' :
              'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]'
            }`}
          />
          <span>{!agentAlive ? 'Offline' : agentHealth?.overall === 'degraded' ? 'Degraded' : 'Online'}</span>

          {/* Tooltip */}
          {showHealthTooltip && agentHealth && (
            <div className="absolute top-full right-0 mt-1 w-52 bg-slate-800 border border-slate-600/50 rounded-lg shadow-xl p-2 z-50">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Agent Status</p>
              {[
                ['vision_agent', 'Vision Agent'],
                ['duplicate_agent', 'Duplicate Agent'],
                ['route_safety_agent', 'Route Safety'],
                ['escalation_agent', 'Escalation'],
                ['nearby_agent', 'Nearby Agent'],
                ['database', 'Database'],
              ].map(([key, label]) => {
                const status = agentHealth[key as keyof AgentHealth];
                const ok = status === 'ok';
                return (
                  <div key={key} className="flex items-center justify-between py-0.5">
                    <span className="text-[11px] text-slate-300">{label}</span>
                    <span className="text-[11px]">{ok ? '✅' : '❌'}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Stats ─── */}
      <SectionHeader title="Overview" />
      {stats && (
        <div className="px-1 py-1">
          <div className="grid grid-cols-3 gap-2 px-3 py-2">
            {[
              { icon: '📍', label: 'Total Issues', value: stats.total_issues ?? 0, color: 'text-blue-400' },
              { icon: '🔴', label: 'Open', value: stats.open ?? 0, color: 'text-red-400' },
              { icon: '✅', label: 'Resolved', value: stats.resolved ?? 0, color: 'text-green-400' },
            ].map((stat) => (
              <div key={stat.label} className="bg-slate-700/60 rounded-xl p-3 flex flex-col items-center min-h-0">
                <span className="text-lg mb-1">{stat.icon}</span>
                <span className={`text-xl font-bold leading-tight ${stat.color}`}>{stat.value}</span>
                <span className="text-[10px] text-slate-400 text-center mt-0.5 leading-tight">{stat.label}</span>
              </div>
            ))}
          </div>

          {/* Category breakdown */}
          <div className="px-3 pb-2 flex flex-wrap gap-1">
            {stats.by_category && Object.entries(stats.by_category).map(([cat, count]) => (
              <span key={cat} className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                {categoryEmoji[cat] || '⚠️'} {cat.replace('_', ' ')} · {count as number}
              </span>
            ))}
          </div>
        </div>
      )}

      <Divider />

      {/* ── Filter & Search ─── */}
      <div className="px-4 py-3 space-y-2 border-b border-slate-700/40">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search issues…"
            className="w-full pl-8 pr-8 py-1.5 rounded-lg bg-slate-700/50 border border-slate-600/40
                       text-xs text-white placeholder:text-slate-500 focus:outline-none
                       focus:border-blue-500/50 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTER_CATEGORIES.map((fc) => (
            <button
              key={fc.value}
              onClick={() => setFilter(fc.value)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                filter === fc.value
                  ? 'bg-blue-500/25 text-blue-300 border border-blue-500/40'
                  : 'bg-slate-700/40 text-slate-400 border border-transparent hover:bg-slate-700/60'
              }`}
            >
              {fc.label}
            </button>
          ))}
        </div>
      </div>

      <SectionHeader title="Recent Issues" />

      {/* ── Issue list ─── */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <span className="text-3xl mb-2">🎉</span>
            <p className="text-sm font-medium text-slate-300">No issues reported</p>
            <p className="text-xs text-slate-500 mt-1">Area looks safe!</p>
          </div>
        )}
        {filtered.map((issue) => (
          <div
            key={issue.id}
            onClick={() => onSelectIssue(issue)}
            className={`rounded-xl p-3 cursor-pointer transition-colors duration-150 border mb-2 ${
              issue.id === selectedIssueId
                ? 'bg-slate-700 border-blue-500/50'
                : 'bg-slate-700/50 hover:bg-slate-700 border-slate-600/30'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base flex-shrink-0">{categoryEmoji[issue.category] || '⚠️'}</span>
                <span className="text-sm text-white font-medium truncate">{issue.title}</span>
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${severityColor[issue.severity] || 'bg-gray-500 text-white'}`}>
                {issue.severity?.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
              <span>🕐 {timeAgo(issue.created_at)}</span>
              <span>👍 {issue.votes ?? 0}</span>
              {issue.status === 'resolved' && <span className="text-green-400">✅ Resolved</span>}
            </div>
          </div>
        ))}
      </div>

      <Divider />
      <SectionHeader title="Tools" />

      {/* ── Actions ─── */}
      <div className="px-4 py-3 border-b border-slate-700/40 space-y-2">
        <button
          onClick={handleEscalate}
          disabled={escalating}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg
                     bg-red-600/20 hover:bg-red-600/30 border border-red-500/30
                     text-red-400 text-xs font-medium transition-all
                     disabled:opacity-50"
        >
          {escalating ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Megaphone size={14} />
          )}
          Escalate Issues
        </button>
        <button
          onClick={onToggleLegend}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg
                     bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/30
                     text-slate-300 text-xs font-medium transition-all"
        >
          🗺️ Map Legend
        </button>
      </div>
    </div>
  );
}
