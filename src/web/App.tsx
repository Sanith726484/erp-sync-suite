import React, { useState, useEffect } from 'react';
import { ErpClientManager, CompanyBranding } from 'api';
import { Dashboard } from './components/Dashboard';
import { OrderList } from './components/OrderList';
import { RouteHistoryMap } from './components/RouteHistoryMap';
import { ErpSettings } from './components/ErpSettings';
import { Home, ShoppingBag, Navigation, Settings, HelpCircle, ShieldAlert, Cpu } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'map' | 'settings'>('dashboard');
  const [configVersion, setConfigVersion] = useState(0);
  const [branding, setBranding] = useState<CompanyBranding | null>(null);

  const activeConfig = ErpClientManager.getConfig();

  const loadBranding = async () => {
    try {
      const client = ErpClientManager.getClient();
      // Try to fetch custom branding for default company (or fallback)
      const data = await client.getCompanyBranding(activeConfig?.username || 'Suntek');
      setBranding(data);
    } catch (err) {
      console.warn('Failed to load company branding:', err);
      setBranding(null);
    }
  };

  useEffect(() => {
    loadBranding();
  }, [configVersion]);

  const handleConfigChanged = () => {
    setConfigVersion(prev => prev + 1);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard key={configVersion} />;
      case 'orders':
        return <OrderList key={configVersion} />;
      case 'map':
        return <RouteHistoryMap key={configVersion} />;
      case 'settings':
        return <ErpSettings onConfigChanged={handleConfigChanged} />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', minHeight: '100vh' }}>
      {/* Sidebar Panel */}
      <aside style={{
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-light)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          {/* Logo Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {branding?.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt="Logo"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  objectFit: 'contain',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-light)'
                }}
              />
            ) : (
              <div style={{
                background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: 'var(--shadow-glow)'
              }}>
                <Cpu size={22} />
              </div>
            )}
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-display)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>
                {branding?.companyName || 'Suntek Sync'}
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ERP Sync Dashboard</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={() => setActiveTab('dashboard')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                background: activeTab === 'dashboard' ? 'rgba(16, 185, 129, 0.08)' : 'none',
                border: 'none',
                borderRadius: '10px',
                color: activeTab === 'dashboard' ? 'var(--color-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: '14px',
                textAlign: 'left',
                transition: 'var(--transition-smooth)'
              }}
            >
              <Home size={18} />
              Dashboard
            </button>

            <button
              onClick={() => setActiveTab('map')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                background: activeTab === 'map' ? 'rgba(16, 185, 129, 0.08)' : 'none',
                border: 'none',
                borderRadius: '10px',
                color: activeTab === 'map' ? 'var(--color-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: '14px',
                textAlign: 'left',
                transition: 'var(--transition-smooth)'
              }}
            >
              <Navigation size={18} />
              Route History
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                background: activeTab === 'orders' ? 'rgba(16, 185, 129, 0.08)' : 'none',
                border: 'none',
                borderRadius: '10px',
                color: activeTab === 'orders' ? 'var(--color-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: '14px',
                textAlign: 'left',
                transition: 'var(--transition-smooth)'
              }}
            >
              <ShoppingBag size={18} />
              Booked Orders
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                background: activeTab === 'settings' ? 'rgba(16, 185, 129, 0.08)' : 'none',
                border: 'none',
                borderRadius: '10px',
                color: activeTab === 'settings' ? 'var(--color-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: '14px',
                textAlign: 'left',
                transition: 'var(--transition-smooth)'
              }}
            >
              <Settings size={18} />
              ERP Settings
            </button>
          </nav>
        </div>

        {/* Footer info showing status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--border-light)',
            padding: '12px 16px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: activeConfig ? 'var(--color-primary)' : '#e11d48',
              boxShadow: activeConfig ? '0 0 10px var(--color-primary)' : '0 0 10px #e11d48'
            }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activeConfig ? (activeConfig.mode === 'frappe' ? 'ERPNext Active' : 'Mock Local Dev') : 'No ERP Configured'}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activeConfig?.host || 'Stand-alone'}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Panel View */}
      <main style={{ padding: '40px', overflowY: 'auto', maxHeight: '100vh' }}>
        {/* Header alert if connection fails or is empty */}
        {!activeConfig && activeTab !== 'settings' && (
          <div style={{
            background: 'rgba(225, 29, 72, 0.08)',
            border: '1px solid rgba(225, 29, 72, 0.2)',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '30px',
            color: '#fda4af',
            fontSize: '14px',
            animation: 'fadeIn 0.3s ease'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <ShieldAlert size={20} />
              <span>You have not configured an ERP site connection yet. Direct REST synchronization is offline.</span>
            </div>
            <button onClick={() => setActiveTab('settings')} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
              Configure Now
            </button>
          </div>
        )}

        {renderContent()}
      </main>
    </div>
  );
};
export default App;
