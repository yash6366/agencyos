import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Icon } from '../os/icons';

export interface GoogleCalendarStatus {
  connected: boolean;
  email: string | null;
  lastSync: string | null;
  channel: string;
}

export interface SyncLog {
  id: string;
  timestamp: string;
  by: string;
  employeeId: string;
  internalEventsCount: number;
  externalEventsCount: number;
  status: string;
  message: string;
}

export const GoogleCalendarModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { currentUser } = useApp();
  const [status, setStatus] = useState<GoogleCalendarStatus>({
    connected: false,
    email: null,
    lastSync: null,
    channel: 'primary',
  });
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchStatusAndLogs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('paa_x_jwt_token') || sessionStorage.getItem('paa_x_jwt_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [statusRes, logsRes] = await Promise.all([
        fetch('/api/integrations/google/status', { headers }),
        fetch('/api/integrations/google/logs', { headers }),
      ]);

      if (statusRes.ok) {
        const data = await statusRes.json();
        setStatus(data);
      }
      if (logsRes.ok) {
        const logData = await logsRes.json();
        setLogs(logData || []);
      }
    } catch (e: any) {
      console.warn('Google Calendar status error:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatusAndLogs();
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  const handleConnect = async () => {
    setError(null);
    setLoading(true);
    try {
      const token = localStorage.getItem('paa_x_jwt_token') || sessionStorage.getItem('paa_x_jwt_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/integrations/google/auth-url', { headers });
      const data = await res.json();

      if (data.configured && data.url) {
        // Redirect or open popup for real Google OAuth
        window.open(data.url, 'Google OAuth', 'width=600,height=700');
        // Poll status
        setTimeout(fetchStatusAndLogs, 3000);
      } else {
        // Simulate local callback for test environment
        const cbRes = await fetch('/api/integrations/google/callback', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: 'test_code' }),
        });
        if (cbRes.ok) {
          setSuccessMsg('Google Calendar successfully connected!');
          await fetchStatusAndLogs();
        } else {
          const err = await cbRes.json();
          setError(err.error || 'Connection failed');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Connection error');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect Google Calendar?')) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('paa_x_jwt_token') || sessionStorage.getItem('paa_x_jwt_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/integrations/google/disconnect', {
        method: 'POST',
        headers,
      });
      if (res.ok) {
        setStatus({ connected: false, email: null, lastSync: null, channel: 'primary' });
        setSuccessMsg('Google Calendar disconnected.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const token = localStorage.getItem('paa_x_jwt_token') || sessionStorage.getItem('paa_x_jwt_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/integrations/google/sync', {
        method: 'POST',
        headers,
      });

      if (res.ok) {
        const data = await res.json();
        setSuccessMsg(data.log?.message || `Synchronized ${data.eventsSynced} events successfully.`);
        await fetchStatusAndLogs();
      } else {
        const err = await res.json();
        setError(err.error || 'Sync failed');
      }
    } catch (err: any) {
      setError(err.message || 'Sync error');
    } finally {
      setSyncing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(7, 18, 47, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '720px',
          background: '#FFFFFF',
          borderRadius: '14px',
          boxShadow: '0 24px 48px rgba(11, 23, 56, 0.28)',
          border: '1px solid #E5E7EB',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '85vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            background: '#0B1738',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: '#FFFFFF',
                color: '#4285F4',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 900,
                fontSize: '18px',
              }}
            >
              📅
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#FFFFFF' }}>
                Google Calendar Two-Way Synchronization
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: '#D2DAE8' }}>
                Sync milestones, employee deadlines, deliverables, and client meetings
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              color: '#FFFFFF',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              fontSize: '16px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'grid', gap: '18px' }}>
          {successMsg && (
            <div style={{ background: '#E6F6EF', border: '1px solid #B7EBCE', color: '#087F59', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>
              {successMsg}
            </div>
          )}
          {error && (
            <div style={{ background: '#FEEDEC', border: '1px solid #FECDCA', color: '#B42318', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>
              {error}
            </div>
          )}

          {/* Connection Status Card */}
          <div
            style={{
              padding: '16px 20px',
              borderRadius: '10px',
              border: '1px solid #E5E7EB',
              background: status.connected ? '#F6FAF8' : '#F8F9FB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: status.connected ? '#087F59' : '#B42318',
                    display: 'inline-block',
                  }}
                />
                <strong style={{ fontSize: '13.5px', color: '#0B1738' }}>
                  {status.connected ? 'Connected to Google Calendar' : 'Not Connected'}
                </strong>
                {status.connected && (
                  <span style={{ fontSize: '10.5px', background: '#E6F6EF', color: '#087F59', padding: '2px 7px', borderRadius: '10px', fontWeight: 700 }}>
                    Active
                  </span>
                )}
              </div>
              <div style={{ fontSize: '11.5px', color: '#667085' }}>
                {status.connected
                  ? `Account: ${status.email || currentUser.email} • Last Synced: ${status.lastSync ? new Date(status.lastSync).toLocaleString('en-IN') : 'Just now'}`
                  : 'Connect your corporate Google account via secure OAuth 2.0.'}
              </div>
            </div>

            <div>
              {status.connected ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleSyncNow}
                    disabled={syncing}
                    style={{
                      background: '#0B1738',
                      color: '#FFF',
                      border: 'none',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: syncing ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
                  </button>
                  <button
                    onClick={handleDisconnect}
                    disabled={loading}
                    style={{
                      background: '#FFF',
                      border: '1px solid #D0D5DD',
                      color: '#B42318',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 650,
                      cursor: 'pointer',
                    }}
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={loading}
                  style={{
                    background: '#0B1738',
                    color: '#FFF',
                    border: 'none',
                    padding: '9px 18px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span>Connect Google Calendar</span>
                </button>
              )}
            </div>
          </div>

          {/* Sync Rules Card */}
          <div style={{ background: '#F8F9FB', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '16px' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '12.5px', fontWeight: 750, color: '#0B1738' }}>
              Two-Way Synchronization Policies
            </h4>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '11.5px', color: '#475467', lineHeight: 1.7 }}>
              <li><strong>Agency Milestones & Task Deadlines:</strong> Automatically pushed to the primary Google Calendar with <code>agencyos_id</code> deduplication tags.</li>
              <li><strong>Client Follow-ups & Scheduled Visits:</strong> Synced as timed events with notifications and alerts.</li>
              <li><strong>Conflict Resolution:</strong> Modifications inside AgencyOS take precedence for project delivery checkpoints.</li>
              <li><strong>Privacy & Security:</strong> Client secrets and tokens are securely isolated in the backend PostgreSQL vault; tokens are never exposed to the browser.</li>
            </ul>
          </div>

          {/* Sync History / Audit Logs */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h4 style={{ margin: 0, fontSize: '12.5px', fontWeight: 750, color: '#0B1738' }}>
                Synchronization Audit Logs
              </h4>
              <button
                onClick={fetchStatusAndLogs}
                style={{ background: 'transparent', border: 'none', color: '#2458A6', fontSize: '11px', cursor: 'pointer', fontWeight: 650 }}
              >
                Refresh Logs
              </button>
            </div>

            {logs.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#667085', fontSize: '11.5px', border: '1px solid #E5E7EB', borderRadius: '8px' }}>
                No synchronization events logged yet. Connect and click "Sync Now" to initialize.
              </div>
            ) : (
              <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11.5px' }}>
                  <thead>
                    <tr style={{ background: '#F8F9FB', borderBottom: '1px solid #E5E7EB', color: '#667085' }}>
                      <th style={{ padding: '8px 12px', fontWeight: 700 }}>Timestamp</th>
                      <th style={{ padding: '8px 12px', fontWeight: 700 }}>Status</th>
                      <th style={{ padding: '8px 12px', fontWeight: 700 }}>Events</th>
                      <th style={{ padding: '8px 12px', fontWeight: 700 }}>Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} style={{ borderBottom: '1px solid #F1F2F5' }}>
                        <td style={{ padding: '8px 12px', color: '#111827', whiteSpace: 'nowrap' }}>
                          {new Date(log.timestamp).toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ background: '#E6F6EF', color: '#087F59', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
                            {log.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', color: '#344054', whiteSpace: 'nowrap' }}>
                          {log.internalEventsCount} internal • {log.externalEventsCount} Google
                        </td>
                        <td style={{ padding: '8px 12px', color: '#667085' }}>
                          {log.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            background: '#FAFBFC',
            borderTop: '1px solid #E5E7EB',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #D0D5DD',
              background: '#FFF',
              color: '#344054',
              fontSize: '12px',
              fontWeight: 650,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
