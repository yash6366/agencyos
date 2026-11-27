// AGENCYOS_V3_OS: enterprise shared building blocks (cards, KPIs, pills, tables, modal, toast, empty state, skeleton)
import React, { useEffect, useState } from 'react';
import { Icon } from './icons';

export const statusClass = (s: string) =>
  /paid|approved|active|completed|verified|won|sent|ready|resolved|present|connected|on time|hired|issued|healthy|on track|signed|joined|done|published|allowed|delivered/i.test(s) ? 'green'
    : /overdue|rejected|blocked|lost|failed|urgent|suspended|critical|denied|missing|rework|escalat/i.test(s) ? 'red'
      : /pending|review|unpaid|follow|progress|partial|draft|due|scheduled|interview|high|screening|attention|awaiting|planned|medium|open/i.test(s) ? 'yellow' : 'blue';

export const Pill: React.FC<{ v: React.ReactNode; tone?: string; dot?: boolean }> = ({ v, tone, dot = true }) => {
  const cls = tone || statusClass(String(v));
  return (
    <span className={`pill ${cls}`}>
      {dot && (
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            backgroundColor: 'currentColor',
            opacity: 0.85,
            display: 'inline-block',
          }}
          aria-hidden="true"
        />
      )}
      <span>{v}</span>
    </span>
  );
};

export const inrS = (v: number) => {
  const a = Math.abs(v || 0), s = v < 0 ? '-' : '';
  if (a >= 1e7) return s + '\u20B9' + (a / 1e7).toFixed(2).replace(/\.?0+$/, '') + 'Cr';
  if (a >= 1e5) return s + '\u20B9' + (a / 1e5).toFixed(2).replace(/\.?0+$/, '') + 'L';
  return s + '\u20B9' + Math.round(a).toLocaleString('en-IN');
};
export const inrF = (v: number) => '\u20B9' + Math.round(v || 0).toLocaleString('en-IN');
export const today = () => new Date().toISOString().slice(0, 10);
export const fmtD = (iso?: string) => {
  if (!iso) return '\u2014';
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
  return isNaN(+d) ? iso : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};
export const pad2 = (n: number) => String(n).padStart(2, '0');
export const initials = (name: string) => (name || '?').split(/\s+/).filter(Boolean).map((x) => x[0]).slice(0, 2).join('').toUpperCase();
export const daysBetween = (a: string, b: string) => Math.round((+new Date(b + 'T00:00:00') - +new Date(a + 'T00:00:00')) / 86400000);

export const Kpi: React.FC<{
  name: string;
  value: React.ReactNode;
  desc: string;
  icon: string;
  trend?: string;
}> = ({ name, value, desc, icon, trend }) => {
  const isDown = trend && trend.startsWith('-');
  return (
    <div className="card kpi group">
      <div className="kpi-top">
        <span className="kpi-name">{name}</span>
        <span className="icon-tile" aria-hidden="true">
          <Icon name={icon} size={17} />
        </span>
      </div>
      <div className="kpi-value tabular-nums">{value}</div>
      <div className="kpi-footer">
        {trend && (
          <span className={`trend-badge ${isDown ? 'trend-down' : 'trend-up'}`}>
            <Icon name={isDown ? 'trendDown' : 'trendUp'} size={12} />
            <span>{trend}</span>
          </span>
        )}
        <span className="kpi-desc">{desc}</span>
      </div>
    </div>
  );
};

export const Rows: React.FC<{
  items: [string, string, string][];
  empty?: string;
  onClick?: (i: number) => void;
}> = ({ items, empty, onClick }) => (
  <>
    {items.length ? (
      items.map((r, i) => (
        <div
          key={i}
          className={`list-row ${onClick ? 'hover-link' : ''}`}
          onClick={onClick ? () => onClick(i) : undefined}
          role={onClick ? 'button' : undefined}
          tabIndex={onClick ? 0 : undefined}
          onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick(i); } : undefined}
        >
          <div>
            <b>{r[0]}</b>
            <small>{r[1]}</small>
          </div>
          <div className="right">
            <Pill v={r[2]} />
          </div>
        </div>
      ))
    ) : (
      <div className="os-empty">{empty || 'Nothing here right now.'}</div>
    )}
  </>
);

export const Bars: React.FC<{
  values: number[];
  labels: string[];
  legend: string;
  note?: string;
}> = ({ values, labels, legend, note }) => {
  const max = Math.max(1, ...values);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <>
      <div className="chart-space">
        <div className="metric-bars" role="img" aria-label={legend}>
          {values.map((v, i) => {
            const pct = Math.max(4, (v / max) * 92);
            return (
              <div
                key={i}
                className="bar-unit"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                title={`${labels[i]}: ${v.toLocaleString('en-IN')}`}
              >
                {hoveredIdx === i && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: `calc(${pct}% + 6px)`,
                      background: '#0B1738',
                      color: '#FFFFFF',
                      padding: '3px 7px',
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                      zIndex: 5,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                    }}
                  >
                    {v.toLocaleString('en-IN')}
                  </div>
                )}
                <div className="bar" style={{ height: `${pct}%` }} />
                <label>{labels[i]}</label>
              </div>
            );
          })}
        </div>
      </div>
      <div className="legend">
        <span><i aria-hidden="true" /> {legend}</span>
        {note && <span className="tabular-nums" style={{ marginLeft: 'auto', fontWeight: 600 }}>{note}</span>}
      </div>
    </>
  );
};

export const Panel: React.FC<{
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}> = ({ title, right, children, style, className }) => (
  <div className={`card panel ${className || ''}`} style={style}>
    <div className="panel-title">
      <h3>{title}</h3>
      {right}
    </div>
    {children}
  </div>
);

export const Activity: React.FC<{
  items: { who: string; title: string; text: string; time: string }[];
}> = ({ items }) => (
  <div className="activity">
    {items.length ? (
      items.map((r, i) => (
        <div key={i} className="activity-item">
          <div className="mini-avatar" aria-hidden="true">{r.who}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <b>{r.title}</b>
            <span>{r.text}</span>
          </div>
          <time className="tabular-nums">{r.time}</time>
        </div>
      ))
    ) : (
      <div className="os-empty">No activity recorded yet.</div>
    )}
  </div>
);

export const Notice: React.FC<{
  icon?: string;
  title?: string;
  children: React.ReactNode;
  neutral?: boolean;
  style?: React.CSSProperties;
}> = ({ icon = 'shield', title, children, neutral = true, style }) => (
  <div className={`notice ${neutral ? 'neutral' : ''}`} style={style} role="status">
    <Icon name={icon} size={18} />
    <div>
      {title && <strong>{title}</strong>}
      {children}
    </div>
  </div>
);

export const EmptyState: React.FC<{
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ icon = 'folder', title, description, action, style }) => (
  <div
    style={{
      padding: '40px 20px',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      ...style,
    }}
  >
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 10,
        background: '#F1F5F9',
        color: '#64748B',
        display: 'grid',
        placeItems: 'center',
        marginBottom: 4,
      }}
      aria-hidden="true"
    >
      <Icon name={icon} size={22} />
    </div>
    <b style={{ fontSize: 13.5, color: '#0F172A', fontWeight: 650 }}>{title}</b>
    {description && (
      <p style={{ margin: 0, fontSize: 12, color: '#64748B', maxWidth: 420, lineHeight: 1.5 }}>
        {description}
      </p>
    )}
    {action && <div style={{ marginTop: 6 }}>{action}</div>}
  </div>
);

export const Skeleton: React.FC<{
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
}> = ({ width = '100%', height = 16, borderRadius = 6, style }) => (
  <div
    className="skeleton"
    style={{
      width,
      height,
      borderRadius,
      ...style,
    }}
    aria-hidden="true"
  />
);

export interface Col<T> {
  h: string;
  v: (r: T) => React.ReactNode;
  s?: (r: T) => string;
  wrap?: boolean;
}

export function DataTable<T>({
  rows,
  cols,
  filters,
  search = true,
  actions,
  empty,
  top,
}: {
  rows: T[];
  cols: Col<T>[];
  filters?: string[];
  search?: boolean;
  actions?: (r: T) => React.ReactNode;
  empty?: string;
  top?: React.ReactNode;
}) {
  const [q, setQ] = useState('');
  const [f, setF] = useState('All');
  const [page, setPage] = useState(0);

  const text = (r: T) => cols.map((c) => (c.s ? c.s(r) : String(c.v(r) ?? ''))).join(' ').toLowerCase();
  const list = rows.filter((r) => (!q || text(r).includes(q.toLowerCase())) && (f === 'All' || text(r).includes(f.toLowerCase())));
  const per = 25;
  const pages = Math.max(1, Math.ceil(list.length / per));
  const pg = Math.min(page, pages - 1);
  const startRecord = list.length === 0 ? 0 : pg * per + 1;
  const endRecord = Math.min((pg + 1) * per, list.length);

  return (
    <div className="card">
      <div className="toolbar">
        <div className="toolbar-left">
          {search && (
            <input
              className="field search-field"
              placeholder="Search records..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              aria-label="Search records"
            />
          )}
          {filters && (
            <div className="filter-chips" role="tablist" aria-label="Table filters">
              {['All', ...filters].map((x) => (
                <button
                  key={x}
                  role="tab"
                  aria-selected={f === x}
                  className={f === x ? 'active' : ''}
                  onClick={() => {
                    setF(x);
                    setPage(0);
                  }}
                >
                  {x}
                </button>
              ))}
            </div>
          )}
          {top}
        </div>
        <span className="muted tabular-nums">
          {list.length} {list.length === 1 ? 'record' : 'records'}
        </span>
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.h} scope="col">{c.h}</th>
              ))}
              {actions && <th scope="col" style={{ textAlign: 'right' }}>Action</th>}
            </tr>
          </thead>
          <tbody>
            {list.length ? (
              list.slice(pg * per, pg * per + per).map((r, i) => (
                <tr key={i}>
                  {cols.map((c) => (
                    <td key={c.h} className={c.wrap ? 'wrap' : ''}>
                      {c.v(r)}
                    </td>
                  ))}
                  {actions && <td style={{ textAlign: 'right' }}>{actions(r)}</td>}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={cols.length + (actions ? 1 : 0)} style={{ padding: 0 }}>
                  <EmptyState
                    icon="search"
                    title={q || f !== 'All' ? 'No matching records found' : (empty || 'No records available')}
                    description={
                      q || f !== 'All'
                        ? 'Try adjusting your search query or switching the filter above.'
                        : 'New records created in this module will appear here automatically.'
                    }
                    action={
                      (q || f !== 'All') ? (
                        <button
                          className="outline-button os-mini"
                          onClick={() => { setQ(''); setF('All'); setPage(0); }}
                        >
                          Clear Filters
                        </button>
                      ) : undefined
                    }
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="table-footer">
        <span className="tabular-nums">
          Showing {startRecord}–{endRecord} of {list.length} records
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setPage(Math.max(0, pg - 1))}
            disabled={pg <= 0}
            aria-label="Previous page"
          >
            Previous
          </button>
          <span style={{ fontSize: 11.5, padding: '0 6px', fontWeight: 600 }} className="tabular-nums">
            {pg + 1} / {pages}
          </span>
          <button
            onClick={() => setPage(Math.min(pages - 1, pg + 1))}
            disabled={pg >= pages - 1}
            aria-label="Next page"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export const OsModal: React.FC<{
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}> = ({ title, onClose, children, footer, wide }) => (
  <div
    className="modal-backdrop"
    onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}
    role="presentation"
  >
    <div
      className="modal"
      style={wide ? { width: 'min(820px, 100%)' } : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="modal-top">
        <b>{title}</b>
        <button
          className="top-icon"
          style={{ width: 28, height: 28, borderRadius: 6 }}
          onClick={onClose}
          aria-label="Close dialog"
        >
          <Icon name="x" size={15} />
        </button>
      </div>
      <div className="modal-body">{children}</div>
      {footer && <div className="modal-footer">{footer}</div>}
    </div>
  </div>
);

// ---- toast notification ----
interface ToastItem {
  id: string;
  msg: string;
  type?: 'success' | 'error' | 'info';
}

let pushToast: (m: string, type?: 'success' | 'error' | 'info') => void = () => undefined;
export const toast = (m: string, type: 'success' | 'error' | 'info' = 'info') => pushToast(m, type);

export const ToastHost: React.FC = () => {
  const [current, setCurrent] = useState<ToastItem | null>(null);

  useEffect(() => {
    pushToast = (msg, type = 'info') => {
      const item = { id: String(Date.now()), msg, type };
      setCurrent(item);
      window.setTimeout(() => {
        setCurrent((prev) => (prev?.id === item.id ? null : prev));
      }, 3200);
    };
  }, []);

  if (!current) return null;

  return (
    <div className="toast" role="alert" aria-live="assertive">
      <Icon
        name={current.type === 'error' ? 'alertCircle' : 'check'}
        size={16}
      />
      <span>{current.msg}</span>
    </div>
  );
};

// ---- form helpers ----
export interface FieldDef {
  k: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'select' | 'textarea';
  options?: string[];
  wide?: boolean;
  required?: boolean;
}

export const FormGrid: React.FC<{
  fields: FieldDef[];
  value: Record<string, any>;
  onChange: (v: Record<string, any>) => void;
}> = ({ fields, value, onChange }) => (
  <div className="form-grid">
    {fields.map((f) => (
      <div
        key={f.k}
        className={`form-group ${f.wide || f.type === 'textarea' ? 'wide' : ''}`}
      >
        <label htmlFor={`field-${f.k}`}>
          {f.label}
          {f.required ? ' *' : ''}
        </label>
        {f.type === 'select' ? (
          <select
            id={`field-${f.k}`}
            value={value[f.k] ?? ''}
            onChange={(e) => onChange({ ...value, [f.k]: e.target.value })}
          >
            <option value="">Select{'\u2026'}</option>
            {(f.options || []).map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        ) : f.type === 'textarea' ? (
          <textarea
            id={`field-${f.k}`}
            value={value[f.k] ?? ''}
            onChange={(e) => onChange({ ...value, [f.k]: e.target.value })}
          />
        ) : (
          <input
            id={`field-${f.k}`}
            type={f.type || 'text'}
            value={value[f.k] ?? ''}
            onChange={(e) => onChange({ ...value, [f.k]: e.target.value })}
          />
        )}
      </div>
    ))}
  </div>
);
