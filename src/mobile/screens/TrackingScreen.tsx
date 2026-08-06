import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ErpClientManager, Customer, Visit } from '../../api';
import { LocationTracker } from '../services/LocationTracker';

interface TrackingScreenProps {
  currentUser: string;
}

const getTodayISO = () => new Date().toISOString().slice(0, 10);
const getYesterdayISO = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};

export const TrackingScreen: React.FC<TrackingScreenProps> = ({ currentUser }) => {
  const [subTab, setSubTab] = useState<'checkin' | 'history'>('checkin');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [description, setDescription] = useState('');
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);
  const [loading, setLoading] = useState(false);
  const [coordsLog, setCoordsLog] = useState<{ lat: number; lng: number; time: string }[]>([]);
  const [currentDateTime, setCurrentDateTime] = useState('');

  // History tab states
  const [visitHistory, setVisitHistory] = useState<Visit[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [dateFilterMode, setDateFilterMode] = useState<'today' | 'yesterday' | 'all' | 'custom'>('today');
  const [selectedFilterDate, setSelectedFilterDate] = useState(getTodayISO());

  useEffect(() => {
    const updateTime = () => {
      setCurrentDateTime(
        new Date().toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const ensureTrackingActive = async () => {
    const isAlreadyActive = LocationTracker.isTrackingActive();
    if (!isAlreadyActive) {
      const granted = await LocationTracker.requestPermissions();
      if (granted) {
        const config = ErpClientManager.getConfig();
        const interval = config?.gpsInterval || 900;
        LocationTracker.startTracking(currentUser, interval);
      }
    }
  };

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
    } catch (err) {
      console.error('Failed to load tracking screen data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadVisitHistory = async (overrideDate?: string) => {
    setHistoryLoading(true);
    try {
      const client = ErpClientManager.getClient();
      let targetDate: string | undefined = undefined;
      
      if (overrideDate !== undefined) {
        targetDate = overrideDate || undefined;
      } else {
        if (dateFilterMode === 'today') targetDate = getTodayISO();
        else if (dateFilterMode === 'yesterday') targetDate = getYesterdayISO();
        else if (dateFilterMode === 'custom') targetDate = selectedFilterDate || undefined;
        else if (dateFilterMode === 'all') targetDate = undefined;
      }

      const list = await client.getVisits(currentUser, targetDate);
      setVisitHistory(list);
    } catch (err) {
      console.error('Failed to load visit history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
    ensureTrackingActive();
  }, []);

  useEffect(() => {
    if (subTab === 'history') {
      loadVisitHistory();
    }
  }, [subTab]);

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
    if (!selectedCustomerId) {
      Alert.alert('Validation Error', 'Please select a Customer Partner for check-in.');
      return;
    }
    if (!description || !description.trim()) {
      Alert.alert('Validation Error', 'Please enter a Visit Description before logging check-in.');
      return;
    }
    setLoading(true);
    try {
      const client = ErpClientManager.getClient();

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
      loadVisitHistory();
    } catch (err: any) {
      Alert.alert('Action Failed', err.message || 'Check-in transaction aborted.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!activeVisit) return;
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
      loadVisitHistory();
    } catch (err: any) {
      Alert.alert('Action Failed', err.message || 'Check-out transaction aborted.');
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
    c.id.toLowerCase().includes(customerSearchQuery.toLowerCase())
  );

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  const filteredHistory = visitHistory.filter(v =>
    (v.customer || '').toLowerCase().includes(historySearchQuery.toLowerCase()) ||
    (v.id || '').toLowerCase().includes(historySearchQuery.toLowerCase()) ||
    (v.description || '').toLowerCase().includes(historySearchQuery.toLowerCase())
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>GPS Attendance & Visits</Text>

      {/* Sub-Tab Bar Switcher */}
      <View style={styles.subTabRow}>
        <TouchableOpacity
          style={[styles.subTabBtn, subTab === 'checkin' && styles.subTabBtnActive]}
          onPress={() => setSubTab('checkin')}
        >
          <Ionicons name="location-outline" size={16} color={subTab === 'checkin' ? '#ffffff' : '#64748b'} style={{ marginRight: 6 }} />
          <Text style={[styles.subTabText, subTab === 'checkin' && styles.subTabTextActive]}>Live Check-In</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTabBtn, subTab === 'history' && styles.subTabBtnActive]}
          onPress={() => setSubTab('history')}
        >
          <Ionicons name="time-outline" size={16} color={subTab === 'history' ? '#ffffff' : '#64748b'} style={{ marginRight: 6 }} />
          <Text style={[styles.subTabText, subTab === 'history' && styles.subTabTextActive]}>Visit History</Text>
        </TouchableOpacity>
      </View>

      {subTab === 'checkin' ? (
        <>
          {/* Mandatory Background Route Log Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#10b981" style={{ marginRight: 6 }} />
                <Text style={styles.cardTitle}>Background Route Tracing</Text>
              </View>
              <View style={styles.activePill}>
                <View style={styles.activeDot} />
                <Text style={styles.activePillText}>Mandatory Active</Text>
              </View>
            </View>

            <Text style={styles.metaText}>
              Automatic background location tracing is enforced for field team route verification (GPS ping every 15 mins).
            </Text>

            <TouchableOpacity 
              style={styles.btnPrimary} 
              onPress={handleForceSync}
              disabled={loading}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="sync-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.btnPrimaryText}>Sync GPS Location Now</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Active Visit Banner / Check-In Section */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Site Check-In / Check-Out</Text>
            
            {activeVisit ? (
              <View style={styles.activeVisitCard}>
                <View style={styles.activeHeader}>
                  <View style={styles.activePill}>
                    <View style={styles.activeDot} />
                    <Text style={styles.activePillText}>Checked In Active</Text>
                  </View>
                  <Text style={styles.visitId}>{activeVisit.id}</Text>
                </View>

                <Text style={styles.customerTitle}>{activeVisit.customer}</Text>
                
                <View style={styles.detailGrid}>
                  <View style={styles.detailCol}>
                    <Text style={styles.detailLabel}>Check-In Time</Text>
                    <Text style={styles.detailValue}>{activeVisit.date} {activeVisit.time}</Text>
                  </View>
                  <View style={styles.detailCol}>
                    <Text style={styles.detailLabel}>GPS Coords</Text>
                    <Text style={styles.detailValue}>
                      {activeVisit.latitude && activeVisit.longitude 
                        ? `${activeVisit.latitude.toFixed(4)}, ${activeVisit.longitude.toFixed(4)}` 
                        : 'Captured'}
                    </Text>
                  </View>
                </View>

                {activeVisit.description ? (
                  <View style={styles.notesBox}>
                    <Text style={styles.notesLabel}>Initial Notes:</Text>
                    <Text style={styles.notesText}>{activeVisit.description}</Text>
                  </View>
                ) : null}

                <Text style={[styles.label, { marginTop: 14 }]}>Check-Out Summary Notes</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Enter check-out visit outcome..."
                  placeholderTextColor="#5a6880"
                  style={styles.textarea}
                  multiline
                  numberOfLines={3}
                />

                <TouchableOpacity style={styles.btnPrimary} onPress={handleCheckOut} disabled={loading}>
                  {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.btnPrimaryText}>Perform Check-Out</Text>}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.formBlock}>
                <View style={styles.timestampBadge}>
                  <Ionicons name="time-outline" size={16} color="#10b981" style={{ marginRight: 6 }} />
                  <Text style={styles.timestampLabel}>Current Time: </Text>
                  <Text style={styles.timestampValue}>{currentDateTime}</Text>
                </View>

                <View style={styles.labelRow}>
                  <Text style={styles.label}>Select Client Customer</Text>
                  <Text style={styles.requiredStar}>*</Text>
                </View>

                {selectedCustomer ? (
                  <View style={styles.selectedCustomerBox}>
                    <View style={styles.selectedCustomerHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.selectedCustomerName}>{selectedCustomer.name}</Text>
                        <Text style={styles.selectedCustomerId}>ID: {selectedCustomer.id}</Text>
                      </View>
                      <TouchableOpacity onPress={() => setSelectedCustomerId('')}>
                        <Ionicons name="close-circle" size={20} color="#94a3b8" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={{ marginBottom: 14 }}>
                    <View style={styles.searchBoxWrapper}>
                      <Ionicons name="search-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
                      <TextInput
                        placeholder="Type customer name to search..."
                        placeholderTextColor="#5a6880"
                        value={customerSearchQuery}
                        onChangeText={setCustomerSearchQuery}
                        style={styles.searchBarInput}
                      />
                      {customerSearchQuery ? (
                        <TouchableOpacity onPress={() => setCustomerSearchQuery('')}>
                          <Ionicons name="close-circle" size={18} color="#64748b" />
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    {customerSearchQuery.trim().length > 0 && (
                      <View style={styles.searchResultsDropdown}>
                        {filteredCustomers.length === 0 ? (
                          <Text style={styles.noResultsText}>No customer found matching '{customerSearchQuery}'</Text>
                        ) : (
                          filteredCustomers.map((c) => (
                            <TouchableOpacity
                              key={c.id}
                              style={styles.searchResultRow}
                              onPress={() => {
                                setSelectedCustomerId(c.id);
                                setCustomerSearchQuery('');
                              }}
                            >
                              <Text style={styles.searchResultName}>{c.name}</Text>
                            </TouchableOpacity>
                          ))
                        )}
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.labelRow}>
                  <Text style={styles.label}>Visit Description</Text>
                  <Text style={styles.requiredStar}>*</Text>
                </View>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="e.g., Solar site survey and load assessment"
                  placeholderTextColor="#5a6880"
                  style={styles.input}
                />

                <TouchableOpacity style={styles.btnPrimary} onPress={handleCheckIn} disabled={loading || !selectedCustomerId}>
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
        </>
      ) : (
        /* Visit History Tab */
        <View style={styles.card}>
          {/* Date Filter Pills */}
          <View style={styles.dateFilterPillsRow}>
            <TouchableOpacity
              style={[styles.datePill, dateFilterMode === 'today' && styles.datePillActive]}
              onPress={() => {
                setDateFilterMode('today');
                setSelectedFilterDate(getTodayISO());
                loadVisitHistory(getTodayISO());
              }}
            >
              <Text style={[styles.datePillText, dateFilterMode === 'today' && styles.datePillTextActive]}>Today</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.datePill, dateFilterMode === 'yesterday' && styles.datePillActive]}
              onPress={() => {
                setDateFilterMode('yesterday');
                setSelectedFilterDate(getYesterdayISO());
                loadVisitHistory(getYesterdayISO());
              }}
            >
              <Text style={[styles.datePillText, dateFilterMode === 'yesterday' && styles.datePillTextActive]}>Yesterday</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.datePill, dateFilterMode === 'all' && styles.datePillActive]}
              onPress={() => {
                setDateFilterMode('all');
                setSelectedFilterDate('');
                loadVisitHistory('');
              }}
            >
              <Text style={[styles.datePillText, dateFilterMode === 'all' && styles.datePillTextActive]}>All Visits</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.datePill, dateFilterMode === 'custom' && styles.datePillActive]}
              onPress={() => setDateFilterMode('custom')}
            >
              <Text style={[styles.datePillText, dateFilterMode === 'custom' && styles.datePillTextActive]}>Custom</Text>
            </TouchableOpacity>
          </View>

          {/* Custom Date Input */}
          {dateFilterMode === 'custom' && (
            <View style={styles.customDateRow}>
              <Ionicons name="calendar-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
              <TextInput
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#5a6880"
                value={selectedFilterDate}
                onChangeText={setSelectedFilterDate}
                style={styles.customDateInput}
              />
              <TouchableOpacity
                style={styles.applyDateBtn}
                onPress={() => loadVisitHistory(selectedFilterDate)}
              >
                <Text style={styles.applyDateBtnText}>Apply</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.historySearchRow}>
            <View style={[styles.searchBoxWrapper, { flex: 1, marginRight: 8 }]}>
              <Ionicons name="search-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
              <TextInput
                placeholder="Search by customer name..."
                placeholderTextColor="#5a6880"
                value={historySearchQuery}
                onChangeText={setHistorySearchQuery}
                style={styles.searchBarInput}
              />
              {historySearchQuery ? (
                <TouchableOpacity onPress={() => setHistorySearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color="#64748b" />
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity style={styles.refreshIconBtn} onPress={() => loadVisitHistory()}>
              <Ionicons name="refresh-outline" size={20} color="#10b981" />
            </TouchableOpacity>
          </View>

          {historyLoading ? (
            <ActivityIndicator color="#10b981" style={{ marginTop: 30, marginBottom: 20 }} />
          ) : filteredHistory.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={48} color="#334155" />
              <Text style={styles.emptyTitle}>No Visit Logs Found</Text>
              <Text style={styles.emptySubtitle}>
                {dateFilterMode === 'today' ? "No visits recorded for today (" + getTodayISO() + ")" : "No visit logs match your selected filter."}
              </Text>
            </View>
          ) : (
            filteredHistory.map((visit) => (
              <View key={visit.id || Math.random().toString()} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyId}>{visit.id || 'VST'}</Text>
                  <View style={[styles.historyBadge, {
                    backgroundColor: visit.status === 'Checked Out' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                    borderColor: visit.status === 'Checked Out' ? '#10b981' : '#3b82f6'
                  }]}>
                    <Text style={[styles.historyBadgeText, { color: visit.status === 'Checked Out' ? '#10b981' : '#3b82f6' }]}>
                      {visit.status || 'Logged'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.historyCustomer}>{visit.customer}</Text>

                {visit.description ? (
                  <Text style={styles.historyNotes}>{visit.description}</Text>
                ) : null}

                <View style={styles.historyFooter}>
                  <View style={styles.historyDateRow}>
                    <Ionicons name="calendar-outline" size={13} color="#64748b" />
                    <Text style={styles.historyDateText}>{visit.date} {visit.time}</Text>
                  </View>
                  {visit.latitude && visit.longitude ? (
                    <View style={styles.historyDateRow}>
                      <Ionicons name="pin-outline" size={13} color="#10b981" />
                      <Text style={styles.historyGpsText}>
                        {visit.latitude.toFixed(3)}, {visit.longitude.toFixed(3)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ))
          )}
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
    marginBottom: 14,
  },
  subTabRow: {
    flexDirection: 'row',
    backgroundColor: '#090d16',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  subTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  subTabBtnActive: {
    backgroundColor: '#10b981',
  },
  subTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  subTabTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#090d16',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 15,
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
  },
  dotRed: {
    backgroundColor: '#ef4444',
  },
  metaText: {
    color: '#65778a',
    fontSize: 12.5,
    marginBottom: 14,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
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
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  btnOutlineText: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 13,
  },
  activeVisitCard: {
    marginTop: 10,
    backgroundColor: '#05080e',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  activePillText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '700',
  },
  visitId: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  customerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 10,
  },
  detailGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  detailCol: {
    flex: 1,
    backgroundColor: '#090d16',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  detailLabel: {
    fontSize: 10,
    color: '#64748b',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 12.5,
    color: '#e2e8f0',
    fontWeight: '700',
    marginTop: 3,
  },
  notesBox: {
    backgroundColor: '#090d16',
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
    marginVertical: 4,
  },
  notesLabel: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '700',
  },
  notesText: {
    fontSize: 12,
    color: '#cbd5e1',
    marginTop: 2,
  },
  formBlock: {
    marginTop: 10,
  },
  label: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#05080e',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 14,
  },
  textarea: {
    backgroundColor: '#05080e',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 14,
    textAlignVertical: 'top',
  },
  btnPrimary: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
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
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 4,
  },
  requiredStar: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '800',
  },
  searchBoxWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#05080e',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchBarInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
  },
  searchResultsDropdown: {
    marginTop: 8,
    backgroundColor: '#05080e',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    maxHeight: 180,
    overflow: 'hidden',
  },
  searchResultRow: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  searchResultName: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13.5,
  },
  noResultsText: {
    color: '#64748b',
    padding: 14,
    textAlign: 'center',
    fontSize: 12,
  },
  selectedCustomerBox: {
    marginBottom: 14,
    backgroundColor: '#05080e',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 10,
    padding: 12,
  },
  selectedCustomerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedCustomerName: {
    color: '#10b981',
    fontWeight: '800',
    fontSize: 14,
  },
  selectedCustomerId: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  timestampBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#05080e',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  timestampLabel: {
    fontSize: 12.5,
    color: '#64748b',
    fontWeight: '600',
  },
  timestampValue: {
    fontSize: 13,
    color: '#10b981',
    fontWeight: '700',
  },
  // Visit History Tab Styles
  dateFilterPillsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  datePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#05080e',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  datePillActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10b981',
  },
  datePillText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  datePillTextActive: {
    color: '#10b981',
    fontWeight: '700',
  },
  customDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#05080e',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  customDateInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
  },
  applyDateBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  applyDateBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  historySearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  refreshIconBtn: {
    padding: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  historyCard: {
    backgroundColor: '#05080e',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  historyId: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#ffffff',
  },
  historyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  historyBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  historyCustomer: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10b981',
    marginBottom: 4,
  },
  historyNotes: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 8,
  },
  historyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingTop: 8,
  },
  historyDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historyDateText: {
    fontSize: 11.5,
    color: '#64748b',
  },
  historyGpsText: {
    fontSize: 11.5,
    color: '#10b981',
    fontWeight: '600',
  },
});
