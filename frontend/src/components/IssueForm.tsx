import { useState, useRef, useCallback } from 'react';
import {
  X, Upload, Loader2, Sparkles, Image as ImageIcon,
  AlertTriangle, MapPin, CheckCircle2, ExternalLink,
} from 'lucide-react';
import { uploadImage, createIssue, voteIssue } from '../api';
import { getUserId } from '../utils/userId';
import toast from 'react-hot-toast';

interface IssueFormProps {
  lat: number;
  lng: number;
  onClose: () => void;
  onSubmit: () => void;
  onViewIssue?: (issueId: string) => void;
}

const CATEGORIES = [
  { value: 'pothole', label: 'Pothole' },
  { value: 'water_leakage', label: 'Water Leakage' },
  { value: 'garbage', label: 'Garbage' },
  { value: 'streetlight', label: 'Streetlight' },
  { value: 'other', label: 'Other' },
];

const SEVERITIES = [
  { value: 'low', label: 'Low', color: '#22c55e' },
  { value: 'medium', label: 'Medium', color: '#eab308' },
  { value: 'high', label: 'High', color: '#f97316' },
  { value: 'critical', label: 'Critical', color: '#ef4444' },
];

export default function IssueForm({ lat, lng, onClose, onSubmit, onViewIssue }: IssueFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('pothole');
  const [severity, setSeverity] = useState('medium');
  const [address, setAddress] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const [aiConfidence, setAiConfidence] = useState<number | null>(null);
  const [aiCategory, setAiCategory] = useState<string | null>(null);
  const [titleAiSuggested, setTitleAiSuggested] = useState(false);
  const [descAiSuggested, setDescAiSuggested] = useState(false);

  const [duplicateInfo, setDuplicateInfo] = useState<{
    existingIssueId: string;
    category: string;
    distanceMeters: number;
  } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    setUploading(true);
    setDuplicateInfo(null);
    try {
      const result = await uploadImage(file);
      console.log('UPLOAD IMAGE RESULT:', result);
      setImageUrl(result.image_url);
      
      const apiCategory = result.category ? result.category.toLowerCase().replace(' ', '_') : 'other';
      const isValidCategory = CATEGORIES.some(c => c.value === apiCategory);
      const matchedCategory = isValidCategory ? apiCategory : 'other';
      setCategory(matchedCategory);

      if (result.severity) {
        setSeverity(result.severity);
      }

      if (result.confidence !== undefined) {
        setAiConfidence(result.confidence);
        setAiCategory(matchedCategory);
      }

      if (result.title) {
        setTitle(result.title);
        setTitleAiSuggested(true);
      }
      if (result.description) {
        setDescription(result.description);
        setDescAiSuggested(true);
      }
      toast.success('AI analysis complete - fields pre-filled!');
    } catch (err) {
      console.error('AI detection failed:', err);
      toast.error('AI detection failed - please fill fields manually');
    } finally {
      setUploading(false);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast.error('Title is required'); return; }
    setSubmitting(true);
    setDuplicateInfo(null);
    try {
      const result = await createIssue({
        title, description,
        category: category as any, severity: severity as any,
        address, latitude: lat, longitude: lng,
        image_url: imageUrl, reporter_id: getUserId(),
        confidence: aiConfidence ?? null,
      });
      if (result.merged && result.existing_issue_id) {
        setDuplicateInfo({
          existingIssueId: result.existing_issue_id,
          category,
          distanceMeters: Math.round(result.distance_meters ?? 0),
        });
        try { await voteIssue(result.existing_issue_id, getUserId()); } catch {}
        onSubmit();
      } else {
        toast.success('Issue reported successfully!');
        onSubmit();
        onClose();
      }
    } catch {
      toast.error('Failed to submit issue');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] z-[1000] panel-enter">
      <div className="absolute inset-0 sm:hidden bg-black/50" onClick={onClose} />
      <div className="relative h-full bg-civic-sidebar border-l border-slate-700/50 overflow-y-auto flex flex-col">
        <div className="sticky top-0 z-10 glass px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <AlertTriangle size={20} className="text-blue-400" />
              Report Issue
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
              <MapPin size={12} />{lat.toFixed(5)}, {lng.toFixed(5)}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700/60 text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-4 p-5">
          {duplicateInfo && (
            <div className="rounded-xl p-4 bg-amber-500/10 border border-amber-500/30 flex flex-col gap-3">
              <div className="flex items-start gap-2">
                <span className="text-xl flex-shrink-0">🔄</span>
                <div>
                  <p className="text-sm font-semibold text-amber-300">Duplicate Detected!</p>
                  <p className="text-xs text-amber-200/80 mt-0.5">
                    A similar <strong className="capitalize">{duplicateInfo.category.replace(/_/g, ' ')}</strong> issue
                    was already reported <strong>{duplicateInfo.distanceMeters}m</strong> from this location.
                    Your report has been merged with the existing issue and your vote has been added.
                  </p>
                </div>
              </div>
              <button type="button"
                onClick={() => { onClose(); onViewIssue?.(duplicateInfo.existingIssueId); }}
                className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-sm font-medium border border-amber-500/30 transition-all">
                <ExternalLink size={14} />View Existing Issue
              </button>
              <button type="button" onClick={onClose} className="text-xs text-slate-500 hover:text-slate-300 transition-colors text-center">
                Close form
              </button>
            </div>
          )}

          <div
            className={`drop-zone rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer min-h-[140px] transition-all ${dragOver ? 'drag-over' : ''}`}
            onClick={() => fileRef.current?.click()}
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); }} />
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={32} className="text-blue-400 animate-spin" />
                <p className="text-sm text-slate-400">AI analyzing image...</p>
              </div>
            ) : imageUrl ? (
              <div className="w-full">
                <img src={imageUrl} alt="Uploaded" className="w-full h-32 object-cover rounded-lg" />
                <p className="text-xs text-slate-400 mt-2">Click to replace</p>
              </div>
            ) : (
              <>
                <Upload size={28} className="text-slate-500 mb-2" />
                <p className="text-sm text-slate-400">Drop an image or <span className="text-blue-400 font-medium">click to upload</span></p>
                <p className="text-xs text-slate-500 mt-1">AI will auto-detect the issue</p>
              </>
            )}
          </div>

          {aiConfidence !== null && aiCategory && (
            (aiConfidence === 0.1 || aiCategory === 'other') ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />
                <p className="text-xs text-amber-300">
                  Low confidence detection — please verify
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
                <p className="text-xs text-green-300">
                  AI detected: <strong className="text-green-200 capitalize">{aiCategory.replace(/_/g, ' ')}</strong>
                  {' '}({Math.round(aiConfidence * 100)}% confident)
                </p>
              </div>
            )
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-2">
              Title *
              {titleAiSuggested && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/25 text-blue-400 text-[10px] font-medium">
                  <Sparkles size={9} />AI suggested
                </span>
              )}
            </label>
            <input value={title} onChange={(e) => { setTitle(e.target.value); setTitleAiSuggested(false); }}
              placeholder="Brief issue title"
              className="w-full px-3 py-2.5 rounded-lg bg-slate-700/60 border border-slate-600/50 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all"
              required />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-2">
              Description
              {descAiSuggested && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/25 text-blue-400 text-[10px] font-medium">
                  <Sparkles size={9} />AI suggested
                </span>
              )}
            </label>
            <textarea value={description} onChange={(e) => { setDescription(e.target.value); setDescAiSuggested(false); }}
              placeholder="Describe the issue in detail..." rows={3}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-700/60 border border-slate-600/50 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-700/60 border border-slate-600/50 text-white text-sm focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all appearance-none">
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Severity</label>
              <select value={severity} onChange={(e) => setSeverity(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-700/60 border border-slate-600/50 text-white text-sm focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all appearance-none">
                {SEVERITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 px-1">
            {SEVERITIES.map((s) => (
              <button key={s.value} type="button" onClick={() => setSeverity(s.value)}
                className={`w-6 h-6 rounded-full border-2 transition-all ${severity === s.value ? 'scale-125 border-white' : 'border-transparent opacity-50 hover:opacity-75'}`}
                style={{ background: s.color }} title={s.label} />
            ))}
            <span className="text-xs text-slate-400 ml-1 capitalize">{severity}</span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Address</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)}
              placeholder="Street address or landmark"
              className="w-full px-3 py-2.5 rounded-lg bg-slate-700/60 border border-slate-600/50 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all" />
          </div>

          <div className="flex-1" />

          {!duplicateInfo && (
            <button type="submit" disabled={submitting || !title.trim()}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25">
              {submitting ? <><Loader2 size={18} className="animate-spin" /> Submitting...</> : <><ImageIcon size={18} /> Submit Report</>}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
