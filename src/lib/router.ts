// AgencyOS Centralized Browser History Router & Unsaved Changes Guard
import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { ALIASES, pageById, PAGES, NAV_GROUPS, osCanAccess } from '../os/osConfig';
import { hubOf } from '../os/osHubs';
import { homeTab } from './rbac';

export interface RouteState {
  tab: string;
  params: Record<string, string>;
  canGoBack: boolean;
  historyLength: number;
}

export interface BreadcrumbItem {
  label: string;
  tab?: string;
  params?: Record<string, string>;
  isCurrent?: boolean;
}

// Registry for unsaved form changes
const dirtyForms = new Map<string, { isDirty: boolean; message?: string }>();

export function registerDirtyForm(id: string, isDirty: boolean, message?: string) {
  if (isDirty) {
    dirtyForms.set(id, { isDirty: true, message });
  } else {
    dirtyForms.delete(id);
  }
}

export function hasUnsavedChanges(): { dirty: boolean; message: string } {
  for (const item of dirtyForms.values()) {
    if (item.isDirty) {
      return { dirty: true, message: item.message || 'You have unsaved changes. Are you sure you want to leave?' };
    }
  }
  return { dirty: false, message: '' };
}

// Global beforeunload handler for browser refresh / close
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (e) => {
    const { dirty } = hasUnsavedChanges();
    if (dirty) {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  });
}

function parseUrl(): { tab: string; params: Record<string, string> } {
  if (typeof window === 'undefined') return { tab: 'founder', params: {} };

  let rawPath = window.location.pathname.replace(/^\/+/, '');
  let rawSearch = window.location.search;

  // Support hash routing fallback (e.g. /#/leads?id=123)
  if (window.location.hash.startsWith('#/')) {
    const hashPart = window.location.hash.slice(2);
    const [hPath, hSearch] = hashPart.split('?');
    if (hPath) rawPath = hPath;
    if (hSearch) rawSearch = '?' + hSearch;
  }

  const tabCandidate = rawPath.split('/')[0] || '';
  const searchParams = new URLSearchParams(rawSearch);
  const params: Record<string, string> = {};
  searchParams.forEach((val, key) => {
    params[key] = val;
  });

  const resolved = ALIASES[tabCandidate] || tabCandidate;
  const valid = resolved && (PAGES.some((p) => p.id === resolved) || ['dashboard', 'founder'].includes(resolved));

  return {
    tab: valid ? resolved : '',
    params,
  };
}

let historyCount = 0;
const listeners = new Set<() => void>();

let currentRoute: RouteState = {
  tab: 'founder',
  params: {},
  canGoBack: false,
  historyLength: 0,
};

function updateRoute(tab: string, params: Record<string, string>, pushToHistory: boolean, replace: boolean = false) {
  const normTab = ALIASES[tab] || tab;
  
  if (typeof window !== 'undefined') {
    const search = new URLSearchParams(params).toString();
    const queryStr = search ? `?${search}` : '';
    const newUrl = `/${normTab}${queryStr}`;

    if (pushToHistory) {
      if (replace) {
        window.history.replaceState({ tab: normTab, params }, '', newUrl);
      } else {
        window.history.pushState({ tab: normTab, params }, '', newUrl);
        historyCount++;
      }
    }
  }

  currentRoute = {
    tab: normTab,
    params,
    canGoBack: historyCount > 0 || (typeof window !== 'undefined' && window.history.length > 1),
    historyLength: historyCount,
  };

  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  // Initialize from current URL
  const initial = parseUrl();
  if (initial.tab) {
    currentRoute.tab = initial.tab;
    currentRoute.params = initial.params;
  }

  window.addEventListener('popstate', (e) => {
    const { dirty, message } = hasUnsavedChanges();
    if (dirty) {
      const confirmLeave = window.confirm(message);
      if (!confirmLeave) {
        // Re-push previous state to cancel back
        const search = new URLSearchParams(currentRoute.params).toString();
        window.history.pushState(
          { tab: currentRoute.tab, params: currentRoute.params },
          '',
          `/${currentRoute.tab}${search ? '?' + search : ''}`
        );
        return;
      }
      dirtyForms.clear();
    }

    if (e.state && e.state.tab) {
      currentRoute = {
        tab: e.state.tab,
        params: e.state.params || {},
        canGoBack: historyCount > 0,
        historyLength: Math.max(0, historyCount - 1),
      };
      if (historyCount > 0) historyCount--;
    } else {
      const parsed = parseUrl();
      currentRoute = {
        tab: parsed.tab || 'founder',
        params: parsed.params,
        canGoBack: historyCount > 0,
        historyLength: Math.max(0, historyCount - 1),
      };
      if (historyCount > 0) historyCount--;
    }
    listeners.forEach((l) => l());
  });
}

export function navigate(tab: string, params: Record<string, string> = {}, replace: boolean = false): boolean {
  const { dirty, message } = hasUnsavedChanges();
  if (dirty) {
    const proceed = window.confirm(message);
    if (!proceed) return false;
    dirtyForms.clear();
  }

  updateRoute(tab, params, true, replace);
  return true;
}

export function goBack(fallbackTab: string = 'founder') {
  const { dirty, message } = hasUnsavedChanges();
  if (dirty) {
    const proceed = window.confirm(message);
    if (!proceed) return;
    dirtyForms.clear();
  }

  if (typeof window !== 'undefined' && window.history.length > 1 && currentRoute.canGoBack) {
    window.history.back();
  } else {
    navigate(fallbackTab);
  }
}

export function goForward() {
  if (typeof window !== 'undefined') {
    window.history.forward();
  }
}

export function useRouter() {
  const route = useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => currentRoute,
    () => currentRoute
  );

  return {
    ...route,
    navigate,
    goBack,
    goForward,
  };
}

/**
 * Hook for pages/forms with unsaved inputs.
 */
export function useUnsavedChanges(formId: string, isDirty: boolean, message?: string) {
  useEffect(() => {
    registerDirtyForm(formId, isDirty, message);
    return () => {
      registerDirtyForm(formId, false);
    };
  }, [formId, isDirty, message]);
}

/**
 * Computes dynamic breadcrumb trail for topbar
 */
export function buildBreadcrumbs(tab: string, params: Record<string, string> = {}): BreadcrumbItem[] {
  const norm = ALIASES[tab] || tab;
  const p = pageById(norm);
  const items: BreadcrumbItem[] = [];

  if (!p) {
    items.push({ label: 'Workspace', tab: 'founder' });
    items.push({ label: norm.replace(/[-_]/g, ' ').toUpperCase(), isCurrent: true });
    return items;
  }

  // 1. Top Level Group
  items.push({ label: p.group });

  // 2. Hub (if exists and different from page)
  const h = hubOf(p.id);
  if (h && h.name !== p.name) {
    items.push({ label: h.name, tab: h.members[0] });
  }

  // 3. Current Page
  items.push({
    label: p.name,
    tab: p.id,
    isCurrent: !params.id && !params.view,
  });

  // 4. Detail Record or nested view
  if (params.id) {
    const detailLabel = params.name || params.title || `Record #${params.id}`;
    items.push({
      label: detailLabel,
      params,
      isCurrent: true,
    });
  } else if (params.view) {
    items.push({
      label: params.view.charAt(0).toUpperCase() + params.view.slice(1),
      params,
      isCurrent: true,
    });
  }

  return items;
}
