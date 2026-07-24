import React, { useRef, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { GpsLog, Visit } from 'standard-api';

interface MobileMapProps {
  logs: GpsLog[];
  visits: Visit[];
}

export const MobileMap: React.FC<MobileMapProps> = ({ logs, visits }) => {
  const webViewRef = useRef<WebView>(null);

  // Generate Leaflet HTML
  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        * { box-sizing: border-box; }
        html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #05080e; }
        .leaflet-control-attribution { font-size: 8px; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = null;
        var pathLayer = null;
        var markersLayer = null;

        function initMap() {
          map = L.map('map', { zoomControl: false }).setView([17.3850, 78.4867], 12);
          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19
          }).addTo(map);
          pathLayer = L.featureGroup().addTo(map);
          markersLayer = L.featureGroup().addTo(map);
        }

        window.drawRoute = function(data) {
          if (!map) initMap();
          pathLayer.clearLayers();
          markersLayer.clearLayers();

          var points = [];
          
          // Draw Polyline path
          if (data.coords && data.coords.length > 0) {
            var latlngs = data.coords.map(function(c) {
              points.push([c.latitude, c.longitude]);
              return [c.latitude, c.longitude];
            });

            if (latlngs.length > 1) {
              L.polyline(latlngs, {
                color: '#10b981',
                weight: 5,
                opacity: 0.85
              }).addTo(pathLayer);
            }
          }

          // Add Markers
          if (data.visits && data.visits.length > 0) {
            data.visits.forEach(function(v, index) {
              if (v.latitude && v.longitude) {
                points.push([v.latitude, v.longitude]);
                
                var customIcon = L.divIcon({
                  html: '<div style="background: ' + (v.status === 'Checked Out' ? '#6366f1' : '#facc15') + '; width: 24px; height: 24px; border-radius: 50%; border: 2px solid #ffffff; display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 800; font-size: 11px; box-shadow: 0 2px 5px rgba(0,0,0,0.3)">' + (index + 1) + '</div>',
                  iconSize: [24, 24],
                  iconAnchor: [12, 12]
                });

                L.marker([v.latitude, v.longitude], { icon: customIcon })
                  .bindPopup('<b>' + v.customer + '</b><br/>' + v.time + ' (' + v.status + ')')
                  .addTo(markersLayer);
              }
            });
          }

          // Fit bounds
          if (points.length > 0) {
            map.fitBounds(points, { padding: [30, 30] });
          } else {
            map.setView([17.3850, 78.4867], 12);
          }
        };

        initMap();
      </script>
    </body>
    </html>
  `;

  // Inject update event when parameters change
  useEffect(() => {
    if (webViewRef.current) {
      const dataPayload = JSON.stringify({
        coords: logs.map(l => ({ latitude: l.latitude, longitude: l.longitude })),
        visits: visits.map(v => ({ customer: v.customer, status: v.status, time: v.time, latitude: v.latitude, longitude: v.longitude }))
      });
      const runScript = `if (window.drawRoute) { window.drawRoute(${dataPayload}); } true;`;
      webViewRef.current.injectJavaScript(runScript);
    }
  }, [logs, visits]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: mapHtml }}
        style={{ flex: 1 }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: '#05080e',
  },
});
