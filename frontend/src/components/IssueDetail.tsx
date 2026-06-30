import { useState } from 'react';
import {
  X, ThumbsUp, CheckCircle2, Clock, MapPin, Copy, Phone,
  ExternalLink, AlertTriangle, Droplets, Trash2, Lightbulb,
  HelpCircle, Sparkles, Shield, FileText, Navigation,
} from 'lucide-react';
import type { Issue } from '../types';
import toast from 'react-hot-toast';

interface IssueDetailProps {
  issue: Issue;
  onClose: () => void;
  onVote: (id: string) => void;
  onResolve: (id: string) => void;
  onSelectDirections?: (lat: number, lng: number, label: string) => void;
  onSelectStartNavigation?: (lat: number, lng: number, label: string) => void;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

const CATEGORY_ICONS: Record<string, typeof AlertTriangle> = {
  pothole: AlertTriangle,
  water_leakage: Droplets,
  garbage: Trash2,
  streetlight: Lightbulb,
  other: HelpCircle,
};

const AUTHORITY_INFO: Record<string, { name: string; helpline: string; detail: string }> = {
  pothole: { name: 'BBMP', helpline: '1533', detail: 'bbmp.gov.in' },
  water_leakage: { name: 'BWSSB', helpline: '1916', detail: 'Bangalore Water Supply and Sewerage Board' },
  garbage: { name: 'BBMP Solid Waste', helpline: '1533', detail: 'Solid Waste Management Division' },
  streetlight: { name: 'BESCOM', helpline: '1912', detail: 'Bangalore Electricity Supply Company' },
  other: { name: 'BBMP General', helpline: '1533', detail: 'bbmp.gov.in' },
};

function categoryLabel(cat: string) {
  return cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function generateComplaint(issue: Issue): string {
  const authority = AUTHORITY_INFO[issue.category] || AUTHORITY_INFO.other;
  return `To: ${authority.name}
Subject: Complaint Regarding ${categoryLabel(issue.category)} at ${issue.address || 'Reported Location'}

Dear Sir/Madam,

I would like to bring to your notice that there is a ${categoryLabel(issue.category).toLowerCase()} issue at the following location:

Location: ${issue.address || `Lat: ${issue.latitude}, Lng: ${issue.longitude}`}
Category: ${categoryLabel(issue.category)}
Severity: ${issue.severity.toUpperCase()}
Reported: ${formatDate(issue.created_at)}
Votes/Confirmations: ${issue.votes}

Description: ${issue.description || issue.title}

This issue has been reported on CivicPulse and confirmed by ${issue.votes} citizen(s). I request you to kindly take immediate action to resolve this matter.

Thank you,
A Concerned Citizen
CivicPulse Issue ID: ${issue.id}`;
}

export default function IssueDetail({ issue, onClose, onVote, onResolve, onSelectDirections, onSelectStartNavigation }: IssueDetailProps) {
  const [showComplaint, setShowComplaint] = useState(false);
  const CatIcon = CATEGORY_ICONS[issue.category] || HelpCircle;
  const authority = AUTHORITY_INFO[issue.category] || AUTHORITY_INFO.other;
  const sevColor = SEVERITY_COLORS[issue.severity] || '#94a3b8';

  const copyComplaint = () => {
    navigator.clipboard.writeText(generateComplaint(issue));
    toast.success('Complaint copied to clipboard!');
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] z-[1000] panel-enter">
      <div
        className="absolute inset-0 sm:hidden bg-black/50"
        onClick={onClose}
      />

      <div className="relative h-full bg-civic-sidebar border-l border-slate-700/50 overflow-y-auto flex flex-col">
        {/* ── Header ─── */}
        <div className="sticky top-0 z-10 glass px-5 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white truncate pr-4">Issue Details</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-700/60 text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 flex flex-col gap-4 p-5">
          {/* ── Image ─── */}
          {issue.image_url && issue.image_url.startsWith('http') && !issue.image_url.includes('null') && (
            <div className="rounded-xl overflow-hidden border border-slate-700/50">
              <img
                src={issue.image_url}
                alt={issue.title}
                className="w-full h-48 object-cover"
                onError={(e) => {
                  (e.currentTarget.parentElement as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          )}

          {/* ── Title & badges ─── */}
          <div>
            <h3 className="text-xl font-bold text-white leading-tight mb-3">
              {issue.title}
            </h3>
            <div className="flex flex-wrap gap-2">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                style={{ background: 'rgba(59,130,246,0.15)', color: '#93c5fd' }}
              >
                <CatIcon size={13} />
                {categoryLabel(issue.category)}
              </span>
              <span
                className="px-3 py-1 rounded-full text-xs font-medium"
                style={{ background: `${sevColor}20`, color: sevColor }}
              >
                {issue.severity.toUpperCase()}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                  issue.status === 'resolved'
                    ? 'bg-green-500/15 text-green-400'
                    : 'bg-amber-500/15 text-amber-400'
                }`}
              >
                {issue.status === 'resolved' ? (
                  <CheckCircle2 size={13} />
                ) : (
                  <Clock size={13} />
                )}
                {issue.status.toUpperCase()}
              </span>
            </div>
          </div>

          {/* ── Description ─── */}
          {issue.description && (
            <p className="text-sm text-slate-300 leading-relaxed">
              {issue.description}
            </p>
          )}

          {/* ── Metadata ─── */}
          <div className="space-y-2.5 py-2">
            {issue.address && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin size={15} className="text-slate-500 mt-0.5 flex-shrink-0" />
                <span className="text-slate-300">{issue.address}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Clock size={15} className="text-slate-500 flex-shrink-0" />
              <span className="text-slate-400">{formatDate(issue.created_at)}</span>
            </div>
            {issue.confidence !== null && issue.confidence !== undefined && (
              <div className="flex items-center gap-2 text-sm">
                <Sparkles size={15} className="text-blue-400 flex-shrink-0" />
                <span className="text-blue-300">
                  AI Confidence: {Math.round(issue.confidence * 100)}%
                </span>
              </div>
            )}
          </div>

          {/* ── Vote & Resolve ─── */}
          <div className="flex gap-3">
            <button
              onClick={() => onVote(issue.id)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                         bg-slate-700/60 hover:bg-slate-700 border border-slate-600/40
                         text-slate-200 text-sm font-medium transition-all hover:border-blue-500/40"
            >
              <ThumbsUp size={16} />
              Upvote ({issue.votes})
            </button>
            {issue.status !== 'resolved' && (
              <button
                onClick={() => onResolve(issue.id)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                           bg-green-600/20 hover:bg-green-600/30 border border-green-500/30
                           text-green-400 text-sm font-medium transition-all hover:border-green-500/50"
              >
                <CheckCircle2 size={16} />
                Mark Resolved
              </button>
            )}
          </div>

          {/* ── Directions & Navigation Actions ─── */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                const label = issue.address || issue.title;
                onSelectDirections?.(issue.latitude, issue.longitude, label);
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                         bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30
                         text-blue-400 text-sm font-medium transition-all"
            >
              <Navigation size={16} />
              Directions
            </button>
            <button
              onClick={() => {
                const label = issue.address || issue.title;
                onSelectStartNavigation?.(issue.latitude, issue.longitude, label);
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                         bg-green-600/20 hover:bg-green-600/30 border border-green-500/30
                         text-green-400 text-sm font-medium transition-all"
            >
              🚀 Start Nav
            </button>
          </div>

          {/* ── Authority ─── */}
          <div className="rounded-xl bg-slate-700/40 border border-slate-600/30 p-4">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
              <Shield size={15} className="text-blue-400" />
              Report to Authority
            </h4>
            <div className="space-y-2">
              <p className="text-sm text-slate-300 font-medium">{authority.name}</p>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Phone size={13} />
                Helpline: <span className="text-white font-medium">{authority.helpline}</span>
              </div>
              <p className="text-xs text-slate-500">{authority.detail}</p>
            </div>
          </div>

          {/* ── Complaint Generator ─── */}
          <div>
            <button
              onClick={() => setShowComplaint(!showComplaint)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                         bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30
                         text-blue-400 text-sm font-medium transition-all"
            >
              <FileText size={16} />
              {showComplaint ? 'Hide' : 'Generate'} Complaint Text
            </button>

            {showComplaint && (
              <div className="mt-3 animate-fade-in">
                <pre className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/50
                                text-xs text-slate-300 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                  {generateComplaint(issue)}
                </pre>
                <button
                  onClick={copyComplaint}
                  className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                             bg-slate-700/60 hover:bg-slate-700 text-xs text-slate-300
                             font-medium transition-colors"
                >
                  <Copy size={13} /> Copy to Clipboard
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
