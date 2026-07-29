import React, { useState, useEffect } from 'react';
import { ErpClientManager, Order, Customer, Product } from 'api';
import { TrendingUp, Users, ShoppingBag, MapPin, AlertCircle, RefreshCw } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const client = ErpClientManager.getClient();
      const [oList, cList, pList] = await Promise.all([
        client.getOrders(),
        client.getCustomers(),
        client.getProducts(),
      ]);
      setOrders(oList);
      setCustomers(cList);
      setProducts(pList);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalBilling = orders.reduce((sum, order) => sum + (order.grandTotal || 0), 0);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', gap: '8px' }}>
        <RefreshCw size={20} className="spin" style={{ color: 'var(--color-primary)' }} />
        <span>Loading metrics...</span>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '28px', color: '#ffffff' }}>Operational Insights</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Overview of synced sales orders, agents, and client locations</p>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        {/* Metric 1 */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '16px', borderRadius: '12px', color: 'var(--color-primary)' }}>
            <TrendingUp size={28} />
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600 }}>Total Bookings</div>
            <h3 style={{ fontSize: '24px', color: '#ffffff', marginTop: '4px' }}>${totalBilling.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ background: 'rgba(250, 204, 21, 0.1)', padding: '16px', borderRadius: '12px', color: '#facc15' }}>
            <ShoppingBag size={28} />
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600 }}>Sales Orders</div>
            <h3 style={{ fontSize: '24px', color: '#ffffff', marginTop: '4px' }}>{orders.length}</h3>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '16px', borderRadius: '12px', color: 'var(--color-secondary)' }}>
            <Users size={28} />
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600 }}>Total Customers</div>
            <h3 style={{ fontSize: '24px', color: '#ffffff', marginTop: '4px' }}>{customers.length}</h3>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ background: 'rgba(236, 72, 153, 0.1)', padding: '16px', borderRadius: '12px', color: '#ec4899' }}>
            <MapPin size={28} />
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600 }}>Catalog Items</div>
            <h3 style={{ fontSize: '24px', color: '#ffffff', marginTop: '4px' }}>{products.length}</h3>
          </div>
        </div>
      </div>

      {/* Grid of details */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', minHeight: '300px' }}>
        {/* Left Side: Recent Sales Orders */}
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '18px', color: '#ffffff' }}>Recent Orders</h3>
            <button onClick={loadData} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
          {orders.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <AlertCircle size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
              <div>No orders synced yet.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Grand Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 5).map((order) => (
                    <tr key={order.id}>
                      <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{order.id}</td>
                      <td>{order.customerName || order.customer}</td>
                      <td>{order.transactionDate}</td>
                      <td style={{ fontWeight: 600 }}>${order.grandTotal.toFixed(2)}</td>
                      <td>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
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

        {/* Right Side: Quick Info / Tips */}
        <div className="glass-card">
          <h3 style={{ fontSize: '18px', color: '#ffffff', marginBottom: '16px' }}>Status Summary</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>ERP Connection</span>
              <span style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: '14px' }}>
                {ErpClientManager.getConfig()?.mode === 'frappe' ? 'Frappe / ERPNext Connected' : 'Local Sandbox (Demo Mode)'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Active Staff Logs</span>
              <span style={{ color: '#ffffff', fontWeight: 600, fontSize: '14px' }}>Enabled</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>GPS Sync Interval</span>
              <span style={{ color: '#ffffff', fontWeight: 600, fontSize: '14px' }}>15 minutes</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', marginTop: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-secondary)' }}>System TIP</div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                To sync real-time GPS locations, ensure your field agents have enabled "Always Allow" location services on the mobile app.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
