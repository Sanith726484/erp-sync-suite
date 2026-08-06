import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ErpClientManager, Customer, Product, OrderItem, Order } from '../../api';

interface OrderBookingScreenProps {
  currentUser?: string;
}

const getDefaultDeliveryDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
};

const DEFAULT_STATE_OPTIONS = ['Telangana', 'Andhra Pradesh', 'Karnataka', 'Maharashtra', 'Tamil Nadu', 'Delhi'];
const DEFAULT_BRANCH_OPTIONS = ['Head Office', 'Hyderabad Branch', 'Bengaluru Branch', 'Chennai Branch', 'Mumbai Branch'];
const LOAN_OPTIONS = ['No', 'Yes', 'In Progress'];
const PROPERTY_OPTIONS = ['Residential', 'Commercial', 'Industrial', 'Agricultural'];

export const OrderBookingScreen: React.FC<OrderBookingScreenProps> = ({ currentUser }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  
  // Dynamic Branch & State Options
  const [stateOptions, setStateOptions] = useState<string[]>(DEFAULT_STATE_OPTIONS);
  const [branchOptions, setBranchOptions] = useState<string[]>(DEFAULT_BRANCH_OPTIONS);

  // Sales Order Form States (Matching Mitra App Schema)
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
  const [deliveryDate, setDeliveryDate] = useState(getDefaultDeliveryDate());
  const [branch, setBranch] = useState('Head Office');
  const [stateTerritory, setStateTerritory] = useState('Telangana');
  const [loanApproved, setLoanApproved] = useState('No');
  const [typeOfProperty, setTypeOfProperty] = useState('Residential');
  const [orderNotes, setOrderNotes] = useState('');

  // Item Search & Select States
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [inputQty, setInputQty] = useState<string>('1');
  const [inputRate, setInputRate] = useState<string>('0');

  const loadOrders = async () => {
    try {
      const client = ErpClientManager.getClient();
      const list = await client.getOrders(currentUser);
      setOrders(list);
    } catch (err) {
      console.error('Failed to fetch sales orders:', err);
    }
  };

  const loadCatalogData = async () => {
    setLoading(true);
    try {
      const client = ErpClientManager.getClient();
      const [custList, prodList, branches, states] = await Promise.all([
        client.getCustomers(),
        client.getProducts(),
        client.getBranches ? client.getBranches() : Promise.resolve(DEFAULT_BRANCH_OPTIONS),
        client.getStates ? client.getStates() : Promise.resolve(DEFAULT_STATE_OPTIONS),
      ]);
      setCustomers(custList);
      setProducts(prodList);
      if (branches && branches.length > 0) {
        setBranchOptions(branches);
        setBranch(branches[0]);
      }
      if (states && states.length > 0) {
        setStateOptions(states);
        setStateTerritory(states[0]);
      }
      if (custList.length > 0) {
        setSelectedCustomerId(custList[0].id);
      }
    } catch (err) {
      console.error('Failed to load catalog data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    loadCatalogData();
  }, [currentUser]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadOrders(), loadCatalogData()]);
    setRefreshing(false);
  };

  const handleSelectProductFromSearch = (product: Product) => {
    setSelectedProduct(product);
    const existingQty = cart[product.id] || 1;
    setInputQty(existingQty.toString());
    setInputRate(product.rate.toString());
    setProductSearchQuery('');
  };

  const handleAddProductToOrder = () => {
    if (!selectedProduct) return;
    const qty = parseFloat(inputQty) || 0;
    if (qty <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid item quantity greater than 0.');
      return;
    }

    setCart(prev => ({
      ...prev,
      [selectedProduct.id]: qty,
    }));

    setSelectedProduct(null);
    setInputQty('1');
    setInputRate('0');
  };

  const handleRemoveCartItem = (itemCode: string) => {
    setCart(prev => {
      const copy = { ...prev };
      delete copy[itemCode];
      return copy;
    });
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart(prev => {
      const current = prev[productId] || 0;
      const next = current + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: next };
    });
  };

  const getCartItems = (): OrderItem[] => {
    const items: OrderItem[] = [];
    products.forEach(p => {
      const qty = cart[p.id];
      if (qty > 0) {
        items.push({
          itemCode: p.id,
          itemName: p.name,
          qty,
          rate: p.rate,
          amount: qty * p.rate,
        });
      }
    });
    return items;
  };

  const calculateGrandTotal = (): number => {
    return getCartItems().reduce((sum, item) => sum + item.amount, 0);
  };

  const handleBookOrder = async (targetDocstatus: 0 | 1 = 0) => {
    if (!selectedCustomerId) {
      Alert.alert('Validation Error', 'Please select a Customer Partner.');
      return;
    }
    if (!stateTerritory.trim()) {
      Alert.alert('Validation Error', 'Please select a State / Territory.');
      return;
    }
    if (!branch.trim()) {
      Alert.alert('Validation Error', 'Please select a Branch Office.');
      return;
    }
    if (!deliveryDate.trim()) {
      Alert.alert('Validation Error', 'Please specify an Expected Delivery Date.');
      return;
    }
    const cartItems = getCartItems();
    if (cartItems.length === 0) {
      Alert.alert('Cart Empty', 'Please search and add at least one line item to your order.');
      return;
    }

    setLoading(true);
    try {
      const client = ErpClientManager.getClient();
      
      const newOrder = await client.createOrder({
        customer: selectedCustomerId,
        transactionDate: transactionDate || new Date().toISOString().slice(0, 10),
        deliveryDate: deliveryDate,
        branch: branch,
        state: stateTerritory,
        loanApproved: loanApproved,
        typeOfProperty: typeOfProperty,
        notes: orderNotes,
        items: cartItems,
        grandTotal: calculateGrandTotal(),
        docstatus: targetDocstatus,
      });

      setCart({});
      setOrderNotes('');
      setIsCreateModalVisible(false);
      const actionText = targetDocstatus === 1 ? 'submitted' : 'saved as Draft';
      Alert.alert('Order Processed', `Sales Order ${newOrder.id} has been ${actionText} successfully!`);
      loadOrders();
    } catch (err: any) {
      Alert.alert('Booking Failed', err.message || 'Unable to sync order with ERPNext.');
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(o => 
    (o.id || '').toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
    (o.customerName || o.customer || '').toLowerCase().includes(orderSearchQuery.toLowerCase())
  );

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
    c.id.toLowerCase().includes(customerSearchQuery.toLowerCase())
  );

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
    p.id.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(productSearchQuery.toLowerCase())
  );

  const getStatusColor = (status?: string) => {
    switch ((status || '').toLowerCase()) {
      case 'completed':
      case 'to bill':
        return '#10b981';
      case 'to deliver and bill':
      case 'submitted':
        return '#3b82f6';
      case 'draft':
        return '#f59e0b';
      case 'cancelled':
        return '#ef4444';
      default:
        return '#64748b';
    }
  };

  return (
    <View style={styles.screenWrapper}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Sales Orders</Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh}>
            <Ionicons name="refresh-outline" size={20} color="#10b981" />
          </TouchableOpacity>
        </View>

        {/* Order Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Search orders by ID or customer..."
            placeholderTextColor="#5a6880"
            value={orderSearchQuery}
            onChangeText={setOrderSearchQuery}
            style={styles.searchInput}
          />
        </View>

        {/* Sales Orders List */}
        {refreshing ? (
          <ActivityIndicator color="#10b981" style={{ marginTop: 30 }} />
        ) : filteredOrders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={48} color="#334155" />
            <Text style={styles.emptyTitle}>No Sales Orders Found</Text>
            <Text style={styles.emptySubtitle}>Tap the '+' button to book a new Sales Order</Text>
          </View>
        ) : (
          filteredOrders.map((order) => (
            <View key={order.id || Math.random().toString()} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <Text style={styles.orderId}>{order.id}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) + '22', borderColor: getStatusColor(order.status) + '55' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>{order.status || 'Draft'}</Text>
                </View>
              </View>

              <Text style={styles.customerName}>{order.customerName || order.customer}</Text>

              <View style={styles.orderFooter}>
                <View style={styles.dateRow}>
                  <Ionicons name="calendar-outline" size={14} color="#64748b" />
                  <Text style={styles.dateText}>{order.transactionDate}</Text>
                </View>
                <Text style={styles.grandTotalText}>
                  {order.currency || 'INR'} {order.grandTotal.toLocaleString()}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Floating Action Button '+' */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => setIsCreateModalVisible(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={30} color="#ffffff" />
      </TouchableOpacity>

      {/* New Sales Order Modal */}
      <Modal
        visible={isCreateModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsCreateModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Sales Order</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setIsCreateModalVisible(false)}>
              <Ionicons name="close" size={24} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody}>
            {/* Form Guidance */}
            <Text style={styles.formGuideText}>
              Fill out mandatory Customer, Territory, Branch and Delivery Date fields to book order in ERPNext.
            </Text>

            {/* 1. Customer Selection (Search-Only) */}
            <View style={styles.formCard}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>Customer Partner</Text>
                <Text style={styles.requiredStar}>*</Text>
              </View>

              {selectedCustomer ? (
                <View style={styles.selectedProductBox}>
                  <View style={styles.selectedProductHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.selectedProductName}>{selectedCustomer.name}</Text>
                      <Text style={styles.inputLabel}>ID: {selectedCustomer.id}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setSelectedCustomerId('')}>
                      <Ionicons name="close-circle" size={20} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View>
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
            </View>

            {/* 2. Territory / State (Required) */}
            <View style={styles.formCard}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>State / Territory</Text>
                <Text style={styles.requiredStar}>*</Text>
              </View>
              <View style={styles.pillGrid}>
                {stateOptions.map((st) => (
                  <TouchableOpacity
                    key={st}
                    style={[styles.pillOption, stateTerritory === st && styles.pillOptionActive]}
                    onPress={() => setStateTerritory(st)}
                  >
                    <Text style={[styles.pillOptionText, stateTerritory === st && styles.pillOptionTextActive]}>{st}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 3. Branch Office (Required) */}
            <View style={styles.formCard}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>Branch Office</Text>
                <Text style={styles.requiredStar}>*</Text>
              </View>
              <View style={styles.pillGrid}>
                {branchOptions.map((br) => (
                  <TouchableOpacity
                    key={br}
                    style={[styles.pillOption, branch === br && styles.pillOptionActive]}
                    onPress={() => setBranch(br)}
                  >
                    <Text style={[styles.pillOptionText, branch === br && styles.pillOptionTextActive]}>{br}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 4. Dates Selection (Required) */}
            <View style={styles.formCard}>
              <View style={styles.datesGrid}>
                <View style={{ flex: 1 }}>
                  <View style={styles.labelRow}>
                    <Text style={styles.fieldLabel}>Posting Date</Text>
                    <Text style={styles.requiredStar}>*</Text>
                  </View>
                  <TextInput
                    value={transactionDate}
                    onChangeText={setTransactionDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#5a6880"
                    style={styles.input}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.labelRow}>
                    <Text style={styles.fieldLabel}>Delivery Date</Text>
                    <Text style={styles.requiredStar}>*</Text>
                  </View>
                  <TextInput
                    value={deliveryDate}
                    onChangeText={setDeliveryDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#5a6880"
                    style={styles.input}
                  />
                </View>
              </View>
            </View>

            {/* 5. Loan Approved */}
            <View style={styles.formCard}>
              <Text style={styles.fieldLabel}>Loan Approved</Text>
              <View style={styles.pillGrid}>
                {LOAN_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.pillOption, loanApproved === opt && styles.pillOptionActive]}
                    onPress={() => setLoanApproved(opt)}
                  >
                    <Text style={[styles.pillOptionText, loanApproved === opt && styles.pillOptionTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 6. Type of Property */}
            <View style={styles.formCard}>
              <Text style={styles.fieldLabel}>Type of Property</Text>
              <View style={styles.pillGrid}>
                {PROPERTY_OPTIONS.map((prop) => (
                  <TouchableOpacity
                    key={prop}
                    style={[styles.pillOption, typeOfProperty === prop && styles.pillOptionActive]}
                    onPress={() => setTypeOfProperty(prop)}
                  >
                    <Text style={[styles.pillOptionText, typeOfProperty === prop && styles.pillOptionTextActive]}>{prop}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 7. Search & Add Items (Required) */}
            <View style={styles.formCard}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>Search & Add Line Items</Text>
                <Text style={styles.requiredStar}>*</Text>
              </View>
              
              <View style={styles.searchBoxWrapper}>
                <Ionicons name="search-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="Type item name or code..."
                  placeholderTextColor="#5a6880"
                  value={productSearchQuery}
                  onChangeText={setProductSearchQuery}
                  style={styles.searchBarInput}
                />
                {productSearchQuery ? (
                  <TouchableOpacity onPress={() => setProductSearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color="#64748b" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Search Results Dropdown List */}
              {productSearchQuery.trim().length > 0 && (
                <View style={styles.searchResultsDropdown}>
                  {filteredProducts.length === 0 ? (
                    <Text style={styles.noResultsText}>No items found matching '{productSearchQuery}'</Text>
                  ) : (
                    filteredProducts.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        style={styles.searchResultRow}
                        onPress={() => handleSelectProductFromSearch(p)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.searchResultName}>{p.name}</Text>
                          {p.description && <Text style={styles.searchResultDesc}>{p.description}</Text>}
                        </View>
                        <Text style={styles.searchResultPrice}>₹ {p.rate.toLocaleString()}</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}

              {/* Active Selected Product Adding Panel */}
              {selectedProduct && (
                <View style={styles.selectedProductBox}>
                  <View style={styles.selectedProductHeader}>
                    <Text style={styles.selectedProductName}>{selectedProduct.name}</Text>
                    <TouchableOpacity onPress={() => setSelectedProduct(null)}>
                      <Ionicons name="close" size={18} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.qtyRateRow}>
                    <View style={styles.inputCol}>
                      <Text style={styles.inputLabel}>Quantity</Text>
                      <TextInput
                        value={inputQty}
                        onChangeText={setInputQty}
                        keyboardType="numeric"
                        style={styles.numInput}
                      />
                    </View>

                    <View style={styles.inputCol}>
                      <Text style={styles.inputLabel}>Unit Rate (₹)</Text>
                      <TextInput
                        value={inputRate}
                        onChangeText={setInputRate}
                        keyboardType="numeric"
                        style={styles.numInput}
                      />
                    </View>
                  </View>

                  <TouchableOpacity style={styles.addItemBtn} onPress={handleAddProductToOrder}>
                    <Ionicons name="add-circle-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.addItemBtnText}>Add Item to Order</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* 8. Remarks / Notes */}
            <View style={styles.formCard}>
              <Text style={styles.fieldLabel}>Order Remarks & Notes</Text>
              <TextInput
                value={orderNotes}
                onChangeText={setOrderNotes}
                placeholder="Enter additional requirements or site remarks..."
                placeholderTextColor="#5a6880"
                style={styles.textarea}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* 9. Selected Line Items List & Order Summary */}
            {getCartItems().length > 0 && (
              <View style={styles.formCard}>
                <Text style={styles.fieldLabel}>Selected Line Items ({getCartItems().length})</Text>

                {getCartItems().map((item) => (
                  <View key={item.itemCode} style={styles.cartItemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cartItemName}>{item.itemName}</Text>
                      <Text style={styles.cartItemMeta}>
                        ₹ {item.rate.toLocaleString()} x {item.qty} = ₹ {item.amount.toLocaleString()}
                      </Text>
                    </View>

                    <View style={styles.quantityControl}>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => updateCartQty(item.itemCode, -1)}>
                        <Text style={styles.qtyBtnText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{item.qty}</Text>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => updateCartQty(item.itemCode, 1)}>
                        <Text style={styles.qtyBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity 
                      style={styles.deleteItemBtn} 
                      onPress={() => handleRemoveCartItem(item.itemCode)}
                    >
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}

                <View style={styles.totalDivider} />

                <View style={styles.grandTotalRow}>
                  <Text style={styles.grandTotalLabel}>Grand Total:</Text>
                  <Text style={styles.grandTotalValue}>₹ {calculateGrandTotal().toLocaleString()}</Text>
                </View>

                {/* Save Draft & Submit Buttons */}
                <View style={styles.actionButtonsRow}>
                  <TouchableOpacity 
                    style={styles.draftBtn} 
                    onPress={() => handleBookOrder(0)} 
                    disabled={loading}
                  >
                    <Ionicons name="document-text-outline" size={18} color="#94a3b8" style={{ marginRight: 6 }} />
                    <Text style={styles.draftBtnText}>Save as Draft</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.submitBtn} 
                    onPress={() => handleBookOrder(1)} 
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="checkmark-circle" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                        <Text style={styles.submitBtnText}>Submit Order</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
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
    paddingBottom: 90,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  refreshBtn: {
    padding: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#090d16',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  orderCard: {
    backgroundColor: '#090d16',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderId: {
    fontSize: 15,
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
  customerName: {
    fontSize: 13.5,
    color: '#94a3b8',
    marginBottom: 12,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingTop: 10,
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
  grandTotalText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#10b981',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
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
  },
  modalBody: {
    padding: 16,
  },
  formGuideText: {
    fontSize: 12.5,
    color: '#64748b',
    marginBottom: 14,
    lineHeight: 18,
  },
  formCard: {
    backgroundColor: '#090d16',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10b981',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  requiredStar: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '800',
  },
  selectWrapper: {
    maxHeight: 140,
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
  pillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pillOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: '#05080e',
  },
  pillOptionActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10b981',
  },
  pillOptionText: {
    color: '#64748b',
    fontSize: 12.5,
    fontWeight: '600',
  },
  pillOptionTextActive: {
    color: '#10b981',
    fontWeight: '700',
  },
  datesGrid: {
    flexDirection: 'row',
    gap: 12,
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
    textAlignVertical: 'top',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  searchResultName: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13.5,
  },
  searchResultDesc: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  searchResultPrice: {
    color: '#10b981',
    fontWeight: '700',
    fontSize: 13,
  },
  noResultsText: {
    color: '#64748b',
    padding: 14,
    textAlign: 'center',
    fontSize: 12,
  },
  selectedProductBox: {
    marginTop: 12,
    backgroundColor: '#05080e',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 10,
    padding: 12,
  },
  selectedProductHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  selectedProductName: {
    color: '#10b981',
    fontWeight: '800',
    fontSize: 14,
  },
  qtyRateRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  inputCol: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 4,
    fontWeight: '600',
  },
  numInput: {
    backgroundColor: '#090d16',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingVertical: 10,
  },
  addItemBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13.5,
  },
  cartItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  cartItemName: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13.5,
  },
  cartItemMeta: {
    color: '#10b981',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  deleteItemBtn: {
    padding: 8,
    marginLeft: 6,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
    backgroundColor: '#05080e',
    overflow: 'hidden',
  },
  qtyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  qtyBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  qtyText: {
    paddingHorizontal: 8,
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13.5,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  summaryPrice: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  totalDivider: {
    height: 1,
    backgroundColor: '#1e293b',
    marginVertical: 12,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#10b981',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  draftBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#05080e',
  },
  draftBtnText: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 13.5,
  },
  submitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 8,
    backgroundColor: '#10b981',
  },
  submitBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13.5,
  },
});
