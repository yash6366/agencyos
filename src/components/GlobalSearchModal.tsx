import React, { useState, useEffect, useRef, useCallback } from 'react';
import { authFetch } from '../lib/auth';
import { useApp } from '../context/AppContext';
import { useRouter } from '../lib/router';
import { Icon } from '../os/icons';

export interface SearchResult {
  id: string;
  category: string;
  tab: string;
  title: string;
  subtitle: string;
  status: string;
  snippet: string;
  score: number;
}

const CATEGORIES = [
  { id: 'all', label: 'All Results' },
  { id: 'leads', label: 'Leads' },
  { id: 'clients', label: 'Clients' },
  { id: 'employees', label: 'Employees' },
  { id: 'projects', label: 'Projects' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'quotations', label: 'Quotations' },
  { id: 'documents', label: 'Documents' },
  { id: 'contracts', label: 'Contracts' },
  { id: 'expenses', label: 'Expenses' },
];

const RECENT_KEY = 'paa_recent_searches';

export const GlobalSearchModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { currentRole, leads, clients, employees, projects, tasks, invoices, quotations, agreements, expenses } = useApp();
  const { navigate } = useRouter();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [categories, setCategories] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load recent searches
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_KEY);
      if (stored) setRecentSearches(JSON.parse(stored));
    } catch {
      // ignore
    }
  }, []);

  const saveRecentSearch = (term: string) => {
    const clean = term.trim();
    if (!clean) return;
    const updated = [clean, ...recentSearches.filter((s) => s.toLowerCase() !== clean.toLowerCase())].slice(0, 8);
    setRecentSearches(updated);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const removeRecentSearch = (term: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = recentSearches.filter((s) => s !== term);
    setRecentSearches(updated);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setQuery('');
      setResults([]);
      setError(null);
    }
  }, [isOpen]);

  // Client-side fallback search when backend is unreachable or local
  const localFallbackSearch = useCallback(
    (q: string, cat: string): SearchResult[] => {
      const s = q.toLowerCase();
      const list: SearchResult[] = [];

      const score = (str?: string) => {
        if (!str) return 0;
        const lower = str.toLowerCase();
        if (lower === s) return 100;
        if (lower.startsWith(s)) return 70;
        if (lower.includes(s)) return 40;
        return 0;
      };

      if (cat === 'all' || cat === 'leads') {
        for (const l of leads || []) {
          const sc = Math.max(score(l.company), score(l.name), score(l.leadCode), score(l.phone));
          if (sc > 0) list.push({ id: l.id, category: 'leads', tab: 'leads', title: l.company || l.name, subtitle: l.leadCode, status: l.status, snippet: l.email || '', score: sc });
        }
      }
      if (cat === 'all' || cat === 'clients') {
        for (const c of clients || []) {
          const sc = Math.max(score(c.companyName), score(c.clientCode), score(c.email));
          if (sc > 0) list.push({ id: c.id, category: 'clients', tab: 'clients', title: c.companyName, subtitle: c.clientCode, status: c.status, snippet: c.phone || '', score: sc });
        }
      }
      if (cat === 'all' || cat === 'employees') {
        for (const e of employees || []) {
          const empAny = e as any;
          const sc = Math.max(score(e.name), score(e.employeeId), score(e.email), score(empAny.designation || empAny.designationId));
          if (sc > 0) list.push({ id: e.id, category: 'employees', tab: 'employees', title: e.name, subtitle: `${e.employeeId} • ${empAny.designation || e.role}`, status: empAny.status || 'Active', snippet: empAny.department || e.departmentId || '', score: sc });
        }
      }
      if (cat === 'all' || cat === 'projects') {
        for (const p of projects || []) {
          const prjAny = p as any;
          const sc = Math.max(score(p.name), score(p.projectCode), score(p.description));
          if (sc > 0) list.push({ id: p.id, category: 'projects', tab: 'projects', title: p.name, subtitle: p.projectCode, status: p.status, snippet: prjAny.clientName || p.description || '', score: sc });
        }
      }
      if (cat === 'all' || cat === 'tasks') {
        for (const t of tasks || []) {
          const sc = Math.max(score(t.title), score(t.taskCode), score(t.description));
          if (sc > 0) list.push({ id: t.id, category: 'tasks', tab: 'task_operations', title: t.title, subtitle: t.taskCode, status: t.status, snippet: t.dueDate ? `Due: ${t.dueDate}` : '', score: sc });
        }
      }
      if (cat === 'all' || cat === 'invoices') {
        for (const inv of invoices || []) {
          const invAny = inv as any;
          const sc = Math.max(score(inv.invoiceNumber), score(invAny.clientName));
          if (sc > 0) list.push({ id: inv.id, category: 'invoices', tab: 'billing', title: inv.invoiceNumber, subtitle: `₹${inv.totalAmount || 0}`, status: inv.status, snippet: invAny.clientName || inv.issueDate || '', score: sc });
        }
      }
      if (cat === 'all' || cat === 'quotations') {
        for (const qn of quotations || []) {
          const qnAny = qn as any;
          const sc = Math.max(score(qn.quotationNumber), score(qnAny.clientName), score(qn.title));
          if (sc > 0) list.push({ id: qn.id, category: 'quotations', tab: 'deals_quotations', title: qn.quotationNumber, subtitle: `₹${qn.total || 0}`, status: (qn as any).status || 'Sent', snippet: qn.title || qnAny.clientName || '', score: sc });
        }
      }
      if (cat === 'all' || cat === 'contracts') {
        for (const ag of agreements || []) {
          const agAny = ag as any;
          const sc = Math.max(score(ag.agreementNumber), score(ag.title), score(agAny.clientName));
          if (sc > 0) list.push({ id: ag.id, category: 'contracts', tab: 'deals_agreements', title: ag.agreementNumber || ag.title, subtitle: agAny.clientName || '', status: ag.status, snippet: ag.title || '', score: sc });
        }
      }
      if (cat === 'all' || cat === 'expenses') {
        for (const ex of expenses || []) {
          const exAny = ex as any;
          const sc = Math.max(score(ex.expenseCode), score(ex.category), score(ex.title));
          if (sc > 0) list.push({ id: ex.id, category: 'expenses', tab: 'expenses', title: ex.expenseCode || ex.title, subtitle: `₹${ex.amount || 0}`, status: exAny.status || 'Logged', snippet: ex.category || '', score: sc });
        }
      }

      list.sort((a, b) => b.score - a.score);
      return list;
    },
    [leads, clients, employees, projects, tasks, invoices, quotations, agreements, expenses]
  );

  // Debounced search
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setCategories({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        const url = `/search?q=${encodeURIComponent(q)}&category=${encodeURIComponent(activeCategory)}&limit=40`;
        const res = await authFetch(url);

        if (res.ok && res.data) {
          setResults(res.data.results || []);
          setCategories(res.data.categories || {});
          setSelectedIndex(0);
        } else {
          // Fall back to client data
          const fallback = localFallbackSearch(q, activeCategory);
          setResults(fallback);
          setSelectedIndex(0);
        }
      } catch {
        const fallback = localFallbackSearch(q, activeCategory);
        setResults(fallback);
        setSelectedIndex(0);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, activeCategory, localFallbackSearch]);

  const handleSelectResult = (item: SearchResult) => {
    saveRecentSearch(query || item.title);
    onClose();
    navigate(item.tab, { id: item.id });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
      scrollSelectedIntoView(selectedIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      scrollSelectedIntoView(selectedIndex - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelectResult(results[selectedIndex]);
      }
    }
  };

  const scrollSelectedIntoView = (index: number) => {
    const container = listRef.current;
    if (!container) return;
    const items = container.querySelectorAll('.search-result-item');
    if (items[index]) {
      items[index].scrollIntoView({ block: 'nearest' });
    }
  };

  // Match highlighting helper
  const renderHighlighted = (text?: string) => {
    if (!text) return null;
    if (!query.trim()) return text;
    const q = query.trim().toLowerCase();
    const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === q ? (
            <mark key={i} style={{ background: '#FFF1C6', color: '#725207', borderRadius: 2, padding: '0 2px' }}>
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
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
        alignItems: 'flex-start',
        paddingTop: '80px',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '720px',
          background: '#FFFFFF',
          borderRadius: '14px',
          boxShadow: '0 20px 40px rgba(11, 23, 56, 0.25)',
          border: '1px solid #E5E7EB',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '80vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header / Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid #E5E7EB',
            gap: '12px',
          }}
        >
          <Icon name="search" size={20} />
          <input
            ref={inputRef}
            placeholder="Search leads, clients, employees, tasks, invoices, docs (Ctrl+K)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: '15px',
              color: '#111827',
              background: 'transparent',
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#98A0AD',
                cursor: 'pointer',
                padding: '4px',
              }}
              title="Clear search"
            >
              ✕
            </button>
          )}
          <span
            style={{
              fontSize: '11px',
              color: '#667085',
              background: '#F1F4FA',
              padding: '3px 7px',
              borderRadius: '5px',
              fontWeight: 600,
            }}
          >
            ESC to close
          </span>
        </div>

        {/* Categories Bar */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            padding: '10px 18px',
            background: '#F8F9FB',
            borderBottom: '1px solid #E5E7EB',
            overflowX: 'auto',
          }}
        >
          {CATEGORIES.map((cat) => {
            const count = cat.id === 'all' ? undefined : categories[cat.id];
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  padding: '5px 11px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: isActive ? 700 : 500,
                  border: isActive ? '1px solid #0B1738' : '1px solid #E5E7EB',
                  background: isActive ? '#0B1738' : '#FFFFFF',
                  color: isActive ? '#FFFFFF' : '#475467',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <span>{cat.label}</span>
                {count !== undefined && count > 0 && (
                  <span
                    style={{
                      fontSize: '10px',
                      background: isActive ? 'rgba(255,255,255,0.25)' : '#E5E7EB',
                      padding: '1px 5px',
                      borderRadius: '10px',
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Results Area */}
        <div ref={listRef} style={{ overflowY: 'auto', flex: 1, padding: '8px 12px' }}>
          {loading && (
            <div style={{ padding: '36px', textAlign: 'center', color: '#667085', fontSize: '13px' }}>
              Searching enterprise records across AgencyOS...
            </div>
          )}

          {!loading && !query && recentSearches.length > 0 && (
            <div style={{ padding: '12px 10px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#8993A4', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.8px' }}>
                Recent Searches
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {recentSearches.map((term) => (
                  <div
                    key={term}
                    onClick={() => setQuery(term)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      background: '#F1F4FA',
                      fontSize: '12px',
                      color: '#0B1738',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    <span>{term}</span>
                    <span
                      onClick={(e) => removeRecentSearch(term, e)}
                      style={{ color: '#98A0AD', fontSize: '11px' }}
                      title="Remove"
                    >
                      ✕
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>
                No records found matching "{query}"
              </div>
              <div style={{ fontSize: '12px', color: '#667085' }}>
                Try searching by client name, code, contact phone, employee name, or invoice number.
              </div>
            </div>
          )}

          {!loading &&
            results.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={`${item.category}-${item.id}`}
                  className="search-result-item"
                  onClick={() => handleSelectResult(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: isSelected ? '#F1F4FA' : 'transparent',
                    borderLeft: isSelected ? '3px solid #F5B82E' : '3px solid transparent',
                    marginBottom: '4px',
                    transition: 'background 0.1s ease',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          textTransform: 'uppercase',
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: '#EAEFF8',
                          color: '#2458A6',
                        }}
                      >
                        {item.category}
                      </span>
                      <strong style={{ fontSize: '13px', color: '#111827' }}>
                        {renderHighlighted(item.title)}
                      </strong>
                      {item.status && (
                        <span
                          style={{
                            fontSize: '10px',
                            padding: '2px 6px',
                            borderRadius: '10px',
                            background: '#F0F1F4',
                            color: '#475467',
                            fontWeight: 600,
                          }}
                        >
                          {item.status}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#667085', display: 'flex', gap: '10px' }}>
                      {item.subtitle && <span>{renderHighlighted(item.subtitle)}</span>}
                      {item.snippet && <span>{renderHighlighted(item.snippet)}</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#2458A6', fontWeight: 600 }}>Open &rarr;</span>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '10px 18px',
            background: '#FAFBFC',
            borderTop: '1px solid #E5E7EB',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
            color: '#667085',
          }}
        >
          <span>Use &uarr; &darr; to navigate, Enter to open, Esc to dismiss</span>
          <span>Role-aware results for {currentRole}</span>
        </div>
      </div>
    </div>
  );
};
