import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { ErpClientManager, Customer, Visit } from 'api';
import { LocationTracker } from '../services/LocationTracker';

interface TrackingScreenProps {
  currentUser: string;
}

export const TrackingScreen: React.FC<TrackingScreenProps> = ({ currentUser }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [description, setDescription] = useState('');
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);
  const [loading, setLoading] = useState(false);
  const [trackingActive, setTrackingActive] = useState(false);
  const [coordsLog, setCoordsLog] = useState<{ lat: number; lng: number; time: string }[]>([]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const client = ErpClientManager.getClient();
      const [custList, currentActive] = await Promise.all([
        client.getCustomers(),
        client.getActiveVisit(currentUser),
      ]);
      setCustomers(custList);
      setActiveVisit(currentActive);
      if (custList.length > 0) {
        setSelectedCustomerId(custList[0].id);
      }
    } catch (err) {
      console.error('Failed to load tracking screen data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
    setTrackingActive(LocationTracker.isTrackingActive());
  }, []);

  const handleToggleTracking = async () => {
    if (trackingActive) {
      LocationTracker.stopTracking();
      setTrackingActive(false);
      Alert.alert('Tracking Stopped', 'Periodic GPS coordinate synchronization has been suspended.');
    } else {
      const granted = await LocationTracker.requestPermissions();
      if (granted) {
        const config = ErpClientManager.getConfig();
        const interval = config?.gpsInterval || 900;
        LocationTracker.startTracking(currentUser, interval);
        setTrackingActive(true);
        Alert.alert('Tracking Started', `Periodic background location logging is now active (every ${interval}s).`);
        
        // Log initial position
        const p = await LocationTracker.trackNow();
        if (p) {
          setCoordsLog(prev => [{ lat: p.latitude, lng: p.longitude, time: new Date().toLocaleTimeString() }, ...prev]);
        }
      } else {
        Alert.alert('Permission Denied', 'GPS location permissions are required for route tracking.');
      }
    }
  };

  const handleForceSync = async () => {
    setLoading(true);
    const p = await LocationTracker.trackNow();
    setLoading(false);
    if (p) {
      setCoordsLog(prev => [{ lat: p.latitude, lng: p.longitude, time: new Date().toLocaleTimeString() }, ...prev]);
      Alert.alert('Sync Successful', `Position logged: ${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}`);
    } else {
      Alert.alert('Sync Failed', 'Unable to acquire GPS coordinates.');
    }
  };

  const handleCheckIn = async () => {
    if (!selectedCustomerId) return;
    setLoading(true);
    try {
      const client = ErpClientManager.getClient();
      
      // Get current location coords
      let lat = 0;
      let lng = 0;
      const p = await LocationTracker.trackNow();
      if (p) {
        lat = p.latitude;
        lng = p.longitude;
        setCoordsLog(prev => [{ lat: p.latitude, lng: p.longitude, time: new Date().toLocaleTimeString() }, ...prev]);
      }

      const today = new Date().toISOString().slice(0, 10);
      const timeStr = new Date().toTimeString().slice(0, 8);

      const v = await client.checkInVisit({
        customer: selectedCustomerId,
        visitType: 'Client Meet & Site Visit',
        date: today,
        time: timeStr,
        latitude: lat,
        longitude: lng,
        description,
      });

      setActiveVisit(v);
      setDescription('');
      Alert.alert('Checked In', `Checked in successfully at ${v.customer}.`);
    } catch (err: any) {
      Alert.alert('Action Failed', err.message || 'Check-in transaction aborted.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!activeVisit || !activeVisit.id) return;
    setLoading(true);
    try {
      const client = ErpClientManager.getClient();
      
      let lat = undefined;
      let lng = undefined;
      const p = await LocationTracker.trackNow();
      if (p) {
        lat = p.latitude;
        lng = p.longitude;
      }

      await client.checkOutVisit(activeVisit.id, description, lat, lng);
      setActiveVisit(null);
      setDescription('');
      Alert.alert('Checked Out', 'Check-out completed.');
    } catch (err: any) {
      Alert.alert('Action Failed', err.message || 'Check-out transaction aborted.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>GPS Attendance & Check-In</Text>

      {/* Connection Mode Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Background Route Log</Text>
          <View style={[styles.statusDot, trackingActive ? styles.dotGreen : styles.dotRed]} />
        </View>

        <Text style={styles.metaText}>
          {trackingActive 
            ? 'Background location tracing active. Sending GPS ping every 15 minutes.' 
            : 'Background location tracing is suspended.'}
        </Text>

        <View style={styles.btnRow}>
          <TouchableOpacity 
            style={[styles.btn, trackingActive ? styles.btnDanger : styles.btnSuccess]} 
            onClick={handleToggleTracking}
          >
            <Text style={styles.btnText}>
              {trackingActive ? 'Suspend Logging' : 'Activate Tracing'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.btnOutline} 
            onClick={handleForceSync}
            disabled={!trackingActive}
          >
            <Text style={[styles.btnOutlineText, !trackingActive && { opacity: 0.5 }]}>Log Ping Now</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Check In / Out Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {activeVisit ? 'Checked In' : 'Start Customer Visit'}
        </Text>

        {activeVisit ? (
          <View style={styles.activeVisitBlock}>
            <Text style={styles.activeCustLabel}>Active Visit Partner</Text>
            <Text style={styles.activeCustName}>{activeVisit.customer}</Text>
            <Text style={styles.activeCustTime}>Checked In: {activeVisit.time}</Text>
            
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Enter check-out visit summary..."
              placeholderTextColor="#5a6880"
              style={styles.textarea}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity style={styles.btnPrimary} onClick={handleCheckOut} disabled={loading}>
              {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.btnPrimaryText}>Perform Check-Out</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.formBlock}>
            <Text style={styles.label}>Select Client Customer</Text>
            <View style={styles.selectWrapper}>
              {customers.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.selectOption, selectedCustomerId === c.id && styles.selectOptionActive]}
                  onClick={() => setSelectedCustomerId(c.id)}
                >
                  <Text style={[styles.selectOptionText, selectedCustomerId === c.id && styles.selectOptionTextActive]}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Visit Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="e.g., Solar site survey and load assessment"
              placeholderTextColor="#5a6880"
              style={styles.input}
            />

            <TouchableOpacity style={styles.btnPrimary} onClick={handleCheckIn} disabled={loading || !selectedCustomerId}>
              {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.btnPrimaryText}>Log Check-In</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Coords log list */}
      {coordsLog.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent GPS Pings</Text>
          {coordsLog.map((log, i) => (
            <View key={i} style={styles.logRow}>
              <Text style={styles.logText}>Lat: {log.lat.toFixed(5)}, Lng: {log.lng.toFixed(5)}</Text>
              <Text style={styles.logTime}>{log.time}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#05080e',
    flexGrow: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 20,
    marginTop: 10,
  },
  card: {
    backgroundColor: '#090d16',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    padding: 18,
    marginBottom: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotGreen: {
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowRadius: 6,
    shadowOpacity: 0.5,
  },
  dotRed: {
    backgroundColor: '#ef4444',
  },
  metaText: {
    fontSize: 13,
    color: '#65778a',
    lineHeight: 18,
    marginBottom: 16,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnSuccess: {
    backgroundColor: '#10b981',
  },
  btnDanger: {
    backgroundColor: '#ef4444',
  },
  btnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  btnOutline: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnOutlineText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#65778a',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#05080e',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 16,
  },
  textarea: {
    backgroundColor: '#05080e',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 16,
    height: 80,
    textAlignVertical: 'top',
  },
  selectWrapper: {
    maxHeight: 120,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
    overflow: 'hidden',
  },
  selectOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#090d16',
  },
  selectOptionActive: {
    backgroundColor: '#10b981',
  },
  selectOptionText: {
    color: '#65778a',
    fontSize: 13.5,
  },
  selectOptionTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  btnPrimary: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  activeVisitBlock: {
    marginTop: 10,
  },
  activeCustLabel: {
    fontSize: 11,
    color: '#65778a',
  },
  activeCustName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 2,
  },
  activeCustTime: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 16,
  },
  formBlock: {
    marginTop: 10,
  },
  logRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  logText: {
    color: '#65778a',
    fontSize: 12,
  },
  logTime: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});
