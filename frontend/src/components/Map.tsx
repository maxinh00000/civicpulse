import React, { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Circle,
  useMapEvents,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import type { Issue, RouteWarning } from '../types';
import { Eye, ThumbsUp, Compass, X, Navigation } from 'lucide-react';
import { reverseGeocode } from '../api';

/* ── Fix Leaflet default icon paths ─── */
// @ts-expect-error - fixing leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

/* ── Emoji + color + opacity markers ─── */
const categoryEmoji: Record<string, string> = {
  pothole: '🕳️',
  water_leakage: '💧',
  garbage: '🗑️',
  streetlight: '💡',
  other: '⚠️',
};

const categoryColor: Record<string, string> = {
  pothole: '#ef4444',
  water_leakage: '#3b82f6',
  garbage: '#22c55e',
  streetlight: '#eab308',
  other: '#9ca3af',
};

const severityOpacity: Record<string, number> = {
  critical: 1.0,
  high: 0.85,
  medium: 0.65,
  low: 0.45,
};

const severitySize: Record<string, number> = {
  critical: 36,
  high: 30,
  medium: 24,
  low: 18,
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

function createIssueMarker(issue: Issue) {
  const emoji = categoryEmoji[issue.category] || '⚠️';
  const opacity = severityOpacity[issue.severity] || 0.7;
  const size = severitySize[issue.severity] || 24;
  const color = categoryColor[issue.category] || '#9ca3af';

  return L.divIcon({
    className: '',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        opacity: ${opacity};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 2px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        cursor: pointer;
      ">
        <span style="transform: rotate(45deg); font-size: ${size * 0.5}px; line-height: 1;">
          ${emoji}
        </span>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

const userLocationIcon = L.divIcon({
  className: '',
  html: `
    <div style="position: relative; width: 22px; height: 22px;">
      <div style="
        position: absolute;
        inset: -6px;
        border-radius: 50%;
        background: rgba(66, 133, 244, 0.2);
        animation: userPulse 2s ease-out infinite;
      "></div>
      <div style="
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.35);
      "></div>
      <div style="
        position: absolute;
        inset: 3px;
        border-radius: 50%;
        background: #4285F4;
      "></div>
    </div>
  `,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -14],
});

const clickPinIcon = L.divIcon({
  className: '',
  html: `
    <div style="
      width: 28px;
      height: 28px;
      background: #ef4444;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 2.5px solid white;
      box-shadow: 0 3px 10px rgba(239,68,68,0.55);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        width: 8px;
        height: 8px;
        background: white;
        border-radius: 50%;
        transform: rotate(45deg);
      "></div>
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -30],
});

const pulsingHazardIcon = L.divIcon({
  className: '',
  html: `
    <div style="position: relative; width: 30px; height: 30px;">
      <div style="
        position: absolute;
        inset: -10px;
        border-radius: 50%;
        border: 2px solid #ef4444;
        background: rgba(239, 68, 68, 0.15);
        animation: hazardPulse 1.2s infinite ease-out;
      "></div>
      <div style="
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: #ef4444;
        border: 2px solid white;
        box-shadow: 0 0 10px rgba(239,68,68,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
      ">⚠️</div>
    </div>
  `,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -15],
});

function UserLocationMarker() {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [accuracy, setAccuracy] = useState<number>(0);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition([pos.coords.latitude, pos.coords.longitude]);
        setAccuracy(pos.coords.accuracy);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  if (!position) return null;

  return (
    <React.Fragment>
      <Circle
        center={position}
        radius={accuracy}
        pathOptions={{
          color: '#4285F4',
          fillColor: '#4285F4',
          fillOpacity: 0.08,
          weight: 1,
          opacity: 0.4,
        }}
      />
      <Marker position={position} icon={userLocationIcon} zIndexOffset={1000}>
        <Popup>
          <div className="bg-slate-800 text-white p-2 rounded-lg text-xs min-w-[120px]">
            <p className="font-semibold text-blue-400 mb-1">📍 Your Location</p>
            <p className="text-slate-400">Accuracy: ~{Math.round(accuracy)}m</p>
          </div>
        </Popup>
      </Marker>
    </React.Fragment>
  );
}

function NavigationFollow({
  isNavigating,
  userCoords,
}: {
  isNavigating: boolean;
  userCoords: [number, number] | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (isNavigating && userCoords) {
      map.setView(userCoords, 17, { animate: true, duration: 0.5 });
    }
  }, [isNavigating, userCoords, map]);
  return null;
}

function ClickHandler({
  onClick,
}: {
  onClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FlyTo({ issue }: { issue: Issue | null }) {
  const map = useMap();
  useEffect(() => {
    if (issue) {
      map.flyTo([issue.latitude, issue.longitude], 17, { duration: 0.8 });
    }
  }, [issue, map]);
  return null;
}

interface MapProps {
  issues: Issue[];
  onMapClick: (lat: number, lng: number) => void;
  selectedIssue: Issue | null;
  onMarkerClick: (issue: Issue) => void;
  routePolyline?: [number, number][] | null;
  routeWarnings?: RouteWarning[] | null;
  onVote: (id: string) => void;
  onViewDetails: (issue: Issue) => void;
  formActive?: boolean;
  isNavigating?: boolean;
  userCoords?: [number, number] | null;
  navWarnings?: RouteWarning[];
  onStopNavigation?: () => void;
  onSelectDirections?: (lat: number, lng: number, label: string) => void;
  onSelectStartNavigation?: (lat: number, lng: number, label: string) => void;
}

export default function Map({
  issues,
  onMapClick,
  selectedIssue,
  onMarkerClick,
  routePolyline,
  routeWarnings,
  onVote,
  onViewDetails,
  formActive,
  isNavigating = false,
  userCoords = null,
  navWarnings = [],
  onStopNavigation,
  onSelectDirections,
  onSelectStartNavigation,
}: MapProps) {
  const [clickedPin, setClickedPin] = useState<[number, number] | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);

  useEffect(() => {
    if (!formActive) {
      setClickedPin(null);
      setAddress(null);
    }
  }, [formActive]);

  useEffect(() => {
    if (selectedIssue) {
      setClickedPin(null);
      setAddress(null);
    }
  }, [selectedIssue]);

  const activeHazards = navWarnings
    ? [...navWarnings]
        .filter((w) => !w.passed)
        .sort((a, b) => a.distance_meters - b.distance_meters)
    : [];

  const activeWarning = activeHazards[0] || null;

  let bannerColor = 'dark';
  let bannerText = 'Ready for navigation';
  let bannerEmoji = '🧭';

  if (isNavigating) {
    if (!activeWarning) {
      bannerColor = 'green';
      bannerText = 'No more hazards on your route';
      bannerEmoji = '✅';
    } else {
      const dist = activeWarning.distance_meters;
      const cat = activeWarning.category.replace(/_/g, ' ');
      if (dist < 100) {
        bannerColor = 'red';
        bannerText = `CAUTION: ${cat.toUpperCase()} immediately ahead!`;
        bannerEmoji = '🔴';
      } else if (dist < 400) {
        bannerColor = 'orange';
        bannerText = `WARNING: ${cat} in ${dist}m`;
        bannerEmoji = '🟠';
      } else if (dist < 800) {
        bannerColor = 'yellow';
        bannerText = `Issue ahead in ${dist}m`;
        bannerEmoji = '🟡';
      } else {
        bannerColor = 'dark';
        bannerText = `Next hazard: ${cat} in ${dist}m — ${activeWarning.severity} severity`;
        bannerEmoji = '⚠️';
      }
    }
  }

  return (
    <div className="w-full h-full relative">
      <style>{`
        @keyframes hazardPulse {
          0% { transform: scale(0.6); opacity: 1; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .pulsing-hazard-marker {
          animation: hazardPulse 1.2s infinite ease-out;
        }
      `}</style>

      {/* Navigation Mode Banner */}
      {isNavigating && (
        <div className={`absolute top-0 left-0 right-0 z-[1000] px-6 py-4 flex items-center justify-between text-white font-semibold transition-all duration-300 ${
          bannerColor === 'red' ? 'bg-red-600 animate-pulse' :
          bannerColor === 'orange' ? 'bg-orange-600' :
          bannerColor === 'yellow' ? 'bg-yellow-500 text-slate-900' :
          bannerColor === 'green' ? 'bg-green-600' :
          'bg-slate-900/95 border-b border-slate-700'
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-xl">{bannerEmoji}</span>
            <span className="text-sm md:text-base">{bannerText}</span>
          </div>
          <button
            onClick={onStopNavigation}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all shadow-md"
          >
            Stop Navigation
          </button>
        </div>
      )}

      {/* Floating Hazards Panel (Left side) */}
      {isNavigating && (
        <div className="absolute top-20 left-4 bottom-4 w-80 z-[1000] bg-slate-900/90 backdrop-blur border border-slate-700 rounded-xl shadow-2xl p-4 flex flex-col gap-3 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Hazards on Route</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold">
              {activeHazards.length} remaining
            </span>
          </div>
          <div className="flex-1 overflow-y-auto pr-1 space-y-2">
            {activeHazards.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">No hazards ahead</p>
            ) : (
              activeHazards.map((w) => {
                const isClosest = activeWarning?.issue_id === w.issue_id;
                const emoji = categoryEmoji[w.category] || '⚠️';
                return (
                  <div
                    key={w.issue_id}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-all ${
                      isClosest
                        ? 'bg-blue-600/10 border-blue-500/50 shadow-md shadow-blue-500/5'
                        : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="text-base mt-0.5">{emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-200 truncate">{w.title}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[9px] font-bold px-1 py-0.2 rounded uppercase ${
                          w.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                          w.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                          w.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-green-500/20 text-green-400'
                        }`}>
                          {w.severity}
                        </span>
                        {w.bearing && (
                          <span className="text-[9px] text-slate-400 capitalize">
                            🧭 {w.bearing}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-xs font-bold text-white">{w.distance_meters}m</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Selected Location Details Card (Google Maps style) */}
      {clickedPin && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-[420px] max-w-[92vw] bg-slate-900/95 backdrop-blur-md border border-slate-700/60 rounded-2xl shadow-2xl p-4 flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">📍 Selected Location</h4>
              <p className="text-sm font-semibold text-white leading-snug">
                {addressLoading ? (
                  <span className="text-slate-500 animate-pulse">Fetching address...</span>
                ) : (
                  address || 'Unnamed location'
                )}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {clickedPin[0].toFixed(5)}, {clickedPin[1].toFixed(5)}
              </p>
            </div>
            <button
              onClick={() => setClickedPin(null)}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => {
                const label = address || `${clickedPin[0].toFixed(4)}, ${clickedPin[1].toFixed(4)}`;
                onSelectDirections?.(clickedPin[0], clickedPin[1], label);
                setClickedPin(null);
              }}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/25"
            >
              <Navigation size={13} />
              Directions
            </button>
            <button
              onClick={() => {
                const label = address || `${clickedPin[0].toFixed(4)}, ${clickedPin[1].toFixed(4)}`;
                onSelectStartNavigation?.(clickedPin[0], clickedPin[1], label);
                setClickedPin(null);
              }}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-all shadow-md shadow-green-600/25"
            >
              🚀 Start
            </button>
            <button
              onClick={() => {
                onMapClick(clickedPin[0], clickedPin[1]);
                setClickedPin(null);
              }}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-white text-xs font-bold border border-slate-700 transition-all"
            >
              ⚠️ Report
            </button>
          </div>
        </div>
      )}

      <MapContainer
        center={[12.9716, 77.5946]}
        zoom={13}
        className="w-full h-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler
          onClick={(lat, lng) => {
            setClickedPin([lat, lng]);
            setAddress(null);
            setAddressLoading(true);
            reverseGeocode(lat, lng)
              .then((res) => {
                if (res.success && res.address) {
                  const short = res.address.split(',').slice(0, 3).join(',');
                  setAddress(short);
                } else {
                  setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
                }
              })
              .catch(() => {
                setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
              })
              .finally(() => {
                setAddressLoading(false);
              });
          }}
        />
        <FlyTo issue={selectedIssue} />
        <UserLocationMarker />
        <NavigationFollow isNavigating={isNavigating} userCoords={userCoords} />

        {/* Route polyline */}
        {routePolyline && routePolyline.length > 0 && (
          <Polyline
            positions={routePolyline}
            pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.8 }}
          />
        )}

        {/* Route warnings circles & markers */}
        {routeWarnings?.map((warning, i) => {
          const isPassed = activeHazards.findIndex((h) => h.issue_id === warning.issue_id) === -1;
          if (isNavigating && isPassed) return null;

          return (
            <React.Fragment key={warning.issue_id || i}>
              <Circle
                center={[warning.latitude, warning.longitude]}
                radius={80}
                pathOptions={{
                  color: '#ef4444',
                  fillColor: '#ef4444',
                  fillOpacity: 0.2,
                  weight: 2,
                  dashArray: '6 4'
                }}
              />
              <Marker
                position={[warning.latitude, warning.longitude]}
                icon={isNavigating ? pulsingHazardIcon : L.divIcon({
                  className: '',
                  html: `<div style="
                    background: #ef4444;
                    color: white;
                    border-radius: 50%;
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                    border: 2px solid white;
                    box-shadow: 0 2px 8px rgba(239,68,68,0.6);
                  ">⚠️</div>`,
                  iconSize: [28, 28],
                  iconAnchor: [14, 14],
                })}
              >
                <Popup>
                  <div className="bg-slate-800 text-white p-2 rounded-lg text-xs min-w-[160px]">
                    <p className="font-bold text-red-400 mb-1">⚠️ Hazard on Route</p>
                    <p className="text-white mb-1">{warning.title}</p>
                    <p className="text-slate-400">{warning.warning_message}</p>
                    <p className="text-slate-400 mt-1">📏 {warning.distance_meters}m from route</p>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}

        {issues.map((issue) => (
          <Marker
            key={issue.id}
            position={[issue.latitude, issue.longitude]}
            icon={createIssueMarker(issue)}
            eventHandlers={{ click: () => onMarkerClick(issue) }}
          >
            <Popup maxWidth={280} className="civic-popup">
              <div className="bg-slate-800 text-white rounded-xl p-0 overflow-hidden min-w-[240px]">
                {issue.image_url && (
                  <img
                    src={issue.image_url}
                    alt={issue.title}
                    className="w-full h-32 object-cover"
                  />
                )}

                <div className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xl flex-shrink-0">{categoryEmoji[issue.category] || '⚠️'}</span>
                      <span className="font-semibold text-sm text-white leading-tight truncate">{issue.title}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${severityColor[issue.severity]}`}>
                      {issue.severity?.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400 mb-2">
                    <span>🕐 {timeAgo(issue.created_at)}</span>
                    <span>👍 {issue.votes ?? 0} confirmations</span>
                  </div>

                  {issue.address && (
                    <p className="text-[11px] text-slate-400 mb-2 flex items-center gap-1">
                      <span>📍</span> {issue.address}
                    </p>
                  )}

                  {issue.confidence && (
                    <p className="text-[11px] text-blue-400 mb-2">
                      🤖 AI confidence: {Math.round(issue.confidence * 100)}%
                    </p>
                  )}

                  <div className="flex items-center gap-1 mb-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      issue.status === 'resolved'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {issue.status === 'resolved' ? '✅ Resolved' : '🔴 Open'}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => onVote(issue.id)}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs py-1.5 rounded-lg transition-colors"
                    >
                      👍 Confirm
                    </button>
                    <button
                      onClick={() => onViewDetails(issue)}
                      className="flex-1 bg-slate-600 hover:bg-slate-500 text-white text-xs py-1.5 rounded-lg transition-colors"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Clicked location pin */}
        {clickedPin && (
          <Marker position={clickedPin} icon={clickPinIcon} zIndexOffset={900}>
            <Popup>
              <div className="bg-slate-800 text-white p-2 rounded-lg text-xs min-w-[140px]">
                <p className="font-semibold text-red-400 mb-1">📌 Selected Location</p>
                <p className="text-slate-400">{clickedPin[0].toFixed(5)}, {clickedPin[1].toFixed(5)}</p>
                <p className="text-slate-500 mt-1 text-[10px]">Options below...</p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
