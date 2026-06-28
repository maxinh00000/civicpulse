import { useState } from 'react';
import {
  Navigation, Loader2, AlertTriangle, CheckCircle2,
  Droplets, Trash2, Lightbulb, HelpCircle, ChevronDown, ChevronUp,
  MapPin, Route,
} from 'lucide-react';
import { checkRouteSafety, geocodeAddress } from '../api';
import type { RouteWarning } from '../types';
import toast from 'react-hot-toast';

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

interface RouteSafetyProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function RouteSafety({ isOpen, onToggle }: RouteSafetyProps) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [warnings, setWarnings] = useState<RouteWarning[] | null>(null);
  const [summary, setSummary] = useState('');

  /* ── Geocode address with Nominatim Proxy ─── */
  async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const result = await geocodeAddress(address);
      if (result.success && result.lat !== undefined && result.lng !== undefined) {
        return { lat: result.lat, lng: result.lng };
      }
      return null;
    } catch {
      return null;
    }
  }

  const handleCheck = async () => {
    if (!from.trim() || !to.trim()) {
      toast.error('Enter both addresses');
      return;
    }
    setLoading(true);
    setWarnings(null);
    try {
      const [origin, destination] = await Promise.all([geocode(from), geocode(to)]);
      if (!origin) {
        toast.error(`Could not find: "${from}"`);
        return;
      }
      if (!destination) {
        toast.error(`Could not find: "${to}"`);
        return;
      }
      const result = await checkRouteSafety(origin, destination);
      setWarnings(result.warnings);
      setSummary(result.total > 0 ? `${result.total} issue${result.total !== 1 ? 's' : ''} found near your route` : '');
    } catch {
      toast.error('Route safety check failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-[900] transition-all duration-300 ${
        isOpen ? '' : 'translate-y-[calc(100%-48px)]'
      }`}
    >
      {/* ── Toggle bar ─── */}
      <button
        onClick={onToggle}
        className="w-full glass flex items-center justify-center gap-2 py-3 px-4
                   text-sm font-medium text-slate-300 hover:text-white transition-colors
                   border-t border-slate-700/50"
      >
        <Route size={16} className="text-blue-400" />
        Route Safety Check
        {isOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>

      {/* ── Panel content ─── */}
      <div className="bg-civic-sidebar border-t border-slate-700/50 p-5 panel-bottom-enter">
        <div className="max-w-3xl mx-auto">
          {/* ── Input row ─── */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex-1 relative">
              <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-green-400" />
              <input
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="Starting address"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-700/60 border border-slate-600/50
                           text-white text-sm placeholder:text-slate-500 focus:outline-none
                           focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all"
              />
            </div>
            <div className="flex-1 relative">
              <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-red-400" />
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="Destination address"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-700/60 border border-slate-600/50
                           text-white text-sm placeholder:text-slate-500 focus:outline-none
                           focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all"
              />
            </div>
            <button
              onClick={handleCheck}
              disabled={loading}
              className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm
                         font-medium disabled:opacity-50 transition-all flex items-center gap-2
                         whitespace-nowrap shadow-lg shadow-blue-600/20"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Navigation size={16} />
              )}
              Check Route
            </button>
          </div>

          {/* ── Results ─── */}
          {warnings !== null && (
            <div className="animate-fade-in">
              {warnings.length === 0 ? (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <CheckCircle2 size={22} className="text-green-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-400">Route is clear!</p>
                    <p className="text-xs text-green-400/70 mt-0.5">
                      No civic issues found along your route.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {summary && (
                    <p className="text-xs text-slate-400 mb-2">{summary}</p>
                  )}
                  {warnings.map((w, i) => {
                    const WIcon = CATEGORY_ICONS[w.category] || HelpCircle;
                    const sColor = SEVERITY_COLORS[w.severity] || '#94a3b8';
                    return (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-3 rounded-lg bg-slate-700/40 border border-slate-600/30"
                      >
                        <div
                          className="p-1.5 rounded-lg flex-shrink-0"
                          style={{ background: `${sColor}20` }}
                        >
                          <WIcon size={15} style={{ color: sColor }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-200">{w.warning_message}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {w.distance_meters}m away · {w.category.replace(/_/g, ' ')}
                          </p>
                        </div>
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0"
                          style={{ background: `${sColor}20`, color: sColor }}
                        >
                          {w.severity}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
