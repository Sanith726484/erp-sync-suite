import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ErpClientManager, ExpenseClaim, EmployeeAdvance } from '../../api';
import { ExpenseClaimForm } from '../components/ExpenseClaimForm';

interface ExpensesScreenProps {
  currentUser: string;
  currency?: string;
}

const RECENT_LIMIT = 5;

const formatDisplayDate = (iso: string): string => {
  const parsed = new Date(`${iso}T00:00:00`);
  if (isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const STATUS_COLORS: Record<ExpenseClaim['approvalStatus'], string> = {
  Draft: '#f59e0b',
  Approved: '#10b981',
  Rejected: '#ef4444',
};

const STATUS_LABELS: Record<ExpenseClaim['approvalStatus'], string> = {
  Draft: 'Pending',
  Approved: 'Approved',
  Rejected: 'Rejected',
};

export const ExpensesScreen: React.FC<ExpensesScreenProps> = ({ currentUser, currency = 'INR' }) => {
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [advances, setAdvances] = useState<EmployeeAdvance[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAllClaims, setShowAllClaims] = useState(false);

  const [isClaimFormVisible, setIsClaimFormVisible] = useState(false);

  const formatAmount = (value: number): string =>
    `${currency} ${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  const loadData = async () => {
    setLoading(true);
    try {
      const client = ErpClientManager.getClient();
      const [claimsList, advancesList, typesList] = await Promise.all([
        client.getExpenseClaims(currentUser),
        client.getEmployeeAdvances(currentUser),
        client.getExpenseClaimTypes(),
      ]);
      setClaims(claimsList);
      setAdvances(advancesList);
      setExpenseTypes(typesList);
    } catch (err) {
      console.error('Failed to load expense data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [currentUser]);

  const sumBy = (status: ExpenseClaim['approvalStatus']) =>
    claims.filter(c => c.approvalStatus === status).reduce((sum, c) => sum + c.totalClaimedAmount, 0);

  const totalClaimed = claims.reduce((sum, c) => sum + c.totalClaimedAmount, 0);
  const visibleClaims = showAllClaims ? claims : claims.slice(0, RECENT_LIMIT);

  const handleClaimCreated = (created: ExpenseClaim) => {
    setIsClaimFormVisible(false);
    Alert.alert('Expense Claimed', `Expense claim ${created.id || ''} has been created and sent for approval.`);
    void loadData();
  };

  return (
    <View style={styles.screenWrapper}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor="#10b981" />}
      >
        {/* Expense Claim Summary */}
        <Text style={styles.sectionTitle}>Expense Claim Summary</Text>
        <View style={styles.card}>
          <Text style={styles.summaryLabel}>Total Claimed Amount</Text>
          <Text style={styles.summaryTotal}>{formatAmount(totalClaimed)}</Text>

          <View style={styles.summaryRow}>
            {(['Draft', 'Approved', 'Rejected'] as const).map(status => (
              <View key={status} style={styles.summaryStat}>
                <View style={styles.summaryStatHeader}>
                  <Text style={styles.summaryStatLabel}>{STATUS_LABELS[status]}</Text>
                  <Ionicons
                    name={status === 'Draft' ? 'alert-circle-outline' : status === 'Approved' ? 'checkmark-circle-outline' : 'close-circle-outline'}
                    size={14}
                    color={STATUS_COLORS[status]}
                  />
                </View>
                <Text style={styles.summaryStatValue}>{formatAmount(sumBy(status))}</Text>
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.claimBtn} onPress={() => setIsClaimFormVisible(true)}>
          <Ionicons name="add-circle-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
          <Text style={styles.claimBtnText}>Claim an Expense</Text>
        </TouchableOpacity>

        {/* Recent Expenses */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent Expenses</Text>
          {claims.length > RECENT_LIMIT && (
            <TouchableOpacity onPress={() => setShowAllClaims(prev => !prev)}>
              <Text style={styles.linkText}>{showAllClaims ? 'Show Less' : 'View All'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading && claims.length === 0 ? (
          <ActivityIndicator color="#10b981" style={{ marginVertical: 20 }} />
        ) : claims.length === 0 ? (
          <Text style={styles.emptyText}>You have no requests</Text>
        ) : (
          visibleClaims.map(claim => {
            const color = STATUS_COLORS[claim.approvalStatus] || '#94a3b8';
            return (
              <View key={claim.id} style={styles.claimCard}>
                <View style={styles.claimHeader}>
                  <Text style={styles.claimId}>{claim.id}</Text>
                  <View style={[styles.statusBadge, { borderColor: color, backgroundColor: `${color}1a` }]}>
                    <Text style={[styles.statusText, { color }]}>{STATUS_LABELS[claim.approvalStatus] || claim.approvalStatus}</Text>
                  </View>
                </View>
                {claim.remark ? <Text style={styles.claimRemark} numberOfLines={2}>{claim.remark}</Text> : null}
                <View style={styles.claimFooter}>
                  <View style={styles.dateRow}>
                    <Ionicons name="calendar-outline" size={12} color="#64748b" />
                    <Text style={styles.dateText}>{formatDisplayDate(claim.postingDate)}</Text>
                  </View>
                  <Text style={styles.claimAmount}>{formatAmount(claim.totalClaimedAmount)}</Text>
                </View>
              </View>
            );
          })
        )}

        {/* Employee Advance Balance */}
        <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Employee Advance Balance</Text>
        {advances.length === 0 ? (
          <Text style={styles.emptyText}>You have no advances</Text>
        ) : (
          advances.map(advance => (
            <View key={advance.id} style={styles.claimCard}>
              <View style={styles.claimHeader}>
                <Text style={styles.claimId}>{advance.id}</Text>
                <Text style={styles.claimAmount}>{formatAmount(advance.balanceAmount)}</Text>
              </View>
              {advance.purpose ? <Text style={styles.claimRemark} numberOfLines={2}>{advance.purpose}</Text> : null}
              <View style={styles.claimFooter}>
                <View style={styles.dateRow}>
                  <Ionicons name="calendar-outline" size={12} color="#64748b" />
                  <Text style={styles.dateText}>{formatDisplayDate(advance.postingDate)}</Text>
                </View>
                <Text style={styles.dateText}>Paid {formatAmount(advance.paidAmount)}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <ExpenseClaimForm
        visible={isClaimFormVisible}
        currentUser={currentUser}
        expenseTypes={expenseTypes}
        onClose={() => setIsClaimFormVisible(false)}
        onCreated={handleClaimCreated}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: '#05080e',
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 10,
  },
  linkText: {
    color: '#10b981',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#090d16',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
  },
  summaryLabel: {
    fontSize: 12.5,
    color: '#94a3b8',
  },
  summaryTotal: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 4,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryStat: {
    flex: 1,
    backgroundColor: '#05080e',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
    padding: 10,
  },
  summaryStatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  summaryStatLabel: {
    fontSize: 10.5,
    color: '#64748b',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  summaryStatValue: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#f8fafc',
  },
  claimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 13,
    borderRadius: 10,
    marginBottom: 20,
  },
  claimBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 18,
  },
  claimCard: {
    backgroundColor: '#090d16',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  claimHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  claimId: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  claimRemark: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 8,
  },
  claimFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingTop: 8,
    marginTop: 2,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    color: '#64748b',
    fontSize: 12,
  },
  claimAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#10b981',
  },
});
