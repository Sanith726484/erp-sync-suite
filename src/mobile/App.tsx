import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, StatusBar, Platform, Modal, ScrollView, Image } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ErpClientManager, GpsLog, Visit, CompanyBranding, UserProfile } from 'api';
import { LoginScreen } from './screens/LoginScreen';
import { TrackingScreen } from './screens/TrackingScreen';
import { OrderBookingScreen } from './screens/OrderBookingScreen';
import { MobileMap } from './components/MobileMap';
import { LocationTracker } from './services/LocationTracker';

// Helper functions for user formatting
const getUserDisplayName = (user: string): string => {
  if (!user || user.startsWith('/')) return 'Administrator';
  let namePart = user.includes('@') ? user.split('@')[0] : user;
  namePart = namePart.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[._-]/g, ' ');
  return namePart
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const getUserEmail = (user: string, company?: string): string => {
  if (!user || user.startsWith('/')) return 'administrator@erpnext.com';
  if (user.includes('@')) return user;
  const domain = company 
    ? company.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com' 
    : 'erpnext.com';
  const slug = user.toLowerCase().replace(/[^a-z0-9]/g, '.');
  return `${slug}@${domain}`;
};

const getUserInitials = (displayName: string): string => {
  const parts = displayName.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (displayName.slice(0, 2) || 'FU').toUpperCase();
};

function MainApp() {
  const insets = useSafeAreaInsets();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'tracking' | 'booking' | 'map'>('tracking');
  const [logs, setLogs] = useState<GpsLog[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loadingMap, setLoadingMap] = useState(false);
  const [branding, setBranding] = useState<CompanyBranding | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const loadUserDataAndBranding = async () => {
    try {
      const client = ErpClientManager.getClient();
      if (!client) return;

      let sessionUser: string | null = null;
      if (typeof client.getLoggedUser === 'function') {
        sessionUser = await client.getLoggedUser().catch(() => null);
      }

      const targetUser = (sessionUser && typeof sessionUser === 'string' && !sessionUser.startsWith('/')) 
        ? sessionUser 
        : username;

      let brandingData: CompanyBranding | null = null;
      if (typeof client.getCompanyBranding === 'function') {
        brandingData = await client.getCompanyBranding().catch(() => null);
      }

      let profileData: UserProfile | null = null;
      if (typeof client.getUserProfile === 'function') {
        profileData = await client.getUserProfile(targetUser).catch(() => null);
      }

      if (brandingData) setBranding(brandingData);
      if (profileData) {
        setUserProfile(profileData);
        if (profileData.username) setUsername(profileData.username);
      } else if (targetUser) {
        setUsername(targetUser);
      }
    } catch (err) {
      console.warn('Failed to load mobile branding and user profile:', err);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      void loadUserDataAndBranding();
    } else {
      setBranding(null);
      setUserProfile(null);
    }
  }, [isLoggedIn]);

  const handleLoginSuccess = (user: string) => {
    setUsername(user);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsSidebarOpen(false);
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

  const topInset = Math.max(insets.top, 12);
  const bottomInset = Math.max(insets.bottom, 28);

  if (!isLoggedIn) {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        <StatusBar barStyle="light-content" />
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      </View>
    );
  }

  const clientConfig = ErpClientManager.getConfig();
  const displayName = getUserDisplayName(username);
  const userEmail = getUserEmail(username, branding?.companyName);
  const initials = getUserInitials(displayName);

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <StatusBar barStyle="light-content" />

      {/* Top Floating Bar with Profile Icon */}
      <View style={styles.topBar}>
        <TouchableOpacity 
          style={styles.profileBtn} 
          onPress={() => setIsSidebarOpen(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="person-circle" size={32} color="#10b981" />
        </TouchableOpacity>

        <Text style={styles.topTitle}>
          {activeTab === 'tracking' && 'Location Tracking'}
          {activeTab === 'booking' && 'Order Booking'}
          {activeTab === 'map' && 'Trace Map'}
        </Text>

        <View style={{ width: 32 }} />
      </View>

      {/* Screen Content */}
      <View style={styles.content}>
        {activeTab === 'tracking' && <TrackingScreen currentUser={username} />}
        {activeTab === 'booking' && <OrderBookingScreen />}
        {activeTab === 'map' && (
          <View style={{ flex: 1, padding: 16 }}>
            <View style={styles.mapHeader}>
              <Text style={styles.mapTitle}>Today's Trace Path</Text>
              <TouchableOpacity onPress={loadMapData} disabled={loadingMap}>
                <Text style={styles.refreshText}>{loadingMap ? 'Refreshing...' : 'Refresh Route'}</Text>
              </TouchableOpacity>
            </View>
            <MobileMap logs={logs} visits={visits} />
          </View>
        )}
      </View>

      {/* Profile Sidebar Drawer Modal */}
      <Modal
        visible={isSidebarOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsSidebarOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.backdropTouch} 
            activeOpacity={1} 
            onPress={() => setIsSidebarOpen(false)} 
          />
          
          <View style={[styles.sidebarDrawer, { paddingTop: topInset + 10, paddingBottom: bottomInset + 10 }]}>
            <View style={styles.sidebarHeader}>
              <View style={styles.avatarLarge}>
                {userProfile?.userImage ? (
                  <Image source={{ uri: userProfile.userImage }} style={{ width: 56, height: 56, borderRadius: 28 }} />
                ) : (
                  <Text style={styles.avatarInitials}>{initials}</Text>
                )}
              </View>

              <TouchableOpacity 
                style={styles.closeBtn} 
                onPress={() => setIsSidebarOpen(false)}
              >
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sidebarBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.sidebarName}>{userProfile?.fullName || displayName}</Text>
              <Text style={styles.sidebarEmail}>{userProfile?.email || userEmail}</Text>
              
              <View style={styles.companyPill}>
                <Ionicons name="business" size={14} color="#10b981" />
                <Text style={styles.companyPillText}>{branding?.companyName || 'ERPNext Site'}</Text>
              </View>

              <View style={styles.divider} />

              <Text style={styles.sectionHeading}>Account & Connection</Text>

              <View style={styles.infoRow}>
                <Ionicons name="person-outline" size={18} color="#64748b" />
                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>User ID / Username</Text>
                  <Text style={styles.infoValue}>{(!username || username.startsWith('/')) ? displayName : username}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="server-outline" size={18} color="#64748b" />
                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>ERP Host Server</Text>
                  <Text style={styles.infoValue} numberOfLines={1}>{clientConfig?.host || 'Local Mock Server'}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="hardware-chip-outline" size={18} color="#64748b" />
                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>App Version</Text>
                  <Text style={styles.infoValue}>1.0.0 (Expo SDK 56)</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <TouchableOpacity style={styles.sidebarLogoutBtn} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={20} color="#ffffff" />
                <Text style={styles.sidebarLogoutText}>Log Out Account</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Navigation tabs footer menu */}
      <View style={[styles.tabBar, { paddingBottom: bottomInset, height: 58 + bottomInset }]}>
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'tracking' && styles.tabItemActive]}
          onPress={() => setActiveTab('tracking')}
        >
          <Ionicons 
            name={activeTab === 'tracking' ? 'location' : 'location-outline'} 
            size={22} 
            color={activeTab === 'tracking' ? '#10b981' : '#65778a'} 
          />
          <Text style={[styles.tabText, activeTab === 'tracking' && styles.tabTextActive]}>Tracking</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'booking' && styles.tabItemActive]}
          onPress={() => setActiveTab('booking')}
        >
          <Ionicons 
            name={activeTab === 'booking' ? 'cart' : 'cart-outline'} 
            size={22} 
            color={activeTab === 'booking' ? '#10b981' : '#65778a'} 
          />
          <Text style={[styles.tabText, activeTab === 'booking' && styles.tabTextActive]}>Book Order</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'map' && styles.tabItemActive]}
          onPress={() => setActiveTab('map')}
        >
          <Ionicons 
            name={activeTab === 'map' ? 'map' : 'map-outline'} 
            size={22} 
            color={activeTab === 'map' ? '#10b981' : '#65778a'} 
          />
          <Text style={[styles.tabText, activeTab === 'map' && styles.tabTextActive]}>View Map</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05080e',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#090d16',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  profileBtn: {
    padding: 2,
  },
  topTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    flexDirection: 'row',
  },
  backdropTouch: {
    flex: 1,
  },
  sidebarDrawer: {
    width: '78%',
    backgroundColor: '#0f172a',
    borderLeftWidth: 1,
    borderLeftColor: '#334155',
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 20,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#10b981',
  },
  avatarInitials: {
    color: '#10b981',
    fontWeight: '800',
    fontSize: 20,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#1e293b',
  },
  sidebarBody: {
    flex: 1,
  },
  sidebarName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 2,
  },
  sidebarEmail: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 10,
  },
  companyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginBottom: 16,
  },
  companyPillText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#1e293b',
    marginVertical: 16,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e2e8f0',
    marginTop: 1,
  },
  sidebarLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  sidebarLogoutText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#090d16',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
  },
  tabItemActive: {
    borderTopWidth: 2,
    borderTopColor: '#10b981',
  },
  tabText: {
    color: '#65778a',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
  },
  tabTextActive: {
    color: '#10b981',
    fontWeight: '800',
  },
});
