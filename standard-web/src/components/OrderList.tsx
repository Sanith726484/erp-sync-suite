import React, { useState, useEffect } from 'react';
import { ErpClientManager, Order } from 'standard-api';
import { ShoppingBag, RefreshCw, Calendar, Search } from 'lucide-react';

export const OrderList: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadOrders = async () => {
    setLoading(true);
    try {
      const client = ErpClientManager.getClient();
      const list = await client.getOrders();
      setOrders(list);
    } catch (err) {
      console.error('Failed to load sales orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const filteredOrders = orders.filter(o => {
    const customer = (o.customerName || o.customer || '').toLowerCase();
    const orderId = (o.id || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return customer.includes(query) || orderId.includes(query);
  });

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: '#ffffff' }}>Booked Orders</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>List of sales orders synced directly with your connected ERP</p>
        </div>
        <button onClick={loadOrders} disabled={loading} className="btn-primary">
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          Sync Orders
        </button>
      </div>

      {/* Filter and search */}
      <div className="glass-card" style={{ padding: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by Order ID or Customer Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input"
            style={{ paddingLeft: '44px' }}
          />
        </div>
      </div>

      {/* Main Table Card */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <RefreshCw size={24} className="spin" style={{ color: 'var(--color-primary)', marginBottom: '8px' }} />
            <div style={{ color: 'var(--text-muted)' }}>Retrieving ERP orders...</div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <ShoppingBag size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
            <h4 style={{ color: '#ffffff', fontSize: '18px', marginBottom: '6px' }}>No Orders Found</h4>
            <p style={{ fontSize: '13px' }}>Try resetting search query or book a new sales order from the mobile app</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer ID/Name</th>
                  <th>Booking Date</th>
                  <th>Grand Total</th>
                  <th>Document Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id}>
                    <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{order.id}</td>
                    <td>
                      <div>
                        <div style={{ fontWeight: 600 }}>{order.customerName || order.customer}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>ID: {order.customer}</div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                        <span>{order.transactionDate}</span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 700, fontSize: '15px' }}>${order.grandTotal.toFixed(2)}</td>
                    <td>
                      <span style={{
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em',
                        background: order.status === 'Draft' ? 'rgba(250, 204, 21, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                        color: order.status === 'Draft' ? '#facc15' : 'var(--color-primary)'
                      }}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
