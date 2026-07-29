import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { ErpClientManager, Customer, Product, OrderItem } from 'api';

export const OrderBookingScreen: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({}); // item_code -> qty
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const client = ErpClientManager.getClient();
      const [custList, prodList] = await Promise.all([
        client.getCustomers(),
        client.getProducts(),
      ]);
      setCustomers(custList);
      setProducts(prodList);
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
    loadData();
  }, []);

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

  const handleBookOrder = async () => {
    if (!selectedCustomerId) {
      Alert.alert('Validation Error', 'Please select a customer for booking.');
      return;
    }
    const cartItems = getCartItems();
    if (cartItems.length === 0) {
      Alert.alert('Cart Empty', 'Please add items to your cart.');
      return;
    }

    setLoading(true);
    try {
      const client = ErpClientManager.getClient();
      const todayStr = new Date().toISOString().slice(0, 10);
      
      const order = await client.createOrder({
        customer: selectedCustomerId,
        transactionDate: todayStr,
        items: cartItems,
        grandTotal: calculateGrandTotal(),
      });

      setCart({});
      Alert.alert('Order Booked', `Sales Order ${order.id} was created successfully!`);
    } catch (err: any) {
      Alert.alert('Booking Failed', err.message || 'Unable to sync order with ERPNext.');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Book Sales Order</Text>

      {/* Select Customer */}
      <View style={styles.card}>
        <Text style={styles.label}>1. Select Customer Partner</Text>
        {loading && customers.length === 0 ? (
          <ActivityIndicator color="#10b981" />
        ) : (
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
        )}
      </View>

      {/* Catalog Search & List */}
      <View style={styles.card}>
        <Text style={styles.label}>2. Product Catalog</Text>
        <TextInput
          placeholder="Search items by keyword..."
          placeholderTextColor="#5a6880"
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchBar}
        />

        {filteredProducts.length === 0 ? (
          <Text style={styles.noResults}>No products found matching query</Text>
        ) : (
          filteredProducts.map((p) => {
            const qty = cart[p.id] || 0;
            return (
              <View key={p.id} style={styles.productRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.productName}>{p.name}</Text>
                  {p.description && <Text style={styles.productDesc}>{p.description}</Text>}
                  <Text style={styles.productPrice}>${p.rate.toFixed(2)}</Text>
                </View>
                
                {/* Quantity Controls */}
                <View style={styles.quantityControl}>
                  <TouchableOpacity style={styles.qtyBtn} onClick={() => updateCartQty(p.id, -1)}>
                    <Text style={styles.qtyBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{qty}</Text>
                  <TouchableOpacity style={styles.qtyBtn} onClick={() => updateCartQty(p.id, 1)}>
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Checkout Summary Card */}
      {calculateGrandTotal() > 0 && (
        <View style={styles.card}>
          <Text style={styles.label}>3. Booking Summary</Text>
          
          {getCartItems().map((item) => (
            <View key={item.itemCode} style={styles.summaryRow}>
              <Text style={styles.summaryText}>{item.itemName} (x{item.qty})</Text>
              <Text style={styles.summaryPrice}>${item.amount.toFixed(2)}</Text>
            </View>
          ))}

          <View style={styles.totalDivider} />
          
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Grand Total:</Text>
            <Text style={styles.grandTotalValue}>${calculateGrandTotal().toFixed(2)}</Text>
          </View>

          <TouchableOpacity style={styles.bookBtn} onClick={handleBookOrder} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.bookBtnText}>Confirm & Book Sales Order</Text>
            )}
          </TouchableOpacity>
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
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#65778a',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  selectWrapper: {
    maxHeight: 120,
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
  searchBar: {
    backgroundColor: '#05080e',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
    padding: 10,
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 16,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  productDesc: {
    fontSize: 11,
    color: '#65778a',
    marginTop: 2,
  },
  productPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10b981',
    marginTop: 4,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  qtyBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  qtyText: {
    paddingHorizontal: 12,
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  noResults: {
    color: '#65778a',
    textAlign: 'center',
    fontSize: 13,
    paddingVertical: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryText: {
    color: '#65778a',
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
  bookBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  bookBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});
