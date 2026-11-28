// AGENCYOS_LOGO
// AGENCYOS_DB_DONE
// AGENCYOS_V3_OS: Enterprise Sign-In with Real Password Verification, Rate-Limiting, Brute-Force Lockout & Audit Trail
import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { readKey, writeKey, uid, nowStamp } from '../lib/sharedStore';
import { hashPassword, Credential, LoginEvent, ResetRequest, CRED_KEY, LOGIN_LOG_KEY, RESET_KEY } from '../lib/rbac';
import { dbEnabled, dbLogin } from '../lib/dbSync';
import { DbSetup } from './DbSetup';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  KeyRound,
  FileText,
  BarChart3,
  Server
} from 'lucide-react';

const normalizeAuthError = (msg: string): string => {
  if (!msg) return '';
  // Convert any unpolished legacy strings to enterprise standards
  if (msg.includes('Wrong password') || msg.includes('attempt(s) left') || msg.includes('Incorrect password')) {
    const match = msg.match(/(\d+)\s*attempt/i);
    const count = match ? parseInt(match[1], 10) : null;
    if (count === 1) {
      return 'Invalid credentials. Warning: 1 attempt remaining before your account is temporarily locked for 15 minutes.';
    }
    return 'Invalid work email, employee ID, or password.';
  }
  if (msg.includes('Too many wrong attempts') || msg.includes('multiple failed attempts')) {
    return 'Your account has been temporarily locked due to consecutive unsuccessful sign-in attempts. Please try again in 15 minutes or contact your system administrator.';
  }
  return msg;
};

export const OsLogin: React.FC = () => {
  const { employees, login } = useApp();

  // Remember-Me initialization
  const [id, setId] = useState(() => {
    try {
      return localStorage.getItem('paa_x_remember') || '';
    } catch {
      return '';
    }
  });

  const [pw, setPw] = useState('');
  const [remember, setRemember] = useState(() => {
    try {
      return !!localStorage.getItem('paa_x_remember');
    } catch {
      return false;
    }
  });

  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [view, setView] = useState<'login' | 'forgot'>('login');
  const [resetId, setResetId] = useState('');
  const [resetSubmitted, setResetSubmitted] = useState(false);

  // Prevent concurrent duplicate submissions
  const submittingRef = useRef(false);

  const log = (e: Omit<LoginEvent, 'id' | 'at'>) =>
    writeKey(LOGIN_LOG_KEY, [{ ...e, id: uid('lg'), at: nowStamp() }, ...readKey<LoginEvent[]>(LOGIN_LOG_KEY, [])].slice(0, 2000));

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (busy || submittingRef.current) return;

    setErr('');
    setInfo('');

    const key = id.trim().toLowerCase();
    const cleanPw = pw;

    if (!key) {
      return setErr('Please enter your corporate email address or employee ID.');
    }
    if (!cleanPw) {
      return setErr('Please enter your account password.');
    }

    submittingRef.current = true;
    setBusy(true);

    try {
      // 1. Primary Authentication: Central PostgreSQL Backend
      if (dbEnabled()) {
        if (remember) {
          localStorage.setItem('paa_x_remember', id.trim());
        } else {
          localStorage.removeItem('paa_x_remember');
        }

        const serverError = await dbLogin(id.trim(), cleanPw, remember);
        if (!serverError) {
          // Success: page will reload with authenticated session
          return;
        }

        // Server returned failure or network error
        setBusy(false);
        submittingRef.current = false;
        if (serverError.includes('Cannot reach the AgencyOS server')) {
          return setErr('Unable to reach the AgencyOS authentication service. Please check your network connection or try again later.');
        }
        return setErr(normalizeAuthError(serverError));
      }

      // 2. Standalone / Offline Authentication Mode
      const emp = employees.find(
        (e) => e.email.toLowerCase() === key || e.employeeId.toLowerCase() === key
      );

      // Prevent username enumeration by using a consistent error message
      if (!emp) {
        setBusy(false);
        submittingRef.current = false;
        return setErr('Invalid work email, employee ID, or password.');
      }

      const lockedUntil = readKey<Record<string, number>>('paa_x_lockouts', {})[emp.id] || 0;
      if (lockedUntil > Date.now()) {
        setBusy(false);
        submittingRef.current = false;
        return setErr('Your account has been temporarily locked due to consecutive unsuccessful sign-in attempts. Please try again in 15 minutes or contact your system administrator.');
      }

      if (emp.status === 'inactive') {
        log({ employeeId: emp.id, name: emp.name, role: emp.role, portal: 'os', ok: false, reason: 'inactive' });
        setBusy(false);
        submittingRef.current = false;
        return setErr('This account has been deactivated. Please contact your system administrator or HR.');
      }

      const cred = readKey<Credential[]>(CRED_KEY, []).find((c) => c.employeeId === emp.id);
      let ok = false;

      if (cred?.hash) {
        ok = (await hashPassword(cleanPw)) === cred.hash;
      }

      if (!ok) {
        log({ employeeId: emp.id, name: emp.name, role: emp.role, portal: 'os', ok: false, reason: 'wrong password' });
        const cutoff = Date.now() - 15 * 60 * 1000;
        const fails = readKey<Record<string, number[]>>('paa_x_failed', {});
        const list = [...(fails[emp.id] || []).filter((t) => t > cutoff), Date.now()];
        fails[emp.id] = list;
        writeKey('paa_x_failed', fails);

        if (list.length >= 5) {
          const l = readKey<Record<string, number>>('paa_x_lockouts', {});
          l[emp.id] = Date.now() + 15 * 60 * 1000;
          writeKey('paa_x_lockouts', l);
          setBusy(false);
          submittingRef.current = false;
          return setErr('Your account has been temporarily locked due to consecutive unsuccessful sign-in attempts. Please try again in 15 minutes or contact your system administrator.');
        }

        setBusy(false);
        submittingRef.current = false;
        const remaining = Math.max(0, 5 - list.length);
        if (remaining === 1) {
          return setErr('Invalid credentials. Warning: 1 attempt remaining before your account is temporarily locked for 15 minutes.');
        }
        return setErr('Invalid work email, employee ID, or password.');
      }

      // Successful client-side authentication
      const fails = readKey<Record<string, number[]>>('paa_x_failed', {});
      delete fails[emp.id];
      writeKey('paa_x_failed', fails);

      log({ employeeId: emp.id, name: emp.name, role: emp.role, portal: 'os', ok: true });
      if (remember) {
        localStorage.setItem('paa_x_remember', id.trim());
      } else {
        localStorage.removeItem('paa_x_remember');
      }

      if (!cred || cred.mustChange) {
        sessionStorage.setItem('paa_x_must_change', '1');
      }

      login(emp.email, emp.role);
    } catch (e: any) {
      setErr(e?.message || 'An unexpected authentication error occurred. Please try again.');
    } finally {
      setBusy(false);
      submittingRef.current = false;
    }
  };

  const submitResetRequest = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const key = (resetId || id).trim().toLowerCase();
    if (!key) {
      return setErr('Please specify your work email or employee ID to request a password reset.');
    }

    setBusy(true);
    setErr('');
    try {
      if (dbEnabled()) {
        try {
          await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ login: key }),
          });
        } catch (fetchErr) {
          console.warn('[AgencyOS Reset Notice]:', fetchErr);
        }
      }

      // Record request ticket for Admin/HR review
      const emp = employees.find((x) => x.email.toLowerCase() === key || x.employeeId.toLowerCase() === key);
      writeKey(RESET_KEY, [
        { id: uid('rst'), login: key, employeeId: emp?.id, at: nowStamp(), status: 'open' } as ResetRequest,
        ...readKey<ResetRequest[]>(RESET_KEY, []),
      ]);

      setResetSubmitted(true);
      setInfo('If an account matches the information provided, password reset instructions will be sent.');
    } catch {
      setResetSubmitted(true);
      setInfo('If an account matches the information provided, password reset instructions will be sent.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      {/* ----------------- BRANDING HERO (LEFT PANEL) ----------------- */}
      <div className="login-left">
        <div className="login-left-glow" aria-hidden="true" />
        <div className="login-left-top">
          <div className="login-brand-wrapper">
            <div className="login-brand-card">
              <img
                src="/logo-wide.png"
                alt="Priority Ads Agency - Your Success Is Our Priority"
                className="login-brand-img"
              />
            </div>
          </div>
          <div className="login-system-badge">
            <span className="login-badge-dot" aria-hidden="true" />
            <span>AGENCYOS ENTERPRISE ERP · v3.0</span>
          </div>
        </div>

        <div className="login-left-body">
          <h1 className="login-hero-title">
            Enterprise Operations <br />
            <span className="accent">&amp; Unified Agency ERP</span>
          </h1>
          <p className="login-hero-desc">
            Secure, centralized operating platform powering client management, live ERP financials, workforce delivery, and executive governance.
          </p>

          <div className="login-features-list">
            <div className="login-feature-item">
              <div className="login-feature-icon" aria-hidden="true">
                <ShieldCheck size={18} />
              </div>
              <div className="login-feature-text">
                <strong>Zero-Trust Role-Based Access</strong>
                <span>Granular permissions across Owner, HR, Project, Finance, and Field desks.</span>
              </div>
            </div>

            <div className="login-feature-item">
              <div className="login-feature-icon" aria-hidden="true">
                <BarChart3 size={18} />
              </div>
              <div className="login-feature-text">
                <strong>Real-Time ERP &amp; Billing Ledger</strong>
                <span>GST-compliant invoicing, live collections tracking, and automated payroll runs.</span>
              </div>
            </div>

            <div className="login-feature-item">
              <div className="login-feature-icon" aria-hidden="true">
                <FileText size={18} />
              </div>
              <div className="login-feature-text">
                <strong>Tamper-Evident Security Audit</strong>
                <span>Every access event and financial update logged in the immutable audit registry.</span>
              </div>
            </div>
          </div>
        </div>

        <div className="login-left-footer">
          <div className="login-compliance-text">
            <span>SOC2 / ISO-27001 Aligned Controls</span>
            <span className="separator">·</span>
            <span>Internal Authorized Personnel Only</span>
            <span className="separator">·</span>
            <span>Bangalore HQ</span>
          </div>
        </div>
      </div>

      {/* ----------------- AUTHENTICATION CENTER (RIGHT PANEL) ----------------- */}
      <div className="login-right">
        <div className="login-form-container">
          <div className="login-card">
            {view === 'login' ? (
              <form className="login-form" onSubmit={submit} noValidate>
                <div className="login-form-header">
                  <div className="eyebrow">PRIORITY ADS AGENCY · SECURE WORKSPACE</div>
                  <h2 id="signin-heading">Sign in to your workspace</h2>
                  <p>Enter your authorized credentials to access your agency desk.</p>
                </div>

                {/* Status / Error Notifications */}
                {err && (
                  <div
                    className={`login-alert ${
                      err.toLowerCase().includes('warning') || err.toLowerCase().includes('remaining')
                        ? 'warning'
                        : 'error'
                    }`}
                    role="alert"
                    aria-live="assertive"
                  >
                    {err.toLowerCase().includes('warning') || err.toLowerCase().includes('remaining') ? (
                      <AlertTriangle size={18} className="login-alert-icon" aria-hidden="true" />
                    ) : (
                      <AlertCircle size={18} className="login-alert-icon" aria-hidden="true" />
                    )}
                    <div className="login-alert-content">
                      <div className="login-alert-title">
                        {err.toLowerCase().includes('warning') || err.toLowerCase().includes('remaining')
                          ? 'Security Warning'
                          : 'Sign-In Failed'}
                      </div>
                      <div className="login-alert-msg">{err}</div>
                    </div>
                  </div>
                )}

                {info && (
                  <div className="login-alert info" role="status" aria-live="polite">
                    <CheckCircle2 size={18} className="login-alert-icon" aria-hidden="true" />
                    <div className="login-alert-content">
                      <div className="login-alert-title">Success</div>
                      <div className="login-alert-msg">{info}</div>
                    </div>
                  </div>
                )}

                {/* Email / Username Field */}
                <div className="login-field-group">
                  <label htmlFor="signin-id" className="login-field-label">
                    Work Email or Employee ID
                  </label>
                  <div className="login-input-wrapper">
                    <span className="login-input-icon" aria-hidden="true">
                      <Mail size={16} />
                    </span>
                    <input
                      id="signin-id"
                      type="text"
                      required
                      disabled={busy}
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck="false"
                      placeholder="name@priorityadsagency.com or PAA-EMP-001"
                      className="login-input"
                      value={id}
                      onChange={(e) => {
                        setId(e.target.value);
                        if (err) setErr('');
                      }}
                      aria-required="true"
                      aria-invalid={!!err}
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="login-field-group">
                  <div className="login-password-header">
                    <label htmlFor="signin-pw" className="login-field-label">
                      Password
                    </label>
                  </div>
                  <div className="login-input-wrapper">
                    <span className="login-input-icon" aria-hidden="true">
                      <Lock size={16} />
                    </span>
                    <input
                      id="signin-pw"
                      type={show ? 'text' : 'password'}
                      required
                      disabled={busy}
                      autoComplete="current-password"
                      placeholder="Enter your confidential password"
                      className="login-input has-toggle"
                      value={pw}
                      onChange={(e) => {
                        setPw(e.target.value);
                        if (err) setErr('');
                      }}
                      aria-required="true"
                      aria-invalid={!!err}
                    />
                    <button
                      type="button"
                      className="login-pw-toggle"
                      disabled={busy}
                      onClick={() => setShow(!show)}
                      aria-label={show ? 'Hide password' : 'Show password'}
                      aria-pressed={show}
                    >
                      {show ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                    </button>
                  </div>
                </div>

                {/* Remember Device & Password Reset Trigger */}
                <div className="login-actions-row">
                  <label htmlFor="signin-remember" className="login-remember-label">
                    <input
                      id="signin-remember"
                      type="checkbox"
                      className="login-checkbox"
                      checked={remember}
                      disabled={busy}
                      onChange={(e) => setRemember(e.target.checked)}
                    />
                    <span>Remember this workstation</span>
                  </label>
                  <button
                    type="button"
                    className="login-forgot-link"
                    onClick={() => {
                      setResetId(id);
                      setErr('');
                      setInfo('');
                      setResetSubmitted(false);
                      setView('forgot');
                    }}
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="login-submit-btn"
                  disabled={busy}
                  aria-busy={busy}
                >
                  {busy ? (
                    <>
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                      <span>Verifying Credentials…</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to AgencyOS</span>
                      <ArrowRight size={16} aria-hidden="true" />
                    </>
                  )}
                </button>

                {/* Trust Seal */}
                <div className="login-security-seal">
                  <ShieldCheck size={14} aria-hidden="true" />
                  <span>256-Bit SSL Encrypted Session · ISO-27001 Aligned</span>
                </div>

                {/* Database Status Indicator */}
                <div className="login-card-status">
                  <DbSetup />
                </div>
              </form>
            ) : (
              /* ----------------- FORGOT PASSWORD ASSISTANCE VIEW ----------------- */
              <form className="login-form" onSubmit={submitResetRequest} noValidate>
                <div className="login-form-header">
                  <div className="eyebrow">CREDENTIAL RECOVERY</div>
                  <h2>Reset your password</h2>
                  <p>
                    Submit a secure credential reset request. An authorized HR administrator will verify your identity and generate a temporary one-time password.
                  </p>
                </div>

                {err && (
                  <div
                    className={`login-alert ${
                      err.toLowerCase().includes('warning') || err.toLowerCase().includes('remaining')
                        ? 'warning'
                        : 'error'
                    }`}
                    role="alert"
                    aria-live="assertive"
                  >
                    {err.toLowerCase().includes('warning') || err.toLowerCase().includes('remaining') ? (
                      <AlertTriangle size={18} className="login-alert-icon" aria-hidden="true" />
                    ) : (
                      <AlertCircle size={18} className="login-alert-icon" aria-hidden="true" />
                    )}
                    <div className="login-alert-content">
                      <div className="login-alert-title">
                        {err.toLowerCase().includes('warning') || err.toLowerCase().includes('remaining')
                          ? 'Security Notice'
                          : 'Request Failed'}
                      </div>
                      <div className="login-alert-msg">{err}</div>
                    </div>
                  </div>
                )}

                {info && (
                  <div className="login-alert info" role="status" aria-live="polite">
                    <CheckCircle2 size={18} className="login-alert-icon" aria-hidden="true" />
                    <div className="login-alert-content">
                      <div className="login-alert-title">Success</div>
                      <div className="login-alert-msg">{info}</div>
                    </div>
                  </div>
                )}

                {!resetSubmitted ? (
                  <>
                    <div className="login-field-group">
                      <label htmlFor="reset-id" className="login-field-label">
                        Work Email or Employee ID
                      </label>
                      <div className="login-input-wrapper">
                        <span className="login-input-icon" aria-hidden="true">
                          <Mail size={16} />
                        </span>
                        <input
                          id="reset-id"
                          type="text"
                          required
                          autoComplete="username"
                          placeholder="you@priorityadsagency.com or PAA-EMP-001"
                          className="login-input"
                          value={resetId}
                          onChange={(e) => setResetId(e.target.value)}
                        />
                      </div>
                    </div>

                    <button type="submit" className="login-submit-btn">
                      <span>Submit Reset Request</span>
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  </>
                ) : null}

                <button
                  type="button"
                  className="login-back-btn"
                  onClick={() => {
                    setView('login');
                    setErr('');
                    setInfo('');
                    setResetSubmitted(false);
                  }}
                >
                  &larr; Back to sign in
                </button>
              </form>
            )}
          </div>

          {/* Footer outside the card */}
          <div className="login-legal-footer">
            <p>
              Confidential &amp; Proprietary · Internal Staff Portal
              <br />
              Priority Ads Agency Pvt Ltd · All sign-in attempts are audited.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
