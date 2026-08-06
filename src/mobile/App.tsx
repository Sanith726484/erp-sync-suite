import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, StatusBar, Platform, Modal, ScrollView, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ErpClientManager, GpsLog, Visit, CompanyBranding, UserProfile, AttendanceLog } from '../api';
import { LoginScreen } from './screens/LoginScreen';
import { TrackingScreen } from './screens/TrackingScreen';
import { OrderBookingScreen } from './screens/OrderBookingScreen';
import { MobileMap } from './components/MobileMap';
import { LocationTracker } from './services/LocationTracker';

// Enable Network inspection in Expo Go / React Native DevTools
if (__DEV__) {
  // @ts-ignore
  if (global.originalXMLHttpRequest) {
    // @ts-ignore
    global.XMLHttpRequest = global.originalXMLHttpRequest;
  }
}

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

const formatAttendanceTime = (time: string): string => {
  const parsed = new Date(time.includes('T') ? time : time.replace(' ', 'T'));
  if (isNaN(parsed.getTime())) return time;
  return parsed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const formatMapDate = (d: Date): string =>
  d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const toDateISO = (d: Date): string => d.toISOString().slice(0, 10);

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
  const [attendanceStatus, setAttendanceStatus] = useState<'checked-in' | 'checked-out'>('checked-out');
  const [attendanceTime, setAttendanceTime] = useState<string | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [mapDate, setMapDate] = useState<Date>(() => new Date());

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

  const loadAttendanceStatus = async () => {
    try {
      const client = ErpClientManager.getClient();
      if (typeof client.getTodayAttendanceStatus !== 'function') return;

      const status: AttendanceLog | null = await client.getTodayAttendanceStatus(username);
      if (status && status.logType === 'IN') {
        setAttendanceStatus('checked-in');
        setAttendanceTime(status.time);
        // App restarted/resumed after an earlier check-in: resume GPS tracking.
        if (!LocationTracker.isTrackingActive()) {
          const granted = await LocationTracker.requestPermissions();
          if (granted) {
            const config = ErpClientManager.getConfig();
            LocationTracker.startTracking(username, config?.gpsInterval || 900);
          }
        }
      } else {
        setAttendanceStatus('checked-out');
        setAttendanceTime(status?.time || null);
      }
    } catch (err) {
      console.warn('Failed to load attendance status:', err);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      void loadUserDataAndBranding();
      void loadAttendanceStatus();
    } else {
      setBranding(null);
      setUserProfile(null);
      setAttendanceStatus('checked-out');
      setAttendanceTime(null);
    }
  }, [isLoggedIn]);

  const handleAttendanceCheckIn = async () => {
    setAttendanceLoading(true);
    try {
      const granted = await LocationTracker.requestPermissions();
      if (!granted) {
        Alert.alert('Permission Required', 'Location permission is needed to check in for attendance.');
        return;
      }

      const pos = await LocationTracker.getCurrentPosition();
      if (!pos) {
        Alert.alert('Check-In Failed', 'Unable to capture your current location.');
        return;
      }

      const client = ErpClientManager.getClient();
      const log = await client.checkInAttendance(pos.latitude, pos.longitude, username);

      setAttendanceStatus('checked-in');
      setAttendanceTime(log.time);

      const config = ErpClientManager.getConfig();
      LocationTracker.startTracking(username, config?.gpsInterval || 900);

      Alert.alert('Checked In', 'Attendance check-in recorded. GPS tracking has started.');
    } catch (err: any) {
      Alert.alert('Check-In Failed', err.message || 'Unable to record attendance check-in.');
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleAttendanceCheckOut = async () => {
    setAttendanceLoading(true);
    try {
      const pos = await LocationTracker.getCurrentPosition();
      const client = ErpClientManager.getClient();
      const log = await client.checkOutAttendance(pos?.latitude || 0, pos?.longitude || 0, username);

      setAttendanceStatus('checked-out');
      setAttendanceTime(log.time);
      LocationTracker.stopTracking();

      Alert.alert('Checked Out', 'Attendance check-out recorded. GPS tracking has stopped.');
    } catch (err: any) {
      Alert.alert('Check-Out Failed', err.message || 'Unable to record attendance check-out.');
    } finally {
      setAttendanceLoading(false);
    }
  };

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

  const handleForceSync = async () => {
    try {
      const result = await LocationTracker.trackNow();
      if (result) {
        setLogs(prev => [{
          user: username,
          latitude: result.latitude,
          longitude: result.longitude,
          timestamp: new Date().toISOString(),
        }, ...prev].slice(0, 12));
        Alert.alert('GPS Synced', `${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}`);
      } else {
        Alert.alert('GPS Sync Failed', 'Unable to capture the current location.');
      }
    } catch (err) {
      Alert.alert('GPS Sync Failed', 'Unable to capture the current location.');
    }
  };

  const loadMapData = async (dateOverride?: Date) => {
    if (!isLoggedIn || activeTab !== 'map') return;
    setLoadingMap(true);
    try {
      const dateISO = toDateISO(dateOverride || mapDate);
      const client = ErpClientManager.getClient();
      const [gpsLogs, visitsList] = await Promise.all([
        client.getGpsLocationLogs(username, dateISO),
        client.getVisits(username, dateISO)
      ]);
      setLogs(gpsLogs);
      setVisits(visitsList);
    } catch (err) {
      console.error('Failed to load map logs:', err);
    } finally {
      setLoadingMap(false);
    }
  };

  const shiftMapDate = (days: number) => {
    setMapDate(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() + days);
      return next;
    });
  };

  useEffect(() => {
    if (activeTab === 'map') {
      void loadMapData();
    }
  }, [activeTab, isLoggedIn, mapDate]);

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
          {activeTab === 'tracking' && 'Home'}
          {activeTab === 'booking' && 'Order Booking'}
          {activeTab === 'map' && 'Route Map'}
        </Text>

        <View style={{ width: 32 }} />
      </View>

      {/* Attendance Check-In Card */}
      <View style={styles.attendanceCard}>
        <View style={styles.attendanceHeaderRow}>
          <View style={styles.attendanceIconWrap}>
            <Ionicons name="time-outline" size={20} color="#10b981" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.attendanceTitle}>Attendance</Text>
            <Text style={styles.attendanceStatusText}>
              {attendanceStatus === 'checked-in'
                ? `Checked In${attendanceTime ? ' at ' + formatAttendanceTime(attendanceTime) : ''}`
                : 'Not Checked In Yet'}
            </Text>
          </View>
        </View>

        <View style={styles.attendanceBtnRow}>
          <TouchableOpacity
            style={[
              styles.attendanceBtn,
              attendanceStatus === 'checked-in' ? styles.attendanceBtnDisabled : styles.attendanceBtnIn,
            ]}
            onPress={handleAttendanceCheckIn}
            disabled={attendanceStatus === 'checked-in' || attendanceLoading}
          >
            {attendanceLoading && attendanceStatus !== 'checked-in' ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.attendanceBtnText}>Check In</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.attendanceBtn,
              attendanceStatus === 'checked-in' ? styles.attendanceBtnOut : styles.attendanceBtnDisabled,
            ]}
            onPress={handleAttendanceCheckOut}
            disabled={attendanceStatus !== 'checked-in' || attendanceLoading}
          >
            {attendanceLoading && attendanceStatus === 'checked-in' ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.attendanceBtnText}>Check Out</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Screen Content */}
      <View style={styles.content}>
        {activeTab === 'tracking' && <TrackingScreen currentUser={username} />}
        {activeTab === 'booking' && <OrderBookingScreen currentUser={username} />}
        {activeTab === 'map' && (() => {
          const timelineLogs = [...logs].slice(-8).reverse();
          const isTrackingActive = attendanceStatus === 'checked-in';
          const gpsIntervalMin = Math.round((clientConfig?.gpsInterval || 900) / 60);

          return (
            <View style={styles.mapScreen}>
              <View style={styles.mapHeader}>
                <Text style={styles.mapTitle}>Today's Route</Text>
                <TouchableOpacity onPress={() => loadMapData()} disabled={loadingMap}>
                  <Text style={styles.refreshText}>{loadingMap ? 'Refreshing...' : 'Refresh Route'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.mapContainerFixed}>
                <MobileMap logs={logs} visits={visits} />
              </View>

              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
                {/* GPS Tracking Status Card */}
                <View style={styles.gpsCard}>
                  <View style={styles.gpsCardHeaderRow}>
                    <View style={styles.gpsCardIconWrap}>
                      <Ionicons name="navigate" size={18} color="#10b981" />
                    </View>
                    <Text style={[styles.gpsCardTitle, { flex: 1 }]}>GPS Tracking</Text>
                    <View style={[styles.statusPill, isTrackingActive ? styles.statusPillActive : styles.statusPillPaused]}>
                      <View style={[styles.statusDotSmall, { backgroundColor: isTrackingActive ? '#10b981' : '#f59e0b' }]} />
                      <Text style={[styles.statusPillText, { color: isTrackingActive ? '#10b981' : '#f59e0b' }]}>
                        {isTrackingActive ? 'Active' : 'Paused'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.gpsCardSubtitle}>
                    {isTrackingActive
                      ? `Auto-syncing every ${gpsIntervalMin} min`
                      : 'Check in from Home to start auto-sync'}
                  </Text>

                  <View style={styles.gpsStatsRow}>
                    <View style={styles.gpsStatBox}>
                      <Text style={styles.gpsStatLabel}>Next auto-sync</Text>
                      <Text style={[styles.gpsStatValue, { color: isTrackingActive ? '#10b981' : '#f59e0b' }]}>
                        {isTrackingActive ? `Every ${gpsIntervalMin} min` : 'Paused'}
                      </Text>
                    </View>
                    <View style={styles.gpsStatBox}>
                      <Text style={styles.gpsStatLabel}>Last recorded</Text>
                      <Text style={styles.gpsStatValue}>
                        {timelineLogs[0] ? formatAttendanceTime(timelineLogs[0].timestamp) : '--'}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.gpsSyncBtn, !isTrackingActive && styles.gpsSyncBtnDisabled]}
                    onPress={handleForceSync}
                    disabled={!isTrackingActive}
                  >
                    <Text style={styles.gpsSyncBtnText}>
                      {isTrackingActive ? 'Sync GPS Now' : 'Sync Disabled (Not Checked In)'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Location Timeline Card */}
                <View style={styles.timelineCard}>
                  <View style={styles.timelineHeaderRow}>
                    <View style={styles.gpsCardIconWrap}>
                      <Ionicons name="location-outline" size={16} color="#10b981" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.gpsCardTitle}>Location timeline</Text>
                      <Text style={styles.timelineEntryCount}>
                        {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.dateNavRow}>
                    <TouchableOpacity onPress={() => shiftMapDate(-1)} style={styles.dateNavBtn}>
                      <Ionicons name="chevron-back" size={16} color="#94a3b8" />
                    </TouchableOpacity>
                    <View style={styles.datePillDisplay}>
                      <Ionicons name="calendar-outline" size={12} color="#10b981" style={{ marginRight: 4 }} />
                      <Text style={styles.datePillDisplayText}>{formatMapDate(mapDate)}</Text>
                    </View>
                    <TouchableOpacity onPress={() => shiftMapDate(1)} style={styles.dateNavBtn}>
                      <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>

                  {timelineLogs.length === 0 ? (
                    <Text style={styles.recentLogsEmpty}>No GPS points recorded for this date.</Text>
                  ) : (
                    timelineLogs.map((log, index) => {
                      const rawDistance = log.distanceFromPrevious;
                      const distanceKm = typeof rawDistance === 'string' ? parseFloat(rawDistance) : rawDistance;
                      const isStationary = !distanceKm || isNaN(distanceKm) || distanceKm < 0.01;

                      return (
                        <View key={log.id || `${log.timestamp}-${index}`} style={styles.timelineRow}>
                          <View style={styles.timelineMarkerCol}>
                            <View style={[styles.timelineDot, index === 0 && styles.timelineDotActive]} />
                            {index < timelineLogs.length - 1 && <View style={styles.timelineLine} />}
                          </View>
                          <View style={styles.timelineContent}>
                            <View style={styles.timelineTopRow}>
                              <Text style={styles.timelineTime}>{formatAttendanceTime(log.timestamp)}</Text>
                              <Text style={[styles.timelineBadge, isStationary ? styles.timelineBadgeStationary : styles.timelineBadgeMoving]}>
                                {isStationary ? 'Stationary' : `${(distanceKm as number * 1000).toFixed(0)} m`}
                              </Text>
                            </View>
                            <Text style={styles.timelineCoords}>{log.latitude.toFixed(5)}, {log.longitude.toFixed(5)}</Text>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              </ScrollView>
            </View>
          );
        })()}
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

              <View style={styles.sidebarSectionCard}>
                <View style={styles.sidebarSectionHeader}>
                  <Ionicons name="navigate-outline" size={18} color="#10b981" />
                  <Text style={styles.sidebarSectionTitle}>Location Tracking</Text>
                </View>
                <Text style={styles.sidebarSectionText}>
                  {attendanceStatus === 'checked-in'
                    ? 'Location tracking is active for field verification and can be synced manually from here.'
                    : 'Location tracking starts automatically once you check in for attendance.'}
                </Text>
                <TouchableOpacity
                  style={[styles.inlineActionBtn, attendanceStatus !== 'checked-in' && styles.inlineActionBtnDisabled]}
                  onPress={handleForceSync}
                  disabled={attendanceStatus !== 'checked-in'}
                >
                  <Ionicons name="sync-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.inlineActionText}>Sync GPS Now</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />

              <Text style={styles.sectionHeading}>Account & Profile Details</Text>

              {userProfile?.mobileNo ? (
                <View style={styles.infoRow}>
                  <Ionicons name="call-outline" size={18} color="#64748b" />
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>Mobile Number</Text>
                    <Text style={styles.infoValue}>{userProfile.mobileNo}</Text>
                  </View>
                </View>
              ) : null}

              {userProfile?.roleProfile || userProfile?.userType ? (
                <View style={styles.infoRow}>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#64748b" />
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>Role / User Type</Text>
                    <Text style={styles.infoValue}>{userProfile.roleProfile || userProfile.userType}</Text>
                  </View>
                </View>
              ) : null}

              {userProfile?.timeZone ? (
                <View style={styles.infoRow}>
                  <Ionicons name="time-outline" size={18} color="#64748b" />
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>Time Zone</Text>
                    <Text style={styles.infoValue}>{userProfile.timeZone}</Text>
                  </View>
                </View>
              ) : null}

              <View style={styles.infoRow}>
                <Ionicons name="server-outline" size={18} color="#64748b" />
                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>ERP Site</Text>
                  <Text style={styles.infoValue} numberOfLines={1}>{clientConfig?.host || 'ERPNext Site'}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="hardware-chip-outline" size={18} color="#64748b" />
                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>App Version</Text>
                  <Text style={styles.infoValue}>1.0.0</Text>
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
          <Text style={[styles.tabText, activeTab === 'tracking' && styles.tabTextActive]}>Visits</Text>
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
  attendanceCard: {
    backgroundColor: '#090d16',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 12,
  },
  attendanceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  attendanceIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  attendanceTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  attendanceStatusText: {
    fontSize: 12.5,
    color: '#94a3b8',
    marginTop: 2,
  },
  attendanceBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  attendanceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 8,
  },
  attendanceBtnIn: {
    backgroundColor: '#10b981',
  },
  attendanceBtnOut: {
    backgroundColor: '#ef4444',
  },
  attendanceBtnDisabled: {
    backgroundColor: '#374151',
  },
  attendanceBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13.5,
  },
  mapScreen: {
    flex: 1,
    padding: 16,
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  mapContainerFixed: {
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  recentLogsEmpty: {
    color: '#94a3b8',
    fontSize: 12,
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
  gpsCard: {
    backgroundColor: '#090d16',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  gpsCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  gpsCardIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  gpsCardTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#ffffff',
  },
  gpsCardSubtitle: {
    fontSize: 12.5,
    color: '#94a3b8',
    marginBottom: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusPillActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  statusPillPaused: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  statusDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  gpsStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  gpsStatBox: {
    flex: 1,
    backgroundColor: '#05080e',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
    padding: 10,
  },
  gpsStatLabel: {
    fontSize: 10.5,
    color: '#64748b',
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 4,
  },
  gpsStatValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#f8fafc',
  },
  gpsSyncBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  gpsSyncBtnDisabled: {
    backgroundColor: '#374151',
  },
  gpsSyncBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13.5,
  },
  timelineCard: {
    backgroundColor: '#090d16',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
  },
  timelineHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  timelineEntryCount: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 1,
  },
  dateNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },
  dateNavBtn: {
    padding: 6,
    backgroundColor: '#05080e',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
  },
  datePillDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#05080e',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  datePillDisplayText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
  },
  timelineRow: {
    flexDirection: 'row',
  },
  timelineMarkerCol: {
    width: 18,
    alignItems: 'center',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#334155',
    backgroundColor: '#090d16',
    marginTop: 3,
  },
  timelineDotActive: {
    borderColor: '#10b981',
    backgroundColor: '#10b981',
  },
  timelineLine: {
    width: 1,
    flex: 1,
    minHeight: 24,
    backgroundColor: '#1e293b',
    marginTop: 2,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 16,
  },
  timelineTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineTime: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },
  timelineBadge: {
    fontSize: 10.5,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  timelineBadgeStationary: {
    color: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  timelineBadgeMoving: {
    color: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  timelineCoords: {
    color: '#64748b',
    fontSize: 11.5,
    marginTop: 3,
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
  sidebarSectionCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 12,
    marginBottom: 12,
  },
  sidebarSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  sidebarSectionTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  sidebarSectionText: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  inlineActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  inlineActionBtnDisabled: {
    backgroundColor: '#374151',
  },
  inlineActionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
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
