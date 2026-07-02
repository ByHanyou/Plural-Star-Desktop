import React, { useState, useRef, useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';
import './ui.css';

// Spread onto a non-<button> element that acts as a button, so keyboard users can
// operate it (Enter/Space) and screen readers announce it as a button (WCAG 2.1.1 / 4.1.2).
export const clickable = (onClick?: () => void, label?: string) => ({
  role: 'button' as const,
  tabIndex: 0,
  ...(label ? { 'aria-label': label } : {}),
  onClick,
  onKeyDown: (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && onClick) { e.preventDefault(); onClick(); }
  },
});

// Close a modal/dialog on Escape while it's open.
export function useEscapeKey(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onEscape(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [active, onEscape]);
}

type BtnVariant = 'primary' | 'ghost' | 'danger' | 'solid' | 'info';

export function Btn({ children, onClick, variant = 'primary', disabled = false, className = '' }: {
  children: React.ReactNode; onClick: () => void; variant?: BtnVariant; disabled?: boolean; className?: string;
}) {
  return (
    <button className={`btn btn--${variant} ${disabled ? 'btn--disabled' : ''} ${className}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}


export function Field({ label, value, onChange, placeholder, multiline = false, type = 'text', mono = false }: {
  label?: string; value: string; onChange: (v: string) => void; placeholder?: string;
  multiline?: boolean; type?: string; mono?: boolean;
}) {
  const id = useId();
  return (
    <div className="field">
      {label && <label className="field__label" htmlFor={id}>{label}</label>}
      {multiline ? (
        <textarea id={id} aria-label={label ? undefined : placeholder} className="field__input field__input--multi" value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} rows={4} />
      ) : (
        <input id={id} aria-label={label ? undefined : placeholder} className={`field__input ${mono ? 'field__input--mono' : ''}`} type={type} value={value}
          onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      )}
    </div>
  );
}


export function Toggle({ value, onChange, label, description }: {
  value: boolean; onChange: (v: boolean) => void; label: string; description?: string;
}) {
  return (
    <div className="toggle-row">
      <div className="toggle-row__text">
        <span className="toggle-row__label">{label}</span>
        {description && <span className="toggle-row__desc">{description}</span>}
      </div>
      <button className={`toggle ${value ? 'toggle--on' : ''}`} onClick={() => onChange(!value)}>
        <span className="toggle__knob" />
      </button>
    </div>
  );
}


export function Section({ label, color }: { label: string; color?: string }) {
  return (
    <div className="section-div">
      <span className="section-div__dot" style={{ background: color || 'var(--accent)' }} />
      <span className="section-div__label" style={{ color: color || 'var(--accent)' }}>{label}</span>
      <span className="section-div__line" />
    </div>
  );
}


export function Dropdown<T extends string>({ value, options, onChange, label, renderOption }: {
  value: T; options: T[]; onChange: (v: T) => void; label?: string;
  renderOption?: (v: T) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const display = renderOption || ((v: T) => v);

  return (
    <div className="dropdown" ref={ref}>
      {label && <label className="field__label">{label}</label>}
      <button className={`dropdown__trigger ${open ? 'dropdown__trigger--open' : ''}`} onClick={() => setOpen(!open)}>
        <span>{display(value)}</span>
        <span className="dropdown__arrow">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="dropdown__menu">
          {options.map(opt => (
            <button key={opt} className={`dropdown__item ${opt === value ? 'dropdown__item--active' : ''}`}
              onClick={() => { onChange(opt); setOpen(false); }}>
              {display(opt)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


export function ChipList({ items, onRemove, color = 'var(--info)' }: {
  items: string[]; onRemove: (item: string) => void; color?: string;
}) {
  return (
    <div className="chip-list">
      {items.map(item => (
        <button key={item} className="chip" style={{ borderColor: `${color}50`, background: `${color}18` }} onClick={() => onRemove(item)}>
          <span style={{ color }}>{item}</span>
          <span className="chip__x">✕</span>
        </button>
      ))}
    </div>
  );
}


export function AddRow({ value, onChange, onAdd, placeholder }: {
  value: string; onChange: (v: string) => void; onAdd: () => void; placeholder?: string;
}) {
  return (
    <div className="add-row">
      <input className="field__input" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAdd(); } }} />
      <Btn onClick={onAdd}>Add</Btn>
    </div>
  );
}


function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return { h: 0, s: 0, v: 80 };
  const int = parseInt(m[1], 16);
  const r = ((int >> 16) & 255) / 255, g = ((int >> 8) & 255) / 255, b = (int & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : (d / max) * 100;
  return { h, s, v: max * 100 };
}

function hsvToHex(h: number, s: number, v: number): string {
  h = ((h % 360) + 360) % 360;
  s /= 100; v /= 100;
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
  const to = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

export function ColorPicker({ value, onChange, palette }: {
  value: string; onChange: (v: string) => void; palette: string[];
}) {
  const [hex, setHex] = useState(value);
  const [error, setError] = useState(false);
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<'sv' | 'hue' | null>(null);
  const hsvRef = useRef(hsv);
  hsvRef.current = hsv;
  // the exact hex we last emitted, so we ignore the parent echoing it back
  const lastHexRef = useRef(value.toUpperCase());

  // adopt an external/typed hex, preserving hue (and saturation for black) that an
  // achromatic hex can't represent — stops the hue snapping to red on gray/white/black
  const adopt = (n: string) => {
    const nh = hexToHsv(n);
    const prev = hsvRef.current;
    const merged = {
      h: nh.s === 0 ? prev.h : nh.h,
      s: (nh.s === 0 && nh.v === 0) ? prev.s : nh.s,
      v: nh.v,
    };
    hsvRef.current = merged;
    setHsv(merged);
    lastHexRef.current = n.toUpperCase();
  };

  useEffect(() => {
    if (!/^#[0-9A-Fa-f]{6}$/.test(value)) return;
    setHex(value);
    if (value.toUpperCase() === lastHexRef.current) return; // our own echo — ignore
    adopt(value);
  }, [value]);

  const commit = (h: number, s: number, v: number) => {
    const nx = hsvToHex(h, s, v);
    setHsv({ h, s, v }); setHex(nx); setError(false);
    lastHexRef.current = nx.toUpperCase();
    onChange(nx);
  };

  const onSvPointer = (e: { clientX: number; clientY: number }) => {
    const el = svRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    commit(hsvRef.current.h, x * 100, (1 - y) * 100);
  };
  const onHuePointer = (e: { clientX: number }) => {
    const el = hueRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    commit(x * 360, hsvRef.current.s, hsvRef.current.v);
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (dragRef.current === 'sv') onSvPointer(e);
      else if (dragRef.current === 'hue') onHuePointer(e);
    };
    const up = () => { dragRef.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, []);

  const handleHex = (v: string) => {
    setHex(v);
    const n = v.startsWith('#') ? v : `#${v}`;
    if (/^#[0-9A-Fa-f]{6}$/.test(n)) {
      adopt(n); onChange(n.toUpperCase()); setError(false);
    } else { setError(v.length > 1); }
  };

  const onSvKey = (e: React.KeyboardEvent) => {
    const { h, s, v } = hsvRef.current;
    let ns = s, nv = v;
    if (e.key === 'ArrowLeft') ns = Math.max(0, s - 2);
    else if (e.key === 'ArrowRight') ns = Math.min(100, s + 2);
    else if (e.key === 'ArrowUp') nv = Math.min(100, v + 2);
    else if (e.key === 'ArrowDown') nv = Math.max(0, v - 2);
    else return;
    e.preventDefault();
    commit(h, ns, nv);
  };
  const onHueKey = (e: React.KeyboardEvent) => {
    const { h, s, v } = hsvRef.current;
    let nh = h;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') nh = (h - 5 + 360) % 360;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') nh = (h + 5) % 360;
    else return;
    e.preventDefault();
    commit(nh, s, v);
  };

  const hueColor = hsvToHex(hsv.h, 100, 100);
  return (
    <div className="color-picker">
      <div className="color-picker__spectrum">
        <div ref={svRef} className="color-picker__sv" role="slider" aria-label="Color" aria-valuetext={value}
          tabIndex={0} onKeyDown={onSvKey}
          style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})` }}
          onPointerDown={e => { dragRef.current = 'sv'; onSvPointer(e); }}>
          <div className="color-picker__thumb" style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%`, background: value }} />
        </div>
        <div ref={hueRef} className="color-picker__hue" role="slider" aria-label="Hue" aria-valuetext={`${Math.round(hsv.h)}`}
          tabIndex={0} onKeyDown={onHueKey}
          onPointerDown={e => { dragRef.current = 'hue'; onHuePointer(e); }}>
          <div className="color-picker__hue-thumb" style={{ left: `${(hsv.h / 360) * 100}%`, background: hueColor }} />
        </div>
      </div>
      <div className="color-picker__row">
        <div className="color-picker__preview" style={{ background: value }} />
        <input className={`field__input field__input--mono ${error ? 'field__input--error' : ''}`}
          value={hex} onChange={e => handleHex(e.target.value)} placeholder="#C9A96E" maxLength={7}
          style={{ width: 100 }} />
      </div>
      <div className="color-picker__swatches">
        {palette.map(c => (
          <button key={c} className={`color-picker__swatch ${c === value ? 'color-picker__swatch--active' : ''}`}
            style={{ background: c }} onClick={() => { adopt(c); setHex(c); onChange(c); setError(false); }} />
        ))}
      </div>
    </div>
  );
}


export function Modal({ open, title, onClose, footer, children }: {
  open: boolean; title: string; onClose: () => void; footer?: React.ReactNode; children: React.ReactNode;
}) {
  useEscapeKey(open, onClose);
  if (!open) return null;
  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal" role="presentation" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <span className="modal__title">{title}</span>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>
  );
}


export function ConfirmDialog({ open, title, message, onConfirm, onCancel, danger = false }: {
  open: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void; danger?: boolean;
}) {
  const { t } = useTranslation();
  useEscapeKey(open, onCancel);
  if (!open) return null;
  return (
    <div className="modal-overlay" role="presentation" onClick={onCancel}>
      <div className="modal modal--sm" role="presentation" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <span className="modal__title">{title}</span>
        </div>
        <div className="modal__body">
          <p style={{ color: 'var(--dim)', fontSize: 13, lineHeight: 1.5 }}>{message}</p>
        </div>
        <div className="modal__footer">
          <Btn variant="ghost" onClick={onCancel}>{t('common.cancel')}</Btn>
          <Btn variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{t('common.confirm')}</Btn>
        </div>
      </div>
    </div>
  );
}
