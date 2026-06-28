import { X } from 'lucide-react';
import type { Issue } from '../types';

const CATEGORY_EMOJI: Record<string, string> = {
  pothole: '🕳️',
  water_leakage: '💧',
  garbage: '🗑️',
  streetlight: '💡',
  other: '⚠️',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

interface NearbyIssue extends Issue {
  distance_meters: number;
}

interface NearbyPanelProps {
  issues: NearbyIssue[];
  onClose: () => void;
  onIssueClick: (issue: Issue) => void;
  buttonPosition?: { x: number; y: number };
}

export default function NearbyPanel({ issues, onClose, onIssueClick, buttonPosition }: NearbyPanelProps) {
  const panelStyle = buttonPosition
    ? {
        left: buttonPosition.x,
        bottom: window.innerHeight - buttonPosition.y + 12,
      }
    : {
        left: '1rem',
        bottom: '7rem',
      };

  return (
    <div
      style={panelStyle}
      className="fixed z-[1001] w-72 max-h-80 bg-slate-800/95 backdrop-blur-md
                 rounded-xl shadow-2xl shadow-black/40 border border-slate-700/50
                 flex flex-col overflow-hidden animate-fade-in"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-700/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-base">🚨</span>
          <span className="text-xs font-semibold text-white">Nearby Issues (within 1km)</span>
        </div>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-slate-700/60 text-slate-500 hover:text-white transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      {/* Count badge */}
      <div className="px-3 py-1.5 border-b border-slate-700/40 flex-shrink-0">
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">
          {issues.length} open issue{issues.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-1">
        {issues.length === 0 && (
          <div className="flex flex-col items-center py-6 text-center">
            <span className="text-3xl mb-2">🌟</span>
            <p className="text-sm text-slate-300 font-medium">All clear nearby!</p>
            <p className="text-xs text-slate-500 mt-1">No open issues within 1km</p>
          </div>
        )}
        {issues.map((issue) => {
          const emoji = CATEGORY_EMOJI[issue.category] || '⚠️';
          const sColor = SEVERITY_COLORS[issue.severity] || '#94a3b8';
          return (
            <button
              key={issue.id}
              onClick={() => onIssueClick(issue)}
              className="w-full flex items-center gap-2.5 p-2 rounded-lg
                         hover:bg-slate-700/50 transition-colors text-left"
            >
              <span className="text-base flex-shrink-0">{emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-200 truncate">{issue.title}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {issue.distance_meters}m away
                </p>
              </div>
              <span
                className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase flex-shrink-0"
                style={{ background: `${sColor}20`, color: sColor }}
              >
                {issue.severity}
              </span>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-slate-700/40 flex-shrink-0">
        <p className="text-[10px] text-slate-500 text-center">
          Showing issues within 1km of your location
        </p>
      </div>
    </div>
  );
}
