// AgencyOS Shell: Collapsible Sidebar, Topbar with Back button & Breadcrumbs, Header
import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useRouter, buildBreadcrumbs } from '../lib/router';
import { Icon } from './icons';
import { NAV_GROUPS, PAGES, pageById, ALIASES, roleLabel } from './osConfig';
import { initials } from './OsUi';
import { useAlerts, useApprovalQueue } from './osData';
import { buildNav, hubOf } from './osHubs';

const EXP_KEY = 'paa_nav_expanded_groups';

export const OsSidebar: React.FC<{
  open: boolean;
  onClose: () => void;
  onOpenSearch?: () => void;
  onOpenProfile?: () => void;
}> = ({ open, onClose, onOpenSearch, onOpenProfile }) => {
  const { activeTab, currentRole, currentUser, logout } = useApp();
  const { navigate } = useRouter();
  const [q, setQ] = useState('');
  const current = ALIASES[activeTab] || activeTab;
  const approvals = useApprovalQueue().filter((a) => a.canAct).length;
  const alerts = useAlerts().filter((a) => a.severity === 'Critical' || a.severity === 'High').length;
  const groups = buildNav(currentRole, q);

  // Guard against browser autofill accidentally populating the navigation filter on load
  useEffect(() => {
    if (
      q &&
      ((currentUser?.email && q.toLowerCase().includes(currentUser.email.toLowerCase())) ||
        (currentUser?.employeeId && q.toLowerCase().includes(currentUser.employeeId.toLowerCase())))
    ) {
      setQ('');
    }
  }, [q, currentUser]);

  // Collapsible dropdown groups with persistent state
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(EXP_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return { Workspace: true, 'CRM & Sales': true };
  });

  // Mobile drawer: close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Mobile drawer: prevent background body scroll when drawer is open
  useEffect(() => {
    if (open && typeof window !== 'undefined' && window.innerWidth <= 900) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [open]);

  const toggleGroup = (key: string) => {
    setExpanded((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(EXP_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Auto-expand parent group when current active tab changes
  useEffect(() => {
    const parentGroup = PAGES.find(
      (p) => p.id === current || hubOf(p.id)?.members.includes(current)
    )?.group;
    if (parentGroup && !expanded[parentGroup]) {
      setExpanded((prev) => {
        const next = { ...prev, [parentGroup]: true };
        try {
          localStorage.setItem(EXP_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    }
  }, [current]);

  const isGroupOpen = (key: string) => {
    if (q.trim()) return true;
    return !!expanded[key];
  };

  return (
    <>
      <div className={`backdrop ${open ? 'show' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        {/* Brand without PRIORITY ADS AGENCY ONLY flag */}
        <div className="brand" style={{ padding: '20px 20px 16px' }}>
          <img
            src="/logo-wide.png"
            alt="Priority Ads Agency - Your success is our priority"
            style={{ width: '100%', maxWidth: 200, height: 'auto', display: 'block', margin: '0 auto' }}
          />
        </div>

        {/* Filter Navigation */}
        <div style={{ margin: '12px 14px 4px' }}>
          <div className="nav-search" style={{ margin: 0, width: '100%' }}>
            <Icon name="search" size={15} />
            <input
              type="search"
              id="sidebar_nav_filter"
              name="sidebar_nav_filter"
              placeholder="Filter menu..."
              value={q}
              onChange={(e) => {
                const val = e.target.value;
                // Guard against browser password managers auto-filling email or employee ID into sidebar navigation search
                if (
                  (currentUser?.email && val.toLowerCase().includes(currentUser.email.toLowerCase())) ||
                  (currentUser?.employeeId && val.toLowerCase().includes(currentUser.employeeId.toLowerCase()))
                ) {
                  return;
                }
                setQ(val);
              }}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore="true"
              data-bwignore="true"
              data-form-type="other"
              aria-label="Filter navigation"
            />
          </div>
        </div>

        {/* 10 Collapsible Navigation Groups */}
        <nav className="nav-scroll" aria-label="Main Navigation">
          {groups.map((g) => {
            const isOpen = isGroupOpen(g.key);
            const hasActiveChild = g.pages.some((p) =>
              p.members ? p.members.includes(current) : current === p.id
            );
            const groupId = `nav-group-${g.key.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;

            return (
              <div key={g.key} style={{ marginBottom: 4 }}>
                <div
                  className="nav-heading"
                  onClick={() => toggleGroup(g.key)}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isOpen}
                  aria-controls={groupId}
                  aria-label={`${g.key} section, ${isOpen ? 'expanded' : 'collapsed'}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleGroup(g.key);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    userSelect: 'none',
                    padding: '10px 10px 6px',
                    color: hasActiveChild ? '#0B1738' : '#475569',
                    fontWeight: 700,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name={g.icon} size={15} />
                    <span>{g.key}</span>
                  </div>
                  <Icon name={isOpen ? 'chevronDown' : 'chevronRight'} size={14} />
                </div>

                {isOpen && (
                  <div id={groupId} style={{ display: 'grid', gap: 2, paddingLeft: 4 }}>
                    {g.pages.map((p) => {
                      const isActive = p.members ? p.members.includes(current) : current === p.id;
                      return (
                        <button
                          key={p.id}
                          className={`nav-item ${isActive ? 'active' : ''}`}
                          aria-current={isActive ? 'page' : undefined}
                          onClick={() => {
                            navigate(p.go);
                            onClose();
                            window.scrollTo({ top: 0 });
                          }}
                        >
                          <span style={{ flex: 1, textAlign: 'left' }}>{p.name}</span>
                          {(p.id === 'approvals' || p.id === 'hub-approvals') && approvals > 0 && (
                            <span className="count">{approvals}</span>
                          )}
                          {p.id === 'alerts' && alerts > 0 && <span className="count red">{alerts}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {!groups.length && (
            <div className="tiny-note" style={{ padding: 13 }}>
              No matching screens for this role.
            </div>
          )}
        </nav>

        {/* Sidebar Footer with Profile Trigger */}
        <div className="sidebar-bottom">
          <div
            className="account-chip hover-link"
            onClick={onOpenProfile}
            title="Click to view My Profile & Sessions"
            style={{ cursor: 'pointer', padding: '6px 8px', borderRadius: 8, transition: 'background 0.15s' }}
          >
            <div className="avatar">{initials(currentUser.name)}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <b>{currentUser.name}</b>
              <small>{roleLabel(currentRole)}</small>
            </div>
            <button
              className="top-icon"
              title="Sign out"
              onClick={(e) => {
                e.stopPropagation();
                logout();
              }}
              style={{ width: 30, height: 30, borderRadius: 6 }}
            >
              <Icon name="logout" size={14} />
            </button>
          </div>
          <div className="tiny-note" style={{ marginTop: 8, color: '#94A3B8', fontSize: '11px', textAlign: 'center' }}>
            AgencyOS Enterprise • {currentUser.employeeId}
          </div>
        </div>
      </aside>
    </>
  );
};

export const OsTopbar: React.FC<{
  onMenu: () => void;
  onOpenSearch?: () => void;
  onOpenCalendar?: () => void;
}> = ({ onMenu, onOpenSearch, onOpenCalendar }) => {
  const { activeTab, currentRole } = useApp();
  const { navigate, goBack, canGoBack, params } = useRouter();
  const alerts = useAlerts().length;
  const breadcrumbs = buildBreadcrumbs(activeTab, params);

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
        <button className="top-icon mobile-toggle" aria-label="Open menu" onClick={onMenu}>
          <Icon name="menu" size={19} />
        </button>

        {/* Back Button with History Support */}
        <button
          className="top-icon"
          title={canGoBack ? "Go back to previous screen" : "Back"}
          aria-label="Go back"
          onClick={() => goBack()}
          disabled={!canGoBack}
          style={{
            opacity: canGoBack ? 1 : 0.4,
            cursor: canGoBack ? 'pointer' : 'default',
            width: 32,
            height: 32,
            borderRadius: 6,
          }}
        >
          <Icon name="chevronLeft" size={16} />
        </button>

        {/* Dynamic Clickable Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span style={{ color: '#CBD5E1', padding: '0 2px' }}>/</span>}
              {crumb.tab && !crumb.isCurrent ? (
                <span
                  onClick={() => navigate(crumb.tab!, crumb.params)}
                  style={{ cursor: 'pointer', color: '#1D4ED8', fontWeight: 600 }}
                  className="hover-link"
                >
                  {crumb.label}
                </span>
              ) : (
                <span style={{ color: crumb.isCurrent ? '#0F172A' : '#64748B', fontWeight: crumb.isCurrent ? 700 : 500 }}>
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      <div className="top-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Global Search Pill */}
        {onOpenSearch && (
          <button
            onClick={onOpenSearch}
            className="top-search-pill"
            title="Search enterprise records (Ctrl+K)"
            aria-label="Search enterprise records"
          >
            <Icon name="search" size={14} />
            <span className="hide-mobile">Search AgencyOS...</span>
            <kbd style={{ fontSize: 10, background: '#EAEFF8', color: '#1D4ED8', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
              Ctrl+K
            </kbd>
          </button>
        )}

        {/* Google Calendar Quick Sync */}
        {onOpenCalendar && (
          <button
            className="top-icon"
            title="Google Calendar Two-Way Sync"
            aria-label="Google Calendar Two-Way Sync"
            onClick={onOpenCalendar}
          >
            <Icon name="calendarCheck" size={17} />
          </button>
        )}

        <span className="demo-tag hide-mobile">{roleLabel(currentRole).toUpperCase()}</span>

        {/* Alerts Bell */}
        <button
          className="top-icon"
          title={`Alerts (${alerts})`}
          aria-label={`Alerts (${alerts})`}
          onClick={() => navigate('alerts')}
          style={{ position: 'relative' }}
        >
          <Icon name="bell" size={17} />
          {alerts > 0 && (
            <span
              style={{
                position: 'absolute',
                top: 6,
                right: 7,
                width: 7,
                height: 7,
                borderRadius: 9,
                background: '#B42318',
              }}
            />
          )}
        </button>
      </div>
    </header>
  );
};

export const OsHeader: React.FC<{ actions?: React.ReactNode }> = ({ actions }) => {
  const { activeTab } = useApp();
  const p = pageById(ALIASES[activeTab] || activeTab);
  if (!p) return null;
  return (
    <div className="titlebar">
      <div>
        <h1 className="h1">{hubOf(p.id)?.name || p.name}</h1>
        <p className="subline">{p.subtitle}</p>
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
};
