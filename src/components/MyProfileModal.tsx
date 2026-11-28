import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  fetchUserProfile,
  updateUserProfile,
  changeUserPassword,
  revokeUserSession,
} from '../lib/auth';
import { Icon } from '../os/icons';
import { initials } from '../os/OsUi';
import { roleLabel } from '../os/osConfig';

export interface SessionItem {
  id: string;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
  last_seen: string;
  revoked_at?: string | null;
  current?: boolean;
}

export interface LoginEventItem {
  id: string | number;
  ok: boolean;
  reason?: string;
  ip: string;
  user_agent: string;
  at: string;
}

export const MyProfileModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { currentUser, currentRole, employees, departments, designations } = useApp();
  const [activeTab, setActiveTab] = useState<'personal' | 'employment' | 'security' | 'sessions' | 'history'>('personal');
  
  // Personal editable fields
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [personalEmail, setPersonalEmail] = useState((currentUser as any).personalEmail || '');
  const [address, setAddress] = useState((currentUser as any).address || '');
  const [emergencyContact, setEmergencyContact] = useState((currentUser as any).emergencyContact || '');
  const [bloodGroup, setBloodGroup] = useState((currentUser as any).bloodGroup || '');
  const [bio, setBio] = useState((currentUser as any).bio || '');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Security tab
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [passwordUpdatedAt, setPasswordUpdatedAt] = useState<string | null>(null);

  // Sessions & History
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginEventItem[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Fetch real backend profile & session data when opened
  useEffect(() => {
    if (!isOpen) return;

    setPhone(currentUser.phone || '');
    setPersonalEmail((currentUser as any).personalEmail || '');
    setAddress((currentUser as any).address || '');
    setEmergencyContact((currentUser as any).emergencyContact || '');
    setBloodGroup((currentUser as any).bloodGroup || '');
    setBio((currentUser as any).bio || '');
    setSaveSuccess(false);
    setSaveError(null);
    setPwSuccess(false);
    setPwError(null);

    const loadProfileData = async () => {
      setLoadingData(true);
      try {
        const data = await fetchUserProfile();
        if (data) {
          if (data.profile) {
            setPhone(data.profile.phone || '');
            setPersonalEmail(data.profile.personalEmail || '');
            setAddress(data.profile.address || '');
            setEmergencyContact(data.profile.emergencyContact || '');
            setBloodGroup(data.profile.bloodGroup || '');
            setBio(data.profile.bio || '');
          }
          if (data.security?.passwordUpdatedAt) {
            setPasswordUpdatedAt(new Date(data.security.passwordUpdatedAt).toLocaleDateString('en-IN', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            }));
          }
          if (data.sessions) setSessions(data.sessions);
          if (data.loginHistory) setLoginHistory(data.loginHistory);
        }
      } catch {
        // use local fallback
      } finally {
        setLoadingData(false);
      }
    };

    loadProfileData();
  }, [isOpen, currentUser]);

  const handleSavePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const res = await updateUserProfile({
        phone,
        personalEmail,
        address,
        emergencyContact,
        bloodGroup,
        bio,
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setSaveError(res.error || 'Failed to update profile');
      }
    } catch (err: any) {
      setSaveError(err.message || 'Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwSaving(true);
    setPwSuccess(false);
    setPwError(null);

    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match');
      setPwSaving(false);
      return;
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#~^()_+\-={}\[\]|:;"'<>,.\/]).{8,}$/.test(newPassword)) {
      setPwError('Password must be at least 8 characters with uppercase, lowercase, numbers, and special symbols.');
      setPwSaving(false);
      return;
    }

    try {
      const res = await changeUserPassword(currentPassword, newPassword);

      if (res.ok) {
        setPwSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPwSuccess(false), 3000);
      } else {
        setPwError(res.error || 'Failed to update password');
      }
    } catch (err: any) {
      setPwError(err.message || 'Network error');
    } finally {
      setPwSaving(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (!window.confirm('Are you sure you want to terminate this session?')) return;
    try {
      const ok = await revokeUserSession(sessionId);

      if (ok) {
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, revoked_at: new Date().toISOString() } : s))
        );
      }
    } catch {
      // ignore
    }
  };

  if (!isOpen) return null;

  // Resolve department, designation, and reporting manager names
  const deptName = departments?.find((d) => d.id === currentUser.departmentId)?.name || (currentUser as any).department || 'Operations';
  const desigTitle = designations?.find((d) => d.id === currentUser.designationId)?.title || (currentUser as any).designation || 'Specialist';
  const manager = employees?.find((e) => e.id === currentUser.reportingManagerId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="My Profile & Sessions"
      className="modal-overlay profile-modal-backdrop"
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
          maxWidth: '780px',
          background: '#FFFFFF',
          borderRadius: '14px',
          boxShadow: '0 24px 48px rgba(11, 23, 56, 0.28)',
          border: '1px solid #E5E7EB',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '88vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Card */}
        <div
          style={{
            padding: '24px',
            background: 'linear-gradient(135deg, #0B1738 0%, #15295C 100%)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '14px',
                background: '#F5B82E',
                color: '#0B1738',
                display: 'grid',
                placeItems: 'center',
                fontSize: '20px',
                fontWeight: 800,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
            >
              {initials(currentUser.name)}
            </div>
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 800, color: '#FFFFFF' }}>
                {currentUser.name}
              </h2>
              <div style={{ fontSize: '12px', color: '#D2DAE8', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span>ID: {currentUser.employeeId}</span>
                <span>•</span>
                <span style={{ background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                  {roleLabel(currentRole)}
                </span>
                <span>•</span>
                <span>{currentUser.email}</span>
              </div>
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
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #E5E7EB',
            background: '#F8F9FB',
            padding: '0 16px',
          }}
        >
          {[
            { id: 'personal', label: 'Personal Information' },
            { id: 'employment', label: 'Employment Details' },
            { id: 'security', label: 'Security & Password' },
            { id: 'sessions', label: `Active Sessions (${sessions.filter((s) => !s.revoked_at).length})` },
            { id: 'history', label: 'Login History' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  padding: '12px 16px',
                  border: 'none',
                  background: 'transparent',
                  borderBottom: isActive ? '2px solid #0B1738' : '2px solid transparent',
                  color: isActive ? '#0B1738' : '#667085',
                  fontWeight: isActive ? 750 : 550,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  marginBottom: '-1px',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {/* TAB 1: PERSONAL INFORMATION */}
          {activeTab === 'personal' && (
            <form onSubmit={handleSavePersonal} style={{ display: 'grid', gap: '16px' }}>
              <div style={{ fontSize: '12px', color: '#667085', marginBottom: '8px' }}>
                You can directly update your personal contact details, address, and profile bio below.
              </div>

              {saveSuccess && (
                <div style={{ background: '#E6F6EF', border: '1px solid #B7EBCE', color: '#087F59', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>
                  Personal information successfully updated.
                </div>
              )}
              {saveError && (
                <div style={{ background: '#FEEDEC', border: '1px solid #FECDCA', color: '#B42318', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>
                  {saveError}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#344054', marginBottom: '6px' }}>
                    Full Legal Name (HR Verified)
                  </label>
                  <input
                    value={currentUser.name}
                    disabled
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: '8px', background: '#F8F9FB', color: '#667085', fontSize: '12.5px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#344054', marginBottom: '6px' }}>
                    Primary Work Email (Agency Managed)
                  </label>
                  <input
                    value={currentUser.email}
                    disabled
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: '8px', background: '#F8F9FB', color: '#667085', fontSize: '12.5px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#344054', marginBottom: '6px' }}>
                    Phone Number (Editable)
                  </label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #D0D5DD', borderRadius: '8px', fontSize: '12.5px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#344054', marginBottom: '6px' }}>
                    Personal Email Address (Editable)
                  </label>
                  <input
                    value={personalEmail}
                    onChange={(e) => setPersonalEmail(e.target.value)}
                    placeholder="personal@example.com"
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #D0D5DD', borderRadius: '8px', fontSize: '12.5px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#344054', marginBottom: '6px' }}>
                    Emergency Contact Name & Phone
                  </label>
                  <input
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    placeholder="e.g. Ramesh (Brother) +91 99999 88888"
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #D0D5DD', borderRadius: '8px', fontSize: '12.5px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#344054', marginBottom: '6px' }}>
                    Blood Group
                  </label>
                  <input
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    placeholder="e.g. O+, B+, A-"
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #D0D5DD', borderRadius: '8px', fontSize: '12.5px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#344054', marginBottom: '6px' }}>
                  Residential Address
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  placeholder="Complete current residential address..."
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #D0D5DD', borderRadius: '8px', fontSize: '12.5px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#344054', marginBottom: '6px' }}>
                  Professional Bio / Notes
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={2}
                  placeholder="Short summary of roles, skills, or portfolio..."
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #D0D5DD', borderRadius: '8px', fontSize: '12.5px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    background: '#0B1738',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 20px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saving ? 'Saving Changes...' : 'Save Personal Details'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: EMPLOYMENT INFORMATION (HR RESTRICTED) */}
          {activeTab === 'employment' && (
            <div style={{ display: 'grid', gap: '16px' }}>
              <div
                style={{
                  background: '#FFF8E7',
                  border: '1px solid #F4E3B9',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  fontSize: '12px',
                  color: '#7D5F0B',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>🔒</span>
                <span>
                  Employment and role data is officially maintained by HR. To request changes to designation or reporting lines, please raise an HR ticket.
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ background: '#F8F9FB', padding: '14px', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
                  <small style={{ color: '#667085', fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>Employee ID</small>
                  <strong style={{ fontSize: '14px', color: '#0B1738', marginTop: '4px', display: 'block' }}>{currentUser.employeeId}</strong>
                </div>
                <div style={{ background: '#F8F9FB', padding: '14px', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
                  <small style={{ color: '#667085', fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>Department</small>
                  <strong style={{ fontSize: '14px', color: '#0B1738', marginTop: '4px', display: 'block' }}>{deptName}</strong>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ background: '#F8F9FB', padding: '14px', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
                  <small style={{ color: '#667085', fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>Designation</small>
                  <strong style={{ fontSize: '14px', color: '#0B1738', marginTop: '4px', display: 'block' }}>{desigTitle}</strong>
                </div>
                <div style={{ background: '#F8F9FB', padding: '14px', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
                  <small style={{ color: '#667085', fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>Reporting Manager</small>
                  <strong style={{ fontSize: '14px', color: '#0B1738', marginTop: '4px', display: 'block' }}>
                    {manager ? `${manager.name} (${manager.employeeId})` : 'Executive Management (Direct)'}
                  </strong>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ background: '#F8F9FB', padding: '14px', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
                  <small style={{ color: '#667085', fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>Joining Date</small>
                  <strong style={{ fontSize: '14px', color: '#0B1738', marginTop: '4px', display: 'block' }}>
                    {currentUser.joiningDate ? new Date(currentUser.joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Confirmed'}
                  </strong>
                </div>
                <div style={{ background: '#F8F9FB', padding: '14px', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
                  <small style={{ color: '#667085', fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>Work Mode</small>
                  <strong style={{ fontSize: '14px', color: '#0B1738', marginTop: '4px', display: 'block', textTransform: 'capitalize' }}>
                    {currentUser.workMode || 'Office'}
                  </strong>
                </div>
              </div>

              <div style={{ background: '#F8F9FB', padding: '14px', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
                <small style={{ color: '#667085', fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>System Role & Permissions Tier</small>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '6px' }}>
                  <span style={{ background: '#0B1738', color: '#FFF', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700 }}>
                    {roleLabel(currentRole)}
                  </span>
                  <span style={{ fontSize: '12px', color: '#667085' }}>
                    Standard statutory payroll, attendance, and role-authorized modules enabled.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SECURITY & PASSWORD */}
          {activeTab === 'security' && (
            <div style={{ display: 'grid', gap: '20px' }}>
              <div style={{ background: '#F8F9FB', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 750, color: '#0B1738' }}>Security Overview</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#111827', fontWeight: 600 }}>Password status</div>
                    <small style={{ color: '#667085', fontSize: '11px' }}>
                      {passwordUpdatedAt ? `Last changed on ${passwordUpdatedAt}` : 'Standard strong password active'}
                    </small>
                  </div>
                  <span style={{ fontSize: '11px', background: '#E6F6EF', color: '#087F59', padding: '3px 9px', borderRadius: '12px', fontWeight: 750 }}>
                    Active
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #E5E7EB' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#111827', fontWeight: 600 }}>Multi-Factor Authentication (MFA)</div>
                    <small style={{ color: '#667085', fontSize: '11px' }}>Enforced for remote sign-ins via IP verification</small>
                  </div>
                  <span style={{ fontSize: '11px', background: '#EAF2FF', color: '#2458A6', padding: '3px 9px', borderRadius: '12px', fontWeight: 750 }}>
                    Enforced
                  </span>
                </div>
              </div>

              <form onSubmit={handleChangePassword} autoComplete="off" style={{ display: 'grid', gap: '14px' }}>
                {/* Hidden username input prevents browser password managers from misidentifying outside inputs */}
                <input
                  type="text"
                  name="username"
                  value={currentUser.email || currentUser.employeeId}
                  autoComplete="username"
                  style={{ display: 'none' }}
                  tabIndex={-1}
                  aria-hidden="true"
                  readOnly
                />
                <h4 style={{ margin: '0', fontSize: '13px', fontWeight: 750, color: '#0B1738' }}>Change Account Password</h4>

                {pwSuccess && (
                  <div style={{ background: '#E6F6EF', border: '1px solid #B7EBCE', color: '#087F59', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>
                    Password successfully changed.
                  </div>
                )}
                {pwError && (
                  <div style={{ background: '#FEEDEC', border: '1px solid #FECDCA', color: '#B42318', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>
                    {pwError}
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#344054', marginBottom: '6px' }}>
                    Current Password
                  </label>
                  <input
                    type="password"
                    name="profile-current-password"
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder="Enter current password"
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #D0D5DD', borderRadius: '8px', fontSize: '12.5px' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#344054', marginBottom: '6px' }}>
                      New Password (min 8 chars with letters & numbers)
                    </label>
                    <input
                      type="password"
                      name="profile-new-password"
                      autoComplete="new-password"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      placeholder="At least 8 characters"
                      style={{ width: '100%', padding: '9px 12px', border: '1px solid #D0D5DD', borderRadius: '8px', fontSize: '12.5px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#344054', marginBottom: '6px' }}>
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      name="profile-confirm-password"
                      autoComplete="new-password"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Repeat new password"
                      style={{ width: '100%', padding: '9px 12px', border: '1px solid #D0D5DD', borderRadius: '8px', fontSize: '12.5px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                  <button
                    type="submit"
                    disabled={pwSaving}
                    style={{
                      background: '#0B1738',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 20px',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      cursor: pwSaving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {pwSaving ? 'Updating Password...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 4: ACTIVE SESSIONS */}
          {activeTab === 'sessions' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span style={{ fontSize: '12px', color: '#667085' }}>
                  Manage connected browsers and devices with active sessions for your account.
                </span>
              </div>

              {sessions.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#667085', fontSize: '12.5px' }}>
                  No active session records found.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '10px' }}>
                  {sessions.map((s) => {
                    const isRevoked = !!s.revoked_at;
                    return (
                      <div
                        key={s.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px',
                          background: s.current ? '#F7F9FD' : '#FFFFFF',
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                            <strong style={{ fontSize: '13px', color: '#111827' }}>
                              {(s.user_agent || '').includes('Mozilla') ? 'Web Browser' : 'API Client'}
                            </strong>
                            {s.current && (
                              <span style={{ background: '#E6F6EF', color: '#087F59', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 750 }}>
                                Current Session
                              </span>
                            )}
                            {isRevoked && (
                              <span style={{ background: '#FEEDEC', color: '#B42318', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 750 }}>
                                Terminated
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: '#667085' }}>
                            IP: <code>{s.ip || '127.0.0.1'}</code> • Last seen: {new Date(s.last_seen).toLocaleString('en-IN')}
                          </div>
                          <div style={{ fontSize: '10.5px', color: '#98A0AD', marginTop: '2px' }}>
                            {(s.user_agent || '').slice(0, 90)}
                          </div>
                        </div>

                        {!s.current && !isRevoked && (
                          <button
                            onClick={() => handleRevokeSession(s.id)}
                            style={{
                              background: '#FFF',
                              border: '1px solid #D0D5DD',
                              color: '#B42318',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: 650,
                              cursor: 'pointer',
                            }}
                          >
                            Terminate
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: LOGIN HISTORY */}
          {activeTab === 'history' && (
            <div>
              <div style={{ fontSize: '12px', color: '#667085', marginBottom: '14px' }}>
                Recent login attempts, successful sign-ins, and security audits for your employee ID.
              </div>

              {loginHistory.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#667085', fontSize: '12.5px' }}>
                  No recent login events recorded.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#F8F9FB', borderBottom: '1px solid #E5E7EB', color: '#667085' }}>
                        <th style={{ padding: '10px 12px', fontWeight: 700, fontSize: '11px' }}>Timestamp</th>
                        <th style={{ padding: '10px 12px', fontWeight: 700, fontSize: '11px' }}>Status</th>
                        <th style={{ padding: '10px 12px', fontWeight: 700, fontSize: '11px' }}>IP Address</th>
                        <th style={{ padding: '10px 12px', fontWeight: 700, fontSize: '11px' }}>Client / Browser</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loginHistory.map((ev, i) => (
                        <tr key={ev.id || i} style={{ borderBottom: '1px solid #F1F2F5' }}>
                          <td style={{ padding: '10px 12px', color: '#111827' }}>
                            {new Date(ev.at).toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {ev.ok ? (
                              <span style={{ background: '#E6F6EF', color: '#087F59', padding: '2px 7px', borderRadius: '10px', fontSize: '10.5px', fontWeight: 700 }}>
                                Success
                              </span>
                            ) : (
                              <span style={{ background: '#FEEDEC', color: '#B42318', padding: '2px 7px', borderRadius: '10px', fontSize: '10.5px', fontWeight: 700 }}>
                                Failed ({ev.reason || 'Invalid'})
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#475467' }}>
                            <code>{ev.ip || 'Localhost'}</code>
                          </td>
                          <td style={{ padding: '10px 12px', color: '#667085', fontSize: '11px' }}>
                            {(ev.user_agent || 'Web Client').slice(0, 50)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
