import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

const CATEGORIES = [
  { emoji: '🕳️', label: 'Pothole', color: '#ef4444' },
  { emoji: '💧', label: 'Water Leakage', color: '#3b82f6' },
  { emoji: '🗑️', label: 'Garbage', color: '#22c55e' },
  { emoji: '💡', label: 'Streetlight', color: '#eab308' },
  { emoji: '⚠️', label: 'Other', color: '#9ca3af' },
];

const SEVERITIES = [
  { label: 'Critical', opacity: 1.0 },
  { label: 'High', opacity: 0.85 },
  { label: 'Medium', opacity: 0.65 },
  { label: 'Low', opacity: 0.45 },
];

interface LegendPanelProps {
  onClose: () => void;
}

export default function LegendPanel({ onClose }: LegendPanelProps) {
  const [pos, setPos] = useState({
    x: typeof window !== 'undefined' ? window.innerWidth - 220 : 500,
    y: typeof window !== 'undefined' ? window.innerHeight - 340 : 400,
  });
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    };
    const onMouseUp = () => { dragging.current = false; };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  };

  return (
    <div
      className="fixed z-[1500] w-48 bg-slate-800/95 backdrop-blur-md rounded-xl shadow-2xl
                 shadow-black/40 border border-slate-700/50 text-xs text-white select-none"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Header — drag handle */}
      <div
        className="flex items-center justify-between px-3 py-2.5 cursor-move border-b border-slate-700/50"
        onMouseDown={onMouseDown}
      >
        <span className="font-semibold text-slate-200">🗺️ Legend</span>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-slate-700/60 text-slate-500 hover:text-white transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      <div className="px-3 py-2.5 space-y-3">
        {/* Category */}
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Category</p>
          <div className="space-y-1">
            {CATEGORIES.map((c) => (
              <div key={c.label} className="flex items-center gap-2">
                <span className="text-sm leading-none">{c.emoji}</span>
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0"
                  style={{ background: c.color }}
                />
                <span className="text-slate-300">{c.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Severity */}
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Severity</p>
          <div className="space-y-1">
            {SEVERITIES.map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <span
                  className="text-sm leading-none"
                  style={{ opacity: s.opacity }}
                >⬤</span>
                <span className="text-slate-300">{s.label}</span>
                <span className="text-slate-600 ml-auto">{Math.round(s.opacity * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
