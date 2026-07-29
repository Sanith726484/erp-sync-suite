import React, { useState, useEffect, useRef } from 'react';
import { ErpClientManager, GpsLog, Visit } from 'api';
import { MapPin, Calendar, User, Navigation, RefreshCw, AlertCircle, Award } from 'lucide-react';

export const RouteHistoryMap: React.FC = () => {
  const [username, setUsername] = useState('sales@demo.com');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [logs, setLogs] = useState<GpsLog[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapRef = useRef<any>(null);
  const pathLayerRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const containerId = "route-history-map-container";

  // Load Leaflet dynamically
  useEffect(() => {
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    if (!document.getElementById("leaflet-js")) {
      const script = document.createElement("script");
      script.id = "leaflet-js";
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      document.body.appendChild(script);
    }
  }, []);

  const loadRouteData = async () => {
    if (!username || !selectedDate) return;
    setLoading(true);
    setError(null);
    try {
      const client = ErpClientManager.getClient();
      const [gpsLogs, visitsList] = await Promise.all([
        client.getGpsLocationLogs(username, selectedDate),
        client.getVisits(username, selectedDate),
      ]);
      setLogs(gpsLogs);
      setVisits(visitsList);
      
      // Trigger map update
      updateMap(gpsLogs, visitsList);
    } catch (err: any) {
      setError(err.message || 'Failed to load route data');
    } finally {
      setLoading(false);
    }
  };

  const updateMap = (gpsLogs: GpsLog[], visitsList: Visit[]) => {
    const L = (window as any).L;
    if (!L) {
      // Retry in 500ms if script not fully loaded yet
      setTimeout(() => updateMap(gpsLogs, visitsList), 500);
      return;
    }

    // Initialize map if not present
    if (!mapRef.current) {
      const mapEl = document.getElementById(containerId);
      if (!mapEl) return;
      
      mapRef.current = L.map(containerId, { zoomControl: false }).setView([17.3850, 78.4867], 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapRef.current);

      pathLayerRef.current = L.featureGroup().addTo(mapRef.current);
      markersLayerRef.current = L.featureGroup().addTo(mapRef.current);
    }

    const map = mapRef.current;
    const pathLayer = pathLayerRef.current;
    const markersLayer = markersLayerRef.current;

    pathLayer.clearLayers();
    markersLayer.clearLayers();

    if (gpsLogs.length === 0 && visitsList.length === 0) {
      map.setView([17.3850, 78.4867], 12);
      return;
    }

    const latlngs: any[] = [];
    const bounds: any[] = [];

    // Plot GPS Logs path
    gpsLogs.forEach((log) => {
      latlngs.push([log.latitude, log.longitude]);
      bounds.push([log.latitude, log.longitude]);
    });

    if (latlngs.length > 1) {
      L.polyline(latlngs, {
        color: '#10b981', // emerald-500
        weight: 5,
        opacity: 0.85
      }).addTo(pathLayer);
    }

    // Plot Visit Markers
    visitsList.forEach((v, index) => {
      if (v.latitude != null && v.longitude != null) {
        bounds.push([v.latitude, v.longitude]);
        
        // Custom visit marker div
        const customIcon = L.divIcon({
          html: `<div style="background: ${v.status === 'Checked Out' ? '#6366f1' : '#facc15'}; width: 28px; height: 28px; border-radius: 50%; border: 3px solid #ffffff; display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 800; font-size: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.3)">${index + 1}</div>`,
          className: 'custom-visit-marker',
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });

        const popupContent = `
          <div style="font-family: 'Plus Jakarta Sans', sans-serif; padding: 6px; color: #1e293b">
            <h4 style="margin: 0 0 4px; font-weight: 700; color: #0f172a">${v.customer}</h4>
            <div style="font-size: 12px; color: #475569; margin-bottom: 4px;"><b>Type:</b> ${v.visitType}</div>
            <div style="font-size: 11px; color: #64748b;"><b>Time:</b> ${v.time} (${v.status})</div>
            ${v.description ? `<p style="margin: 6px 0 0; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 4px; color: #334155">${v.description}</p>` : ''}
          </div>
        `;

        L.marker([v.latitude, v.longitude], { icon: customIcon })
          .bindPopup(popupContent)
          .addTo(markersLayer);
      }
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  };

  useEffect(() => {
    loadRouteData();
  }, [selectedDate]);

  // Calculate Metrics
  const totalDistance = logs.reduce((sum, log) => {
    const d = parseFloat(String(log.distanceFromPrevious || '0'));
    return sum + (isNaN(d) ? 0 : d);
  }, 0);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: 'calc(100vh - 120px)' }}>
      {/* Settings Bar */}
      <div className="glass-card" style={{ padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)', padding: '6px 12px', borderRadius: '8px' }}>
            <User size={16} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{ background: 'none', border: 'none', color: '#ffffff', outline: 'none', fontSize: '14px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)', padding: '6px 12px', borderRadius: '8px' }}>
            <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ background: 'none', border: 'none', color: '#ffffff', outline: 'none', fontSize: '14px', colorScheme: 'dark' }}
            />
          </div>
        </div>

        <button onClick={loadRouteData} disabled={loading} className="btn-primary" style={{ padding: '8px 16px' }}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          Load Route
        </button>
      </div>

      {/* Map & Detail Container */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px', flex: 1, minHeight: 0 }}>
        {/* Left Side: Map view */}
        <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-light)', background: '#1e293b', display: 'flex', flexDirection: 'column' }}>
          <div id={containerId} style={{ flex: 1, zIndex: 1 }} />
          
          {/* Overlay Map loading state */}
          {loading && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10, backdropFilter: 'blur(4px)' }}>
              <RefreshCw size={28} className="spin" style={{ color: 'var(--color-primary)' }} />
            </div>
          )}
        </div>

        {/* Right Side: Route Logs Details */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', maxHeight: '100%' }}>
          <h3 style={{ fontSize: '16px', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Navigation size={18} style={{ color: 'var(--color-primary)' }} />
            Route Statistics
          </h3>

          {/* Mini Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>DISTANCE</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-primary)', marginTop: '4px' }}>{totalDistance.toFixed(2)} km</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>VISITS</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-secondary)', marginTop: '4px' }}>{visits.length} logged</div>
            </div>
          </div>

          {/* Visits Chronological Timeline */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <h4 style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Timeline Logs</h4>
            
            {visits.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)', textAlign: 'center', gap: '8px', opacity: 0.6 }}>
                <AlertCircle size={24} />
                <span style={{ fontSize: '12px' }}>No employee visits found for this day</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', paddingRight: '4px' }}>
                {visits.map((visit, idx) => (
                  <div key={visit.id} style={{ display: 'flex', gap: '12px', position: 'relative' }}>
                    {/* Line connection indicator */}
                    {idx < visits.length - 1 && (
                      <div style={{ position: 'absolute', left: '13px', top: '28px', bottom: '-20px', width: '2px', background: 'var(--border-light)' }} />
                    )}
                    
                    {/* Time indicator circle */}
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: visit.status === 'Checked Out' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(250, 204, 21, 0.15)',
                      border: `2px solid ${visit.status === 'Checked Out' ? 'var(--color-secondary)' : '#facc15'}`,
                      color: visit.status === 'Checked Out' ? 'var(--color-secondary)' : '#facc15',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 800,
                      flexShrink: 0
                    }}>
                      {idx + 1}
                    </div>

                    {/* Content details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: '#ffffff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{visit.customer}</h4>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{visit.time}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: visit.status === 'Checked Out' ? 'rgba(99,102,241,0.1)' : 'rgba(250,204,21,0.1)', color: visit.status === 'Checked Out' ? 'var(--color-secondary)' : '#facc15' }}>
                          {visit.status}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{visit.visitType}</span>
                      </div>
                      {visit.description && (
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)', padding: '6px 8px', borderRadius: '6px', marginTop: '6px', lineHeight: '1.4' }}>
                          {visit.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
