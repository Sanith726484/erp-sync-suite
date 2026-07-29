import React, { useState, useEffect } from 'react';
import { ErpClientManager, ErpConnectionConfig } from 'api';
import { Database, Link, Key, ShieldCheck, HelpCircle, Server } from 'lucide-react';

interface ErpSettingsProps {
  onConfigChanged: () => void;
}

export const ErpSettings: React.FC<ErpSettingsProps> = ({ onConfigChanged }) => {
  const [host, setHost] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [mode, setMode] = useState<'frappe' | 'mock'>('mock');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    const config = ErpClientManager.getConfig();
    if (config) {
      setHost(config.host || '');
      setApiKey(config.apiKey || '');
      setApiSecret(config.apiSecret || '');
      setMode(config.mode || 'mock');
    }
  }, []);

  const handleSave = () => {
    const config: ErpConnectionConfig = {
      host,
      apiKey: mode === 'frappe' ? apiKey : undefined,
      apiSecret: mode === 'frappe' ? apiSecret : undefined,
      mode,
    };
    ErpClientManager.setConfig(config);
    onConfigChanged();
    setTestResult({ success: true, message: 'Settings saved successfully!' });
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const config: ErpConnectionConfig = {
        host,
        apiKey,
        apiSecret,
        mode,
      };
      
      let client;
      if (mode === 'mock') {
        // Mock adapter
        const { MockAdapter } = await import('api');
        client = new MockAdapter();
      } else {
        // Frappe adapter
        const { FrappeAdapter } = await import('api');
        client = new FrappeAdapter(config);
      }
      
      const success = await client.testConnection();
      if (success) {
        setTestResult({ success: true, message: 'Connection verified successfully!' });
      } else {
        setTestResult({ success: false, message: 'Failed to connect. Check URL and API keys.' });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'An error occurred during verification.' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="glass-card animate-fade-in" style={{ maxWidth: '640px', margin: '40px auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ background: 'var(--color-primary-glow)', padding: '12px', borderRadius: '12px', color: 'var(--color-primary)' }}>
          <Database size={24} />
        </div>
        <div>
          <h2 style={{ fontSize: '20px', color: '#ffffff' }}>ERP Connection Settings</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Link your ERPNext Frappe instance to sync orders and maps</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Mode Select */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
            Sync Backend Mode
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <button
              onClick={() => setMode('mock')}
              style={{
                background: mode === 'mock' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${mode === 'mock' ? 'var(--color-primary)' : 'var(--border-light)'}`,
                borderRadius: '10px',
                padding: '14px',
                color: mode === 'mock' ? '#ffffff' : 'var(--text-muted)',
                cursor: 'pointer',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'var(--transition-smooth)'
              }}
            >
              <Server size={18} />
              <div>
                <div>Demo Mode (Mock)</div>
                <div style={{ fontSize: '11px', fontWeight: 400, opacity: 0.8 }}>Local Storage (Offline)</div>
              </div>
            </button>

            <button
              onClick={() => setMode('frappe')}
              style={{
                background: mode === 'frappe' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${mode === 'frappe' ? 'var(--color-primary)' : 'var(--border-light)'}`,
                borderRadius: '10px',
                padding: '14px',
                color: mode === 'frappe' ? '#ffffff' : 'var(--text-muted)',
                cursor: 'pointer',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'var(--transition-smooth)'
              }}
            >
              <Database size={18} />
              <div>
                <div>Frappe / ERPNext</div>
                <div style={{ fontSize: '11px', fontWeight: 400, opacity: 0.8 }}>Direct REST API Client</div>
              </div>
            </button>
          </div>
        </div>

        {mode === 'frappe' && (
          <>
            {/* Host URL */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                <Link size={14} /> ERP Domain URL
              </label>
              <input
                type="url"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="https://your-site.erpnext.com"
                className="form-input"
              />
            </div>

            {/* API Key */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                  <Key size={14} /> API Key
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="e.g. 9b9a67a840c..."
                  className="form-input"
                />
              </div>

              {/* API Secret */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                  <Key size={14} /> API Secret
                </label>
                <input
                  type="password"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  placeholder="••••••••••••"
                  className="form-input"
                />
              </div>
            </div>
          </>
        )}

        {/* Test Connection Result Alert */}
        {testResult && (
          <div
            className="animate-fade-in"
            style={{
              background: testResult.success ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              border: `1px solid ${testResult.success ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
              borderRadius: '10px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: testResult.success ? 'var(--color-primary)' : 'hsl(0, 84%, 60%)',
              fontSize: '13.5px',
            }}
          >
            <ShieldCheck size={18} />
            <span>{testResult.message}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
          <button
            onClick={handleTestConnection}
            disabled={testing || (mode === 'frappe' && !host)}
            className="btn-secondary"
            style={{ flex: 1, justifyContent: 'center' }}
          >
            {testing ? 'Verifying...' : 'Test Connection'}
          </button>

          <button
            onClick={handleSave}
            disabled={mode === 'frappe' && (!host || !apiKey || !apiSecret)}
            className="btn-primary"
            style={{ flex: 1, justifyContent: 'center' }}
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};
