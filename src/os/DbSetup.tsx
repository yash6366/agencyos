// AGENCYOS_DB: first-time database setup notice and connectivity indicator on the login screen
import React, { useEffect, useState } from 'react';
import { dbEnabled, dbSetupStatus, dbImportThisBrowser } from '../lib/dbSync';
import { Database, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

interface DbSetupProps {
  compact?: boolean;
}

export const DbSetup: React.FC<DbSetupProps> = ({ compact = true }) => {
  const [st, setSt] = useState<'off' | 'checking' | 'empty' | 'ok' | 'down'>(dbEnabled() ? 'checking' : 'off');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (dbEnabled()) {
      dbSetupStatus().then((s) => setSt(!s ? 'down' : s.empty ? 'empty' : 'ok'));
    }
  }, []);

  if (st === 'off' || st === 'checking') return null;

  if (st === 'ok') {
    return (
      <div
        className="login-db-status online"
        role="status"
        aria-label="Database status: Connected to the company database"
        title="Connected to high-availability PostgreSQL database"
      >
        <Database size={13} className="login-db-icon" strokeWidth={2.2} aria-hidden="true" />
        <span className="login-db-text">Connected to the company database</span>
      </div>
    );
  }

  if (st === 'down') {
    return (
      <div
        className="login-db-alert down"
        role="alert"
        aria-live="assertive"
      >
        <div className="login-db-alert-icon">
          <AlertTriangle size={16} aria-hidden="true" />
        </div>
        <div className="login-db-alert-content">
          <strong>Database Server Offline</strong>
          <span>
            AgencyOS backend is not reachable. Run <code>npm.cmd run server</code> in PowerShell to connect.
          </span>
        </div>
      </div>
    );
  }

  // st === 'empty'
  return (
    <div className="login-db-alert empty" role="region" aria-label="Database Setup">
      <div className="login-db-alert-icon">
        <Database size={16} aria-hidden="true" />
      </div>
      <div className="login-db-alert-content">
        <strong>Initial Database Migration Required</strong>
        <p>No records found in PostgreSQL. Copy browser dataset into the centralized database.</p>
        <button
          type="button"
          className="login-db-btn"
          disabled={busy}
          onClick={async () => {
            if (!confirm('Copy all data from this browser into the database now?')) return;
            setBusy(true);
            const m = await dbImportThisBrowser();
            setBusy(false);
            setMsg(m);
            if (/^Copied/.test(m)) setSt('ok');
          }}
        >
          {busy ? (
            <>
              <RefreshCw size={13} className="animate-spin" aria-hidden="true" />
              <span>Importing records…</span>
            </>
          ) : (
            <>
              <CheckCircle size={13} aria-hidden="true" />
              <span>Copy browser data to PostgreSQL</span>
            </>
          )}
        </button>
        {msg && <div className="login-db-msg">{msg}</div>}
      </div>
    </div>
  );
};
