import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, X, MapPin, Navigation, Loader2, AlertTriangle,
  Clock, ArrowRight,
} from 'lucide-react';
import { checkRouteSafety, reverseGeocode } from '../api';
import type { RouteWarning } from '../types';
import toast from 'react-hot-toast';

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e',
};
const SEVERITY_EMOJI: Record<string, string> = {
  critical: '🔴', high: '🟠', medium: '🟡', low: '🟢',
};

interface Suggestion { display_name: string; lat: string; lon: string; }
type TransportMode = 'driving' | 'cycling' | 'walking' | 'transit';

interface SearchBarProps {
  onDrawRoute: (coords: [number, number][] | null) => void;
  onSafetyWarnings: (warnings: RouteWarning[] | null) => void;
  onStartNavigation?: (routeCoords: [number, number][], warnings: RouteWarning[]) => void;
  onStopNavigation?: () => void;
  externalDestination?: { lat: number; lng: number; label: string } | null;
  onClearExternalDestination?: () => void;
  directionsMode?: boolean;
  onDirectionsModeChange?: (expanded: boolean) => void;
  activeRouteField?: 'from' | 'to' | null;
  onActiveFieldChange?: (field: 'from' | 'to' | null) => void;
  mapClickCoords?: { lat: number; lng: number } | null;
  onClearMapClick?: () => void;
}

const TRANSPORT_MODES: { id: TransportMode; label: string; osrm: string }[] = [
  { id: 'driving', label: 'Drive', osrm: 'driving' },
  { id: 'cycling', label: 'Bike', osrm: 'cycling' },
  { id: 'walking', label: 'Walk', osrm: 'foot' },
  { id: 'transit', label: 'Transit', osrm: 'foot' },
];

export default function SearchBar({
  onDrawRoute,
  onSafetyWarnings,
  onStartNavigation,
  onStopNavigation,
  externalDestination,
  onClearExternalDestination,
  directionsMode = false,
  onDirectionsModeChange,
  activeRouteField = null,
  onActiveFieldChange,
  mapClickCoords = null,
  onClearMapClick,
}: SearchBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [fromText, setFromText] = useState('My Location');
  const [toText, setToText] = useState('');
  const [fromCoords, setFromCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [toCoords, setToCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeField, setActiveField] = useState<'from' | 'to' | null>(null);
  const [loading, setLoading] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [warnings, setWarnings] = useState<RouteWarning[] | null>(null);
  const [warningCount, setWarningCount] = useState(0);
  const [transportMode, setTransportMode] = useState<TransportMode>('driving');
  const [routeCoords, setRouteCoords] = useState<[number, number][] | null>(null);
  const [navigating, setNavigating] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const updateExpanded = (val: boolean) => {
    setExpanded(val);
    onDirectionsModeChange?.(val);
  };

  const updateActiveField = (val: 'from' | 'to' | null) => {
    setActiveField(val);
    onActiveFieldChange?.(val);
  };

  useEffect(() => {
    if (directionsMode !== undefined) {
      setExpanded(directionsMode);
    }
  }, [directionsMode]);

  useEffect(() => {
    if (activeRouteField !== undefined) {
      setActiveField(activeRouteField);
    }
  }, [activeRouteField]);

  useEffect(() => {
    if (!mapClickCoords || !expanded || !activeField) return;
    const { lat, lng } = mapClickCoords;
    console.log("clickedLatLng", { lat, lng });

    reverseGeocode(lat, lng).then((res) => {
      const shortName = (res.success && res.address)
        ? res.address.split(',').slice(0, 3).join(',')
        : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      
      if (activeField === 'from') {
        setFromText(shortName);
        setFromCoords({ lat, lng });
      } else {
        setToText(shortName);
        setToCoords({ lat, lng });
      }
    }).catch(() => {
      const coordsText = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      if (activeField === 'from') {
        setFromText(coordsText);
        setFromCoords({ lat, lng });
      } else {
        setToText(coordsText);
        setToCoords({ lat, lng });
      }
    }).finally(() => {
      onClearMapClick?.();
    });
  }, [mapClickCoords, expanded, activeField, onClearMapClick]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setFromCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => { setFromText(''); setFromCoords(null); },
        { enableHighAccuracy: false, timeout: 8000 },
      );
    }
  }, []);

  useEffect(() => {
    const autoRoute = async () => {
      if (!externalDestination) return;

      const dest = { lat: externalDestination.lat, lng: externalDestination.lng };
      setToCoords(dest);
      setToText(externalDestination.label);
      setExpanded(true);

      // Get user starting position
      let start = fromCoords;
      if (!start) {
        setLoading(true);
        try {
          start = await new Promise<{ lat: number; lng: number }>((resolve, reject) => {
            if (!navigator.geolocation) {
              reject(new Error("No geolocation"));
              return;
            }
            navigator.geolocation.getCurrentPosition(
              (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
              (err) => reject(err),
              { enableHighAccuracy: true, timeout: 6000 }
            );
          });
          setFromCoords(start);
          setFromText('My Location');
        } catch {
          toast.error('Could not get current location. Please enter starting point.');
          setLoading(false);
          onClearExternalDestination?.();
          return;
        }
      }

      // Draw route immediately
      setLoading(true);
      setWarnings(null);
      setRouteInfo(null);
      setRouteCoords(null);
      try {
        const modeConfig = TRANSPORT_MODES.find(m => m.id === transportMode)!;
        const url = `http://router.project-osrm.org/route/v1/${modeConfig.osrm}/${start.lng},${start.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.code !== 'Ok' || !data.routes?.length) {
          toast.error('Could not find a route');
          return;
        }
        const route = data.routes[0];
        const coords: [number, number][] = route.geometry.coordinates.map(
          (c: [number, number]) => [c[1], c[0]] as [number, number]
        );
        setRouteCoords(coords);
        onDrawRoute(coords);
        onSafetyWarnings(null);
        const distKm = (route.distance / 1000).toFixed(1);
        const durMin = Math.round(route.duration / 60);
        setRouteInfo({ distance: `${distKm} km`, duration: `${durMin} min` });
      } catch {
        toast.error('Directions failed');
      } finally {
        setLoading(false);
        onClearExternalDestination?.();
      }
    };

    autoRoute();
  }, [externalDestination, fromCoords, onClearExternalDestination, onDrawRoute, onSafetyWarnings, transportMode]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setSuggestions([]);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const geocodeSearch = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 3) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=3`);
        setSuggestions(await res.json());
      } catch { setSuggestions([]); }
    }, 500);
  }, []);

  const handleFromChange = (v: string) => { setFromText(v); setFromCoords(null); setActiveField('from'); geocodeSearch(v); };
  const handleToChange = (v: string) => { setToText(v); setToCoords(null); setActiveField('to'); geocodeSearch(v); };

  const selectSuggestion = (s: Suggestion) => {
    const coords = { lat: parseFloat(s.lat), lng: parseFloat(s.lon) };
    const shortName = s.display_name.split(',').slice(0, 2).join(',');
    if (activeField === 'from') { setFromText(shortName); setFromCoords(coords); }
    else { setToText(shortName); setToCoords(coords); }
    setSuggestions([]);
  };

  const resolveCoords = async () => {
    let start = fromCoords;
    if (!start && (fromText === 'My Location' || !fromText.trim())) {
      try {
        const coords = await new Promise<{ lat: number; lng: number }>((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error("Geolocation not supported"));
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => reject(err),
            { enableHighAccuracy: true, timeout: 5000 }
          );
        });
        start = coords;
        setFromCoords(coords);
        setFromText('My Location');
      } catch {
        toast.error('Could not get current location. Please enter starting point.');
        return null;
      }
    }
    if (!start) {
      toast.error('Select a valid start location');
      return null;
    }
    if (!toCoords) {
      toast.error('Select a valid destination');
      return null;
    }
    return { origin: start, destination: toCoords };
  };

  const handleGetDirections = async () => {
    const resolved = await resolveCoords();
    if (!resolved) return;
    setLoading(true); setWarnings(null); setRouteInfo(null); setRouteCoords(null);
    try {
      const { origin, destination } = resolved;
      const modeConfig = TRANSPORT_MODES.find(m => m.id === transportMode)!;
      const url = `http://router.project-osrm.org/route/v1/${modeConfig.osrm}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const routeResponse = await res.json();
      console.log("routeResponse", routeResponse);

      if (routeResponse.code !== 'Ok' || !routeResponse.routes?.length) { 
        toast.error('Could not find a route'); 
        return; 
      }
      const route = routeResponse.routes[0];
      const coords: [number, number][] = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]);
      setRouteCoords(coords); 
      onDrawRoute(coords); 

      // Concurrently query safety warnings along the route
      const safetyResult = await checkRouteSafety(origin, destination);
      setWarnings(safetyResult.warnings);
      setWarningCount(safetyResult.total);
      onSafetyWarnings(safetyResult.warnings);

      const distKm = (route.distance / 1000).toFixed(1);
      const durMin = Math.round(route.duration / 60);
      setRouteInfo({ distance: `${distKm} km`, duration: `${durMin} min` });
    } catch (err) { 
      toast.error('Directions or Route Safety check failed'); 
      console.error(err);
    } finally { 
      setLoading(false); 
    }
  };

  const handleCheckSafety = async () => {
    await handleGetDirections();
  };

  const handleStartNavigation = async () => {
    if (!routeCoords) return;
    setNavigating(true);
    const resolved = await resolveCoords();
    let navWarnings: RouteWarning[] = [];
    if (resolved) {
      try { const r = await checkRouteSafety(resolved.origin, resolved.destination); navWarnings = r.warnings; } catch {}
    }
    onStartNavigation?.(routeCoords, navWarnings);
  };

  const handleStopNavigation = () => { setNavigating(false); onStopNavigation?.(); };

  const handleCollapse = () => {
    updateExpanded(false); updateActiveField(null); setSuggestions([]); setRouteInfo(null);
    setWarnings(null); setRouteCoords(null); setNavigating(false);
    onDrawRoute(null); onSafetyWarnings(null); onStopNavigation?.();
  };

  return (
    <div ref={panelRef} className="fixed top-3 left-1/2 -translate-x-1/2 z-[1000] w-[440px] max-w-[90vw]">
      <div className="bg-slate-800/95 backdrop-blur-md rounded-xl shadow-2xl shadow-black/40 border border-slate-700/50 overflow-hidden">
        {!expanded ? (
          <div className="flex items-center gap-3 px-4 py-3 cursor-text" onClick={() => updateExpanded(true)}>
            <Search size={16} className="text-slate-400 flex-shrink-0" />
            <span className="text-sm text-slate-400">Enter destination...</span>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            <div className="relative">
              <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-green-400" />
              <input value={fromText} onChange={(e) => handleFromChange(e.target.value)} onFocus={() => updateActiveField('from')}
                placeholder="Starting point"
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-slate-700/60 border border-slate-600/50 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500/60 transition-all" />
            </div>
            <div className="relative">
              <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-red-400" />
              <input value={toText} onChange={(e) => handleToChange(e.target.value)} onFocus={() => updateActiveField('to')}
                placeholder="Destination" autoFocus
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-slate-700/60 border border-slate-600/50 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500/60 transition-all" />
            </div>
            <div className="flex gap-1.5 pt-0.5">
              {TRANSPORT_MODES.map((mode) => (
                <button key={mode.id} type="button" onClick={() => setTransportMode(mode.id)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${transportMode === mode.id ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'bg-slate-700/60 text-slate-400 hover:bg-slate-600/60 hover:text-slate-200'}`}>
                  {mode.label}
                </button>
              ))}
            </div>
            {suggestions.length > 0 && (
              <div className="rounded-lg bg-slate-700 border border-slate-600/50 overflow-hidden">
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => selectSuggestion(s)}
                    className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-600/50 transition-colors truncate border-b border-slate-600/30 last:border-0">
                    <MapPin size={10} className="inline mr-1.5 text-slate-500" />{s.display_name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={handleGetDirections} disabled={loading}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium disabled:opacity-50 transition-all">
                {loading ? <Loader2 size={13} className="animate-spin" /> : <Navigation size={13} />} Directions
              </button>
              <button onClick={handleCheckSafety} disabled={loading}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium disabled:opacity-50 transition-all">
                {loading ? <Loader2 size={13} className="animate-spin" /> : <AlertTriangle size={13} />} Route Safety
              </button>
              <button onClick={handleCollapse}
                className="p-2 rounded-lg bg-slate-700/60 hover:bg-slate-600 text-slate-400 hover:text-white transition-colors">
                <X size={14} />
              </button>
            </div>
            {routeCoords && !navigating && (
              <button onClick={handleStartNavigation}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-semibold transition-all shadow-md shadow-green-600/30">
                <Navigation size={13} /> Start Navigation
              </button>
            )}
            {navigating && (
              <button onClick={handleStopNavigation}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-all">
                <X size={13} /> Stop Navigation
              </button>
            )}
          </div>
        )}
      </div>
      {routeInfo && (
        <div className="mt-2 bg-slate-800/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-700/50 p-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/15"><ArrowRight size={16} className="text-blue-400" /></div>
          <div>
            <p className="text-sm font-medium text-white">{routeInfo.distance}</p>
            <p className="text-xs text-slate-400 flex items-center gap-1"><Clock size={10} /> {routeInfo.duration}</p>
          </div>
          <div className="ml-auto text-xs text-slate-500 capitalize">{transportMode}</div>
        </div>
      )}
      {warnings !== null && (
        <div className="mt-2 bg-slate-800/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-700/50 max-h-60 overflow-y-auto">
          {warnings.length === 0 ? (
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl p-3">
              <span className="text-xl">✅</span>
              <div>
                <p className="text-sm font-medium text-green-400">Route is clear!</p>
                <p className="text-xs text-slate-400">No reported issues along this route</p>
              </div>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider px-2 py-1">{warningCount} issue{warningCount !== 1 ? 's' : ''} near route</p>
              {warnings.map((w, i) => {
                const sColor = SEVERITY_COLORS[w.severity] || '#94a3b8';
                const emoji = SEVERITY_EMOJI[w.severity] || 'x';
                return (
                  <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-700/40">
                    <span className="text-sm flex-shrink-0">{emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-200">{w.warning_message}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{w.distance_meters}m away</p>
                    </div>
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium flex-shrink-0"
                      style={{ background: `${sColor}20`, color: sColor }}>{w.severity}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
