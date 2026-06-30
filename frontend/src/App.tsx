import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Navigation, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Map from './components/Map';
import Sidebar from './components/Sidebar';
import IssueForm from './components/IssueForm';
import IssueDetail from './components/IssueDetail';
import SearchBar from './components/SearchBar';
import LegendPanel from './components/LegendPanel';
import NearbyPanel from './components/NearbyPanel';
import CivicHealthWidget from './components/CivicHealthWidget';
import { getIssues, getNearbyIssues, voteIssue, resolveIssue, getSummary, getAgentHealth, checkRouteSafety } from './api';
import { getUserId } from './utils/userId';
import type { Issue, RouteWarning, AgentHealth } from './types';

interface NearbyIssue extends Issue {
  distance_meters: number;
}

export default function App() {
  /* ── Core state ─── */
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [formCoords, setFormCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [agentAlive, setAgentAlive] = useState(true);
  const [agentHealth, setAgentHealth] = useState<AgentHealth | null>(null);
  const [showHealthTooltip, setShowHealthTooltip] = useState(false);

  // Directions Mode lifted states
  const [directionsMode, setDirectionsMode] = useState(false);
  const [activeRouteField, setActiveRouteField] = useState<'from' | 'to' | null>(null);
  const [mapClickCoords, setMapClickCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Navigation mode
  const [isNavigating, setIsNavigating] = useState(false);
  const [navWarnings, setNavWarnings] = useState<RouteWarning[]>([]);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const distanceHistoryRef = useRef<Record<string, { lastDistances: number[]; passed: boolean }>>({});

  // Distance helper function
  const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const dphi = ((lat2 - lat1) * Math.PI) / 180;
    const dlambda = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dphi / 2) * Math.sin(dphi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2) * Math.sin(dlambda / 2);
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const [externalDestination, setExternalDestination] = useState<{ lat: number; lng: number; label: string } | null>(null);

  const handleStopNavigation = useCallback(() => {
    setIsNavigating(false);
    setNavWarnings([]);
    setRouteCoords(null);
    setRouteWarnings(null);
    setUserCoords(null);
    setExternalDestination(null);
    distanceHistoryRef.current = {};
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const startDirectNavigation = useCallback(async (destLat: number, destLng: number, destLabel: string) => {
    setLoading(true);
    try {
      const gps = await new Promise<{ lat: number; lng: number }>((resolve, reject) => {
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

      const routeUrl = `http://router.project-osrm.org/route/v1/driving/${gps.lng},${gps.lat};${destLng},${destLat}?overview=full&geometries=geojson`;
      const routeRes = await fetch(routeUrl);
      const routeData = await routeRes.json();
      if (routeData.code !== 'Ok' || !routeData.routes?.length) {
        toast.error('Could not find a route to selected location');
        return;
      }
      const route = routeData.routes[0];
      const coords: [number, number][] = route.geometry.coordinates.map(
        (c: [number, number]) => [c[1], c[0]] as [number, number]
      );

      const safety = await checkRouteSafety(gps, { lat: destLat, lng: destLng });

      setRouteCoords(coords);
      setRouteWarnings(safety.warnings);
      setNavWarnings(safety.warnings);
      setUserCoords([gps.lat, gps.lng]); // Seed initial position immediately to avoid delays
      setIsNavigating(true);

      if (navigator.geolocation) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            setUserCoords([lat, lng]);

            setNavWarnings((prevWarnings) => {
              return prevWarnings.map((w) => {
                const dist = haversine(lat, lng, w.latitude, w.longitude);
                const hist = distanceHistoryRef.current[w.issue_id] || { lastDistances: [], passed: false };
                let passed = hist.passed;

                if (!passed) {
                  const newHistory = [...hist.lastDistances, dist].slice(-4);
                  if (newHistory.length >= 4) {
                    const isIncreasing =
                      newHistory[1] > newHistory[0] &&
                      newHistory[2] > newHistory[1] &&
                      newHistory[3] > newHistory[2];
                    if (isIncreasing) {
                      passed = true;
                    }
                  }
                  distanceHistoryRef.current[w.issue_id] = { lastDistances: newHistory, passed };
                }

                return {
                  ...w,
                  distance_meters: Math.round(dist),
                  passed,
                };
              });
            });
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );
      }
      toast.success(`Navigation started to ${destLabel}`);
    } catch {
      toast.error('Could not start navigation');
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── Sidebar state ─── */
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(240);

  /* ── Legend state ─── */
  const [showLegend, setShowLegend] = useState(false);

  /* ── Nearby state ─── */
  const [showNearbyPanel, setShowNearbyPanel] = useState(false);
  const [nearbyIssues, setNearbyIssues] = useState<NearbyIssue[]>([]);

  /* ── Route polyline state ─── */
  const [routeCoords, setRouteCoords] = useState<[number, number][] | null>(null);
  const [routeWarnings, setRouteWarnings] = useState<RouteWarning[] | null>(null);

  /* ── Summary statistics state ─── */
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    getSummary().then(setSummary).catch(() => {});
  }, [issues]);

  /* ── Fetch issues ─── */
  const fetchIssues = useCallback(async () => {
    try {
      const data = await getIssues();
      setIssues(data);
      // Check agent health
      try {
        const health = await getAgentHealth();
        setAgentHealth(health);
        setAgentAlive(health.overall !== 'degraded');
      } catch {
        setAgentAlive(false);
      }
    } catch {
      setAgentAlive(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIssues();
    const interval = setInterval(fetchIssues, 30_000);
    return () => clearInterval(interval);
  }, [fetchIssues]);

  /* ── Fetch nearby issues on mount ─── */
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const result = await getNearbyIssues(pos.coords.latitude, pos.coords.longitude, 1);
          setNearbyIssues(result.issues as NearbyIssue[]);
        } catch {
          // Silently fail
        }
      },
      () => {},
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }, []);

  /* ── Sidebar drag resize ─── */
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMouseMove = (ev: MouseEvent) => {
      const newWidth = Math.max(180, Math.min(480, startWidth + ev.clientX - startX));
      setSidebarWidth(newWidth);
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  /* ── Nearby Button drag to move logic ─── */
  const [nearbyBtnPos, setNearbyBtnPos] = useState({ x: 16, y: window.innerHeight - 150 });
  const nearbyDragging = useRef(false);
  const nearbyDragOffset = useRef({ x: 0, y: 0 });
  const dragStartPos = useRef({ x: 0, y: 0 });

  const handleNearbyMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only drag on left click
    nearbyDragging.current = true;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    nearbyDragOffset.current = { x: e.clientX - nearbyBtnPos.x, y: e.clientY - nearbyBtnPos.y };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!nearbyDragging.current) return;
      setNearbyBtnPos({
        x: e.clientX - nearbyDragOffset.current.x,
        y: e.clientY - nearbyDragOffset.current.y,
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!nearbyDragging.current) return;
      nearbyDragging.current = false;
      
      const moveDistance = Math.hypot(e.clientX - dragStartPos.current.x, e.clientY - dragStartPos.current.y);
      if (moveDistance < 5) {
        setShowNearbyPanel((prev) => !prev);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [nearbyBtnPos]);

  /* ── Handlers ─── */
  const handleMapClick = (lat: number, lng: number) => {
    console.log("Current mode", directionsMode ? "directions" : "report");
    console.log("Clicked Lat/Lng on Map:", lat, lng);
    if (!selectedIssue) {
      setFormCoords({ lat, lng });
    }
  };

  const handleMarkerClick = (issue: Issue) => {
    setSelectedIssue(issue);
    setFormCoords(null);
  };

  const handleVote = async (id: string) => {
    try {
      const updated = await voteIssue(id, getUserId());
      setIssues((prev) => prev.map((i) => (i.id === id ? updated : i)));
      setSelectedIssue((prev) => (prev?.id === id ? updated : prev));
      toast.success('Vote recorded!');
    } catch {
      toast.error('Already voted or vote failed');
    }
  };

  const handleResolve = async (id: string) => {
    try {
      const updated = await resolveIssue(id);
      setIssues((prev) => prev.map((i) => (i.id === id ? updated : i)));
      setSelectedIssue((prev) => (prev?.id === id ? updated : prev));
      toast.success('Issue marked as resolved!');
    } catch {
      toast.error('Failed to resolve issue');
    }
  };

  const handleFormSubmit = () => {
    fetchIssues();
  };

  const openFormAtDefault = () => {
    setFormCoords({ lat: 12.9716, lng: 77.5946 });
    setSelectedIssue(null);
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-civic-bg flex">
      {/* ══════════ Burger button ══════════ */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-3 left-3 z-[2000] bg-slate-700/90 hover:bg-slate-600 text-white
                   p-2 rounded-md shadow-md backdrop-blur-sm border border-slate-600/40
                   transition-all text-sm"
        title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        ☰
      </button>

      {/* ══════════ Sidebar ══════════ */}
      <div
        style={{
          width: sidebarOpen ? sidebarWidth : 0,
          minWidth: sidebarOpen ? 180 : 0,
        }}
        className="h-full overflow-hidden transition-all duration-300 relative flex-shrink-0"
      >
        {sidebarOpen && (
          <>
            <Sidebar
              issues={issues}
              onSelectIssue={handleMarkerClick}
              selectedIssueId={selectedIssue?.id ?? null}
              agentAlive={agentAlive}
              agentHealth={agentHealth}
              onToggleLegend={() => setShowLegend(!showLegend)}
            />
            {/* Drag handle */}
            <div
              className="absolute right-0 top-0 h-full w-1 cursor-col-resize
                         bg-slate-600/50 hover:bg-blue-500 transition-colors z-10"
              onMouseDown={handleDragStart}
            />
          </>
        )}
      </div>

      {/* ══════════ Map area ══════════ */}
      <div className="flex-1 relative">
        {/* Search bar */}
        {!isNavigating && (
          <SearchBar
            onDrawRoute={setRouteCoords}
            onSafetyWarnings={setRouteWarnings}
            onStartNavigation={(coords, warnings) => {
              setIsNavigating(true);
              setNavWarnings(warnings);
              setRouteCoords(coords);
              // Start watching user position
              if (navigator.geolocation) {
                // Get current position immediately to set starting userCoords
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    setUserCoords([pos.coords.latitude, pos.coords.longitude]);
                  },
                  () => {},
                  { enableHighAccuracy: true }
                );
                
                watchIdRef.current = navigator.geolocation.watchPosition(
                  (pos) => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    setUserCoords([lat, lng]);

                    // Recalculate distances to route safety hazards
                    setNavWarnings((prevWarnings) => {
                      return prevWarnings.map((w) => {
                        const dist = haversine(lat, lng, w.latitude, w.longitude);
                        const hist = distanceHistoryRef.current[w.issue_id] || { lastDistances: [], passed: false };
                        let passed = hist.passed;

                        if (!passed) {
                          const newHistory = [...hist.lastDistances, dist].slice(-4);
                          if (newHistory.length >= 4) {
                            const isIncreasing =
                              newHistory[1] > newHistory[0] &&
                              newHistory[2] > newHistory[1] &&
                              newHistory[3] > newHistory[2];
                            if (isIncreasing) {
                              passed = true;
                            }
                          }
                          distanceHistoryRef.current[w.issue_id] = { lastDistances: newHistory, passed };
                        }

                        return {
                          ...w,
                          distance_meters: Math.round(dist),
                          passed,
                        };
                      });
                    });
                  },
                  (err) => {
                    console.error("GPS watchPosition error: ", err);
                  },
                  { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
                );
              }
            }}
            onStopNavigation={handleStopNavigation}
            externalDestination={externalDestination}
            onClearExternalDestination={() => setExternalDestination(null)}
            directionsMode={directionsMode}
            onDirectionsModeChange={setDirectionsMode}
            activeRouteField={activeRouteField}
            onActiveFieldChange={setActiveRouteField}
            mapClickCoords={mapClickCoords}
            onClearMapClick={() => setMapClickCoords(null)}
          />
        )}

        {loading ? (
          <div className="w-full h-full flex items-center justify-center bg-civic-bg">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin" />
              <p className="text-sm text-slate-500">Loading CivicPulse…</p>
            </div>
          </div>
        ) : (
          <Map
            issues={issues}
            onMapClick={handleMapClick}
            selectedIssue={selectedIssue}
            onMarkerClick={handleMarkerClick}
            routePolyline={routeCoords}
            routeWarnings={routeWarnings}
            onVote={handleVote}
            onViewDetails={handleMarkerClick}
            formActive={!!formCoords}
            isNavigating={isNavigating}
            userCoords={userCoords}
            navWarnings={navWarnings}
            onStopNavigation={handleStopNavigation}
            onSelectDirections={(lat, lng, label) => {
              setSelectedIssue(null);
              setExternalDestination({ lat, lng, label });
              setDirectionsMode(true);
            }}
            onSelectStartNavigation={(lat, lng, label) => {
              setSelectedIssue(null);
              startDirectNavigation(lat, lng, label);
            }}
            directionsMode={directionsMode}
            onMapClickForDirections={(lat, lng) => {
              setMapClickCoords({ lat, lng });
            }}
          />
        )}


        {/* FAB — Report Issue */}
        <button
          onClick={openFormAtDefault}
          className="fixed bottom-6 right-6 z-[1000] bg-blue-600 hover:bg-blue-500 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:shadow-blue-500/30 hover:shadow-xl transition-all duration-200 text-2xl"
          title="Report Issue"
        >
          +
        </button>




        {/* Civic Health Widget */}
        <CivicHealthWidget
          summary={summary}
          nearbyCount={nearbyIssues.length}
        />
      </div>

      {/* ══════════ Floating overlays ══════════ */}

      {/* Nearby issues button — always visible and draggable */}
      <button
        onMouseDown={handleNearbyMouseDown}
        style={{
          left: nearbyBtnPos.x,
          top: nearbyBtnPos.y,
          backgroundColor: '#450A0A',
          borderColor: '#991B1B',
          borderWidth: '2px',
          borderStyle: 'solid',
        }}
        className="fixed z-[1000] text-white rounded-full px-3.5 py-2.5 flex items-center gap-2 shadow-lg text-sm font-medium select-none hover:brightness-110 cursor-move"
        title="Drag to move, click to view nearby issues"
      >
        <span className="text-lg">🚨</span>
        <span className="text-xs font-bold">{nearbyIssues.length}</span>
      </button>

      {/* Nearby panel */}
      {showNearbyPanel && (
        <NearbyPanel
          issues={nearbyIssues}
          buttonPosition={nearbyBtnPos}
          onClose={() => setShowNearbyPanel(false)}
          onIssueClick={(issue) => {
            handleMarkerClick(issue);
            setShowNearbyPanel(false);
          }}
        />
      )}

      {/* Legend panel */}
      {showLegend && <LegendPanel onClose={() => setShowLegend(false)} />}

      {/* ══════════ Panels ══════════ */}
      {formCoords && (
        <IssueForm
          lat={formCoords.lat}
          lng={formCoords.lng}
          onClose={() => setFormCoords(null)}
          onSubmit={handleFormSubmit}
          onViewIssue={(id) => {
            setFormCoords(null);
            const issue = issues.find((i) => i.id === id);
            if (issue) setSelectedIssue(issue);
          }}
        />
      )}

      {selectedIssue && (
        <IssueDetail
          issue={selectedIssue}
          onClose={() => setSelectedIssue(null)}
          onVote={handleVote}
          onResolve={handleResolve}
          onSelectDirections={(lat, lng, label) => {
            setSelectedIssue(null);
            setExternalDestination({ lat, lng, label });
            setDirectionsMode(true);
          }}
          onSelectStartNavigation={(lat, lng, label) => {
            setSelectedIssue(null);
            startDirectNavigation(lat, lng, label);
          }}
        />
      )}
    </div>
  );
}
