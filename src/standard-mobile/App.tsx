import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, StatusBar, Image } from 'react-native';
import { ErpClientManager, GpsLog, Visit, CompanyBranding } from 'standard-api';
import { LoginScreen } from './src/screens/LoginScreen';
import { TrackingScreen } from './src/screens/TrackingScreen';
import { OrderBookingScreen } from './src/screens/OrderBookingScreen';
import { MobileMap } from './src/components/MobileMap';
import { LocationTracker } from './src/services/LocationTracker';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [activeTab, setActiveTab] = useState<'tracking' | 'booking' | 'map'>('tracking');
  const [logs, setLogs] = useState<GpsLog[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loadingMap, setLoadingMap] = useState(false);
  const [branding, setBranding] = useState<CompanyBranding | null>(null);

  const loadBranding = async () => {
    try {
      const client = ErpClientManager.getClient();
      const data = await client.getCompanyBranding(username || 'Suntek');
      setBranding(data);
    } catch (err) {
      console.warn('Failed to load mobile branding:', err);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      loadBranding();
    } else {
      setBranding(null);
    }
  }, [isLoggedIn]);

  const handleLoginSuccess = (user: string) => {
    setUsername(user);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    LocationTracker.stopTracking();
    ErpClientManager.clearConfig();
    setIsLoggedIn(false);
    setUsername('');
    setActiveTab('tracking');
  };

  const loadMapData = async () => {
    if (!isLoggedIn || activeTab !== 'map') return;
    setLoadingMap(true);
    try {
      const todayISO = new Date().toISOString().slice(0, 10);
      const client = ErpClientManager.getClient();
      const [gpsLogs, visitsList] = await Promise.all([
        client.getGpsLocationLogs(username, todayISO),
        client.getVisits(username, todayISO)
      ]);
      setLogs(gpsLogs);
      setVisits(visitsList);
    } catch (err) {
      console.error('Failed to load map logs:', err);
    } finally {
      setLoadingMap(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'map') {
      void loadMapData();
    }
  }, [activeTab, isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#05080e' }}>
        <StatusBar barStyle="light-content" />
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header bar */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {branding?.logoUrl && (
            <Image
              source={{ uri: branding.logoUrl }}
              style={{ width: 34, height: 34, borderRadius: 8, resizeMode: 'contain', backgroundColor: 'rgba(255,255,255,0.02)' }}
            />
          )}
          <View>
            <Text style={styles.headerTitle}>{branding?.companyName || 'Suntek Sync'}</Text>
            <Text style={styles.headerSubtitle}>User: {username}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onClick={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Screen Content */}
      <View style={styles.content}>
        {activeTab === 'tracking' && <TrackingScreen currentUser={username} />}
        {activeTab === 'booking' && <OrderBookingScreen />}
        {activeTab === 'map' && (
          <View style={{ flex: 1, padding: 16 }}>
            <View style={styles.mapHeader}>
              <Text style={styles.mapTitle}>Today's Trace Path</Text>
              <TouchableOpacity onClick={loadMapData} disabled={loadingMap}>
                <Text style={styles.refreshText}>{loadingMap ? 'Refreshing...' : 'Refresh Route'}</Text>
              </TouchableOpacity>
            </View>
            <MobileMap logs={logs} visits={visits} />
          </View>
        )}
      </View>

      {/* Navigation tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'tracking' && styles.tabItemActive]}
          onClick={() => setActiveTab('tracking')}
        >
          <Text style={[styles.tabText, activeTab === 'tracking' && styles.tabTextActive]}>Tracking</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'booking' && styles.tabItemActive]}
          onClick={() => setActiveTab('booking')}
        >
          <Text style={[styles.tabText, activeTab === 'booking' && styles.tabTextActive]}>Book Order</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'map' && styles.tabItemActive]}
          onClick={() => setActiveTab('map')}
        >
          <Text style={[styles.tabText, activeTab === 'map' && styles.tabTextActive]}>View Map</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05080e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#090d16',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#65778a',
    marginTop: 2,
  },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  mapTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  refreshText: {
    color: '#10b981',
    fontWeight: '700',
    fontSize: 13,
  },
  tabBar: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: '#090d16',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemActive: {
    borderTopWidth: 2,
    borderTopColor: '#10b981',
  },
  tabText: {
    color: '#65778a',
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#10b981',
    fontWeight: '800',
  },
});
