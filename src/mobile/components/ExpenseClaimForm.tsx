import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ErpClientManager, ExpenseClaim, ExpenseClaimItem, ExpenseClaimDefaults } from '../../api';

interface ExpenseClaimFormProps {
  visible: boolean;
  currentUser: string;
  expenseTypes: string[];
  onClose: () => void;
  onCreated: (claim: ExpenseClaim) => void;
}

// Local calendar date (toISOString would shift to UTC and can land on the previous day)
const toLocalISO = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const shiftISO = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  // Expenses cannot be claimed for a future date
  return d > new Date() ? iso : toLocalISO(d);
};

const formatDisplayDate = (iso: string, withYear = true): string => {
  const parsed = new Date(`${iso}T00:00:00`);
  if (isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString('en-GB', withYear
    ? { day: 'numeric', month: 'short', year: 'numeric' }
    : { day: 'numeric', month: 'short' });
};

interface ItemDraft {
  expenseType: string;
  expenseDate: string;
  amount: string;
  sanctionedAmount: string;
  description: string;
}

const emptyItem = (): ItemDraft => ({
  expenseType: '',
  expenseDate: toLocalISO(new Date()),
  amount: '',
  sanctionedAmount: '',
  description: '',
});

const DateStepper: React.FC<{ value: string; onChange: (iso: string) => void }> = ({ value, onChange }) => (
  <View style={styles.dateNavRow}>
    <TouchableOpacity onPress={() => onChange(shiftISO(value, -1))} style={styles.dateNavBtn}>
      <Ionicons name="chevron-back" size={16} color="#94a3b8" />
    </TouchableOpacity>
    <View style={styles.datePillDisplay}>
      <Ionicons name="calendar-outline" size={14} color="#10b981" style={{ marginRight: 6 }} />
      <Text style={styles.selectText}>{formatDisplayDate(value)}</Text>
    </View>
    <TouchableOpacity onPress={() => onChange(shiftISO(value, 1))} style={styles.dateNavBtn}>
      <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
    </TouchableOpacity>
  </View>
);

const ReadOnlyField: React.FC<{ label: string; value?: string }> = ({ label, value }) => (
  <>
    <Text style={styles.inputLabel}>{label}</Text>
    <View style={[styles.textInput, styles.readOnlyInput]}>
      <Text style={value ? styles.readOnlyText : styles.placeholderText}>{value || 'Not set'}</Text>
    </View>
  </>
);

export const ExpenseClaimForm: React.FC<ExpenseClaimFormProps> = ({ visible, currentUser, expenseTypes, onClose, onCreated }) => {
  const [tab, setTab] = useState<'expenses' | 'totals'>('expenses');
  const [defaults, setDefaults] = useState<ExpenseClaimDefaults | null>(null);
  const [defaultsError, setDefaultsError] = useState<string | null>(null);
  const [loadingDefaults, setLoadingDefaults] = useState(false);

  const [postingDate, setPostingDate] = useState(() => toLocalISO(new Date()));
  const [expenseApprover, setExpenseApprover] = useState('');
  const [isApproverPickerOpen, setIsApproverPickerOpen] = useState(false);
  const [expenses, setExpenses] = useState<ExpenseClaimItem[]>([]);
  const [saving, setSaving] = useState(false);

  // Expense item sheet states
  const [isItemSheetOpen, setIsItemSheetOpen] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [itemDraft, setItemDraft] = useState<ItemDraft>(emptyItem);
  const [isTypePickerOpen, setIsTypePickerOpen] = useState(false);

  const currency = defaults?.currency || 'INR';
  const formatAmount = (value: number): string =>
    `${currency} ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const loadDefaults = async () => {
    setLoadingDefaults(true);
    setDefaultsError(null);
    try {
      const client = ErpClientManager.getClient();
      const data = await client.getExpenseClaimDefaults(currentUser, postingDate);
      setDefaults(data);
      setExpenseApprover(data.expenseApprover || '');
    } catch (err: any) {
      setDefaultsError(err.message || 'Unable to load expense claim details.');
    } finally {
      setLoadingDefaults(false);
    }
  };

  useEffect(() => {
    if (visible) {
      void loadDefaults();
    } else {
      // Start every new claim from a clean form
      setTab('expenses');
      setPostingDate(toLocalISO(new Date()));
      setExpenses([]);
      setIsApproverPickerOpen(false);
    }
  }, [visible, currentUser]);

  const totalClaimed = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalSanctioned = expenses.reduce((sum, e) => sum + (e.sanctionedAmount ?? e.amount), 0);

  const openItemSheet = (idx: number | null) => {
    if (idx === null) {
      setItemDraft(emptyItem());
    } else {
      const item = expenses[idx];
      setItemDraft({
        expenseType: item.expenseType,
        expenseDate: item.expenseDate,
        amount: String(item.amount),
        sanctionedAmount: String(item.sanctionedAmount ?? item.amount),
        description: item.description || '',
      });
    }
    setEditingIdx(idx);
    setIsTypePickerOpen(false);
    setIsItemSheetOpen(true);
  };

  const parsedItemAmount = parseFloat(itemDraft.amount);
  const parsedSanctioned = itemDraft.sanctionedAmount === '' ? parsedItemAmount : parseFloat(itemDraft.sanctionedAmount);
  const isItemValid = !!itemDraft.expenseType && parsedItemAmount > 0 && parsedSanctioned >= 0;

  const saveItem = () => {
    if (!isItemValid) return;
    if (parsedSanctioned > parsedItemAmount) {
      Alert.alert('Invalid Amount', 'Sanctioned amount cannot be greater than the claimed amount.');
      return;
    }
    const item: ExpenseClaimItem = {
      expenseType: itemDraft.expenseType,
      expenseDate: itemDraft.expenseDate,
      amount: parsedItemAmount,
      sanctionedAmount: parsedSanctioned,
      description: itemDraft.description.trim() || undefined,
    };
    setExpenses(prev => (editingIdx === null ? [...prev, item] : prev.map((e, i) => (i === editingIdx ? item : e))));
    setIsItemSheetOpen(false);
  };

  const deleteItem = () => {
    if (editingIdx === null) return;
    setExpenses(prev => prev.filter((_, i) => i !== editingIdx));
    setIsItemSheetOpen(false);
  };

  const handleSave = async () => {
    if (expenses.length === 0) {
      Alert.alert('Missing Details', 'Add at least one expense.');
      return;
    }
    if (defaults?.approverMandatory && !expenseApprover) {
      Alert.alert('Missing Details', 'Please select an expense approver.');
      return;
    }

    setSaving(true);
    try {
      const client = ErpClientManager.getClient();
      const created = await client.createExpenseClaim({
        postingDate,
        expenseApprover: expenseApprover || undefined,
        currency: defaults?.currency,
        exchangeRate: defaults?.exchangeRate,
        costCenter: defaults?.costCenter,
        payableAccount: defaults?.payableAccount,
        expenses,
      }, currentUser);
      onCreated(created);
    } catch (err: any) {
      Alert.alert('Claim Failed', err.message || 'Unable to create the expense claim.');
    } finally {
      setSaving(false);
    }
  };

  const approverLabel = (id: string) => {
    const match = defaults?.approvers.find(a => a.id === id);
    return match?.fullName ? `${match.fullName} (${id})` : id;
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>New Expense Claim</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={22} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        <View style={styles.tabRow}>
          {(['expenses', 'totals'] as const).map(t => (
            <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
              <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
                {t === 'expenses' ? 'Expenses' : 'Totals'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loadingDefaults ? (
          <ActivityIndicator color="#10b981" style={{ marginTop: 40 }} />
        ) : defaultsError ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={28} color="#ef4444" />
            <Text style={styles.errorText}>{defaultsError}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadDefaults}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            {tab === 'expenses' ? (
              <>
                <Text style={styles.inputLabel}>
                  Expense Approver{defaults?.approverMandatory ? ' *' : ''}
                </Text>
                <TouchableOpacity style={styles.selectInput} onPress={() => setIsApproverPickerOpen(prev => !prev)}>
                  <Text style={expenseApprover ? styles.selectText : styles.placeholderText} numberOfLines={1}>
                    {expenseApprover ? approverLabel(expenseApprover) : 'Select expense approver'}
                  </Text>
                  <Ionicons name={isApproverPickerOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#94a3b8" />
                </TouchableOpacity>
                {isApproverPickerOpen && (
                  <View style={styles.pickerList}>
                    {!defaults || defaults.approvers.length === 0 ? (
                      <Text style={styles.pickerEmpty}>No expense approvers set for your department.</Text>
                    ) : (
                      defaults.approvers.map(a => (
                        <TouchableOpacity
                          key={a.id}
                          style={[styles.pickerItem, a.id === expenseApprover && styles.pickerItemActive]}
                          onPress={() => { setExpenseApprover(a.id); setIsApproverPickerOpen(false); }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.pickerItemText, a.id === expenseApprover && { color: '#10b981' }]}>
                              {a.fullName || a.id}
                            </Text>
                            {a.fullName ? <Text style={styles.pickerItemSub}>{a.id}</Text> : null}
                          </View>
                          {a.id === expenseApprover && <Ionicons name="checkmark" size={16} color="#10b981" />}
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                )}

                <Text style={styles.inputLabel}>Posting Date *</Text>
                <DateStepper value={postingDate} onChange={setPostingDate} />

                {/* Expenses child table */}
                <View style={styles.expensesHeader}>
                  <Text style={styles.sectionTitle}>Expenses</Text>
                  <View style={styles.expensesHeaderRight}>
                    <Text style={styles.sectionTotal}>{formatAmount(totalClaimed)}</Text>
                    <TouchableOpacity style={styles.addBtn} onPress={() => openItemSheet(null)}>
                      <Ionicons name="add" size={18} color="#10b981" />
                    </TouchableOpacity>
                  </View>
                </View>

                {expenses.length === 0 ? (
                  <TouchableOpacity style={styles.emptyTable} onPress={() => openItemSheet(null)}>
                    <Text style={styles.emptyTableText}>No expenses added</Text>
                    <Text style={styles.emptyTableHint}>Tap + to add an expense</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.table}>
                    {expenses.map((item, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[styles.tableRow, idx === expenses.length - 1 && { borderBottomWidth: 0 }]}
                        onPress={() => openItemSheet(idx)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.tableRowTitle}>{item.expenseType}</Text>
                          <Text style={styles.tableRowSub}>
                            Sanctioned: {formatAmount(item.sanctionedAmount ?? item.amount)} · {formatDisplayDate(item.expenseDate, false)}
                          </Text>
                        </View>
                        <Text style={styles.tableRowAmount}>{formatAmount(item.amount)}</Text>
                        <Ionicons name="chevron-forward" size={18} color="#64748b" />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <>
                <ReadOnlyField label="Total Claimed Amount" value={formatAmount(totalClaimed)} />
                <ReadOnlyField label="Total Sanctioned Amount" value={formatAmount(totalSanctioned)} />
                <ReadOnlyField label="Grand Total" value={formatAmount(totalSanctioned)} />
                <ReadOnlyField label="Currency" value={currency} />
                {defaults && defaults.exchangeRate !== 1 && (
                  <ReadOnlyField label={`Exchange Rate (${currency} → ${defaults.companyCurrency})`} value={String(defaults.exchangeRate)} />
                )}
                <ReadOnlyField label="Company" value={defaults?.company} />
                <ReadOnlyField label="Cost Center" value={defaults?.costCenter} />
                <ReadOnlyField label="Payable Account" value={defaults?.payableAccount} />
                {!defaults?.payableAccount && (
                  <Text style={styles.warningText}>
                    Your company has no Default Expense Claim Payable Account. Ask your accounts team to set it before the claim can be approved.
                  </Text>
                )}
              </>
            )}
          </ScrollView>
        )}

        {!loadingDefaults && !defaultsError && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.saveBtn, (saving || expenses.length === 0) && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving || expenses.length === 0}
            >
              {saving ? <ActivityIndicator color="#ffffff" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Add / edit expense item sheet */}
        <Modal visible={isItemSheetOpen} transparent animationType="slide" onRequestClose={() => setIsItemSheetOpen(false)}>
          <View style={styles.sheetOverlay}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setIsItemSheetOpen(false)} />
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>{editingIdx === null ? 'New Expense' : 'Edit Expense'}</Text>
              <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
                <Text style={styles.inputLabel}>Expense Date *</Text>
                <DateStepper value={itemDraft.expenseDate} onChange={d => setItemDraft(prev => ({ ...prev, expenseDate: d }))} />

                <Text style={styles.inputLabel}>Expense Claim Type *</Text>
                <TouchableOpacity style={styles.selectInput} onPress={() => setIsTypePickerOpen(prev => !prev)}>
                  <Text style={itemDraft.expenseType ? styles.selectText : styles.placeholderText}>
                    {itemDraft.expenseType || 'Select expense type'}
                  </Text>
                  <Ionicons name={isTypePickerOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#94a3b8" />
                </TouchableOpacity>
                {isTypePickerOpen && (
                  <View style={styles.pickerList}>
                    {expenseTypes.length === 0 ? (
                      <Text style={styles.pickerEmpty}>No expense types configured in ERPNext.</Text>
                    ) : (
                      expenseTypes.map(type => (
                        <TouchableOpacity
                          key={type}
                          style={[styles.pickerItem, type === itemDraft.expenseType && styles.pickerItemActive]}
                          onPress={() => { setItemDraft(prev => ({ ...prev, expenseType: type })); setIsTypePickerOpen(false); }}
                        >
                          <Text style={[styles.pickerItemText, type === itemDraft.expenseType && { color: '#10b981' }]}>{type}</Text>
                          {type === itemDraft.expenseType && <Ionicons name="checkmark" size={16} color="#10b981" />}
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                )}

                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={itemDraft.description}
                  onChangeText={text => setItemDraft(prev => ({ ...prev, description: text }))}
                  placeholder="What was this expense for?"
                  placeholderTextColor="#475569"
                  multiline
                />

                <Text style={styles.inputLabel}>Amount *</Text>
                <TextInput
                  style={styles.textInput}
                  value={itemDraft.amount}
                  // Sanctioned amount follows the claimed amount until edited, as in the HRMS form
                  onChangeText={text => setItemDraft(prev => ({
                    ...prev,
                    amount: text,
                    sanctionedAmount: prev.sanctionedAmount === prev.amount ? text : prev.sanctionedAmount,
                  }))}
                  placeholder="0.00"
                  placeholderTextColor="#475569"
                  keyboardType="decimal-pad"
                />

                <Text style={styles.inputLabel}>Sanctioned Amount</Text>
                <TextInput
                  style={styles.textInput}
                  value={itemDraft.sanctionedAmount}
                  onChangeText={text => setItemDraft(prev => ({ ...prev, sanctionedAmount: text }))}
                  placeholder="0.00"
                  placeholderTextColor="#475569"
                  keyboardType="decimal-pad"
                />
              </ScrollView>

              <View style={styles.sheetActions}>
                {editingIdx !== null && (
                  <TouchableOpacity style={styles.deleteBtn} onPress={deleteItem}>
                    <Ionicons name="trash-outline" size={16} color="#ef4444" style={{ marginRight: 4 }} />
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.saveBtn, { flex: 1 }, !isItemValid && styles.saveBtnDisabled]}
                  onPress={saveItem}
                  disabled={!isItemValid}
                >
                  <Text style={styles.saveBtnText}>{editingIdx === null ? 'Add Expense' : 'Update Expense'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#05080e',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#090d16',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#1e293b',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#090d16',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingHorizontal: 12,
  },
  tabBtn: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#10b981',
  },
  tabBtnText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
  tabBtnTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  modalBody: {
    padding: 20,
    paddingBottom: 40,
  },
  errorBox: {
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  errorText: {
    color: '#94a3b8',
    fontSize: 13.5,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 6,
    marginTop: 14,
  },
  selectInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#090d16',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  selectText: {
    color: '#ffffff',
    fontSize: 14,
    flexShrink: 1,
  },
  placeholderText: {
    color: '#475569',
    fontSize: 14,
  },
  pickerList: {
    backgroundColor: '#090d16',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 10,
    marginTop: 6,
    overflow: 'hidden',
  },
  pickerEmpty: {
    color: '#64748b',
    fontSize: 12.5,
    padding: 12,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  pickerItemActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  pickerItemText: {
    color: '#e2e8f0',
    fontSize: 14,
  },
  pickerItemSub: {
    color: '#64748b',
    fontSize: 11.5,
    marginTop: 2,
  },
  dateNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateNavBtn: {
    padding: 11,
    backgroundColor: '#090d16',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 10,
  },
  datePillDisplay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#090d16',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 10,
    paddingVertical: 11,
  },
  expensesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 10,
  },
  expensesHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  sectionTotal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#e2e8f0',
  },
  addBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  emptyTable: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#334155',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 22,
  },
  emptyTableText: {
    color: '#94a3b8',
    fontSize: 13.5,
    fontWeight: '600',
  },
  emptyTableHint: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
  },
  table: {
    backgroundColor: '#090d16',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 10,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  tableRowTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  tableRowSub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
  },
  tableRowAmount: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
  },
  textInput: {
    backgroundColor: '#090d16',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 14,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  readOnlyInput: {
    backgroundColor: '#0b111c',
  },
  readOnlyText: {
    color: '#cbd5e1',
    fontSize: 14,
  },
  warningText: {
    color: '#f59e0b',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    backgroundColor: '#090d16',
  },
  saveBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: '#374151',
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  sheet: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
  },
  sheetTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 10,
    paddingHorizontal: 16,
  },
  deleteBtnText: {
    color: '#ef4444',
    fontWeight: '700',
  },
});
