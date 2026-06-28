import { useState, useEffect } from 'react';
import {
  MapPin, X, AlertTriangle, Droplets, Trash2,
  Lightbulb, HelpCircle, Navigation,
} from 'lucide-react';
import { getNearbyIssues } from '../api';
import type { Issue } from '../types';

const CATEGORY_ICONS: Record<string, typeof AlertTriangle> = {
  pothole: AlertTriangle,
  water_leakage: Droplets,
  garbage: Trash2,
  streetlight: Lightbulb,
  other: HelpCircle,
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

interface NearbyBannerProps {
  onSelectIssue: (issue: Issue) => void;
}

export default function NearbyBanner({ onSelectIssue }: NearbyBannerProps) {
  const [nearbyIssues, setNearbyIssues] = useState<NearbyIssue[]>([]);
  const [summary, setSummary] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const result = await getNearbyIssues(
            position.coords.latitude,
            position.coords.longitude,
            3,
          );
          setNearbyIssues(result.issues);
          setSummary(result.summary);
        } catch {
          // Silently fail — banner just won't show
        } finally {
          setLoading(false);
        }
      },
      () => {
        setLoading(false);
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }, []);

  if (loading || dismissed || nearbyIssues.length === 0) return null;

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[850] w-[90%] max-w-lg animate-fade-in">
      {/* Collapsed banner */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl
                   bg-slate-800/90 backdrop-blur-md border border-slate-700/60
                   shadow-xl shadow-black/30 hover:bg-slate-800/95 transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <Navigation size={16} className="text-amber-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-white">{summary}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {expanded ? 'Click to collapse' : 'Click to see details'}
            </p>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
          className="p-1 rounded-md hover:bg-slate-700/60 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X size={14} />
        </button>
      </button>

      {/* Expanded list */}
      {expanded && (
        <div className="mt-2 rounded-xl bg-slate-800/90 backdrop-blur-md border border-slate-700/60
                        shadow-xl shadow-black/30 max-h-60 overflow-y-auto animate-fade-in">
          <div className="p-2 space-y-1">
            {nearbyIssues.map((issue) => {
              const CatIcon = CATEGORY_ICONS[issue.category] || HelpCircle;
              const sColor = SEVERITY_COLORS[issue.severity] || '#94a3b8';
              return (
                <button
                  key={issue.id}
                  onClick={() => { onSelectIssue(issue); setExpanded(false); }}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg
                             hover:bg-slate-700/50 transition-colors text-left"
                >
                  <div
                    className="p-1.5 rounded-lg flex-shrink-0"
                    style={{ background: `${sColor}20` }}
                  >
                    <CatIcon size={14} style={{ color: sColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{issue.title}</p>
                    <p className="text-[11px] text-slate-500">
                      {issue.category.replace(/_/g, ' ')} · {issue.distance_meters}m away
                    </p>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase flex-shrink-0"
                    style={{ background: `${sColor}20`, color: sColor }}
                  >
                    {issue.severity}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
