import React, { useState, useRef, useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { clamp } from '../utils';
import { tint } from '../theme';
import { PICKER_KIND_ORDER, pickerKindLabel } from '../picker/memberPicker';
import type { PickerKinds } from '../picker/memberPicker';
import { sidePictureSnippet } from '../markdown/parse';
import { SrOnly, tabListKeyDown, useEscapeKey } from './a11y';

export function TabBar<T extends string>({ tabs, value, onChange, label, style, tabPadding = '10px 20px' }: {
  tabs: readonly T[]; value: T; onChange: (tab: T) => void; label: (tab: T) => string; style?: React.CSSProperties; tabPadding?: string;
}) {
  return (
    <div role="tablist" style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid var(--border)', ...style }}>
      {tabs.map(tab => (
        <button key={tab} type="button" role="tab" aria-selected={value === tab} onClick={() => onChange(tab)} onKeyDown={tabListKeyDown} style={{
          padding: tabPadding, fontSize: 13, fontWeight: value === tab ? 600 : 400, cursor: 'pointer',
          color: value === tab ? 'var(--accent)' : 'var(--dim)', background: 'none', border: 'none',
          borderBottom: `2px solid ${value === tab ? 'var(--accent)' : 'transparent'}`,
        }}>
          {label(tab)}
        </button>
      ))}
    </div>
  );
}

type BtnVariant = 'primary' | 'ghost' | 'danger' | 'solid' | 'info';

export function Btn({ children, onClick, variant = 'primary', disabled = false, className = '', ...rest }: {
  children: React.ReactNode; onClick: () => void; variant?: BtnVariant; disabled?: boolean; className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`btn btn--${variant} ${disabled ? 'btn--disabled' : ''} ${className}`} onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  );
}

export function Field({ label, ariaLabel, value, onChange, placeholder, multiline = false, type = 'text', mono = false, pictureTools = false }: {
  label?: string; ariaLabel?: string; value: string; onChange: (v: string) => void; placeholder?: string;
  multiline?: boolean; type?: string; mono?: boolean; pictureTools?: boolean;
}) {
  const id = useId();
  const { t } = useTranslation();
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const selRef = useRef<number | null>(null);
  const insertSidePicture = (side: 'left' | 'right') => {
    const at = selRef.current == null ? value.length : clamp(selRef.current, 0, value.length);
    const prior = value.slice(0, at);
    const rest = value.slice(at);
    const snippet = sidePictureSnippet(prior, rest, side, t('editor.urlPlaceholder'), t('editor.textPlaceholder'));
    onChange(prior + snippet + rest);
    const caret = at + snippet.length;
    selRef.current = caret;
    requestAnimationFrame(() => {
      const area = areaRef.current;
      if (!area) return;
      area.focus();
      area.setSelectionRange(caret, caret);
    });
  };
  return (
    <div className="field">
      {label && <label className="field__label" htmlFor={id}>{label}</label>}
      {multiline && pictureTools && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          {(['left', 'right'] as const).map(side => {
            const name = t(side === 'left' ? 'markdown.toolImageLeft' : 'markdown.toolImageRight');
            return (
              <button key={side} type="button" aria-label={name} title={name} onClick={() => insertSidePicture(side)}
                style={{ padding: '2px 8px', fontSize: 12, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--dim)', cursor: 'pointer' }}>
                {side === 'left' ? '🖼≡' : '≡🖼'}
              </button>
            );
          })}
        </div>
      )}
      {multiline ? (
        <textarea ref={areaRef} id={id} aria-label={label ? undefined : (ariaLabel || placeholder)} className="field__input field__input--multi" value={value} onChange={e => onChange(e.target.value)}
          onSelect={pictureTools ? e => { selRef.current = e.currentTarget.selectionEnd; } : undefined}
          placeholder={placeholder} rows={4} />
      ) : (
        <input id={id} aria-label={label ? undefined : (ariaLabel || placeholder)} className={`field__input ${mono ? 'field__input--mono' : ''}`} type={type} value={value}
          onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      )}
    </div>
  );
}

export function Toggle({ value, onChange, label, description, disabled = false }: {
  value: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean;
}) {
  const descId = useId();
  return (
    <div className="toggle-row">
      <div className="toggle-row__text">
        <span className="toggle-row__label">{label}</span>
        {description && <span className="toggle-row__desc" id={descId}>{description}</span>}
      </div>
      <button type="button" className={`toggle ${value ? 'toggle--on' : ''}`} role="switch" aria-checked={value} aria-label={label} aria-describedby={description ? descId : undefined} disabled={disabled} onClick={() => onChange(!value)}>
        <span className="toggle__knob" />
      </button>
    </div>
  );
}

export function KindToggles({ kinds, setKinds }: { kinds: PickerKinds; setKinds: (k: PickerKinds) => void }) {
  const { t } = useTranslation();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 8 }}>
      {PICKER_KIND_ORDER.map(kind => (
        <label key={kind} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: kinds[kind] ? 'var(--text)' : 'var(--dim)', cursor: 'pointer' }}>
          <input type="checkbox" checked={kinds[kind]} onChange={e => setKinds({ ...kinds, [kind]: e.target.checked })} style={{ accentColor: 'var(--accent)', width: 15, height: 15, margin: 0 }} />
          {pickerKindLabel(kind, t)}
        </label>
      ))}
    </div>
  );
}

export function Section({ label, color, id, expanded, onToggle }: { label: string; color?: string; id?: string; expanded?: boolean; onToggle?: () => void }) {
  return (
    <div className="section-div">
      <span className="section-div__dot" aria-hidden style={{ background: color || 'var(--accent)' }} />
      <span className="section-div__label" id={id} role="heading" aria-level={3} style={{ color: color || 'var(--accent)' }}>
        {onToggle ? (
          <button type="button" aria-expanded={!!expanded} onClick={onToggle}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}>
            {label}
            <span aria-hidden style={{ fontSize: 9 }}>{expanded ? '▲' : '▼'}</span>
          </button>
        ) : label}
      </span>
      <span className="section-div__line" aria-hidden />
    </div>
  );
}

export function Dropdown<T extends string>({ value, options, onChange, label, ariaLabel, renderOption, optionStyle }: {
  value: T; options: readonly T[]; onChange: (v: T) => void; label?: string; ariaLabel?: string;
  renderOption?: (v: T) => string;
  optionStyle?: (v: T) => React.CSSProperties | undefined;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEscapeKey(open, () => { setOpen(false); triggerRef.current?.focus(); });

  useEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    const target = menu?.querySelector<HTMLElement>('[aria-selected="true"]') || menu?.querySelector<HTMLElement>('[role="option"]');
    target?.focus({ preventScroll: true });
  }, [open]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="option"]') || []);
    if (items.length === 0) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    let next: number;
    if (e.key === 'ArrowDown') next = i < 0 ? 0 : Math.min(items.length - 1, i + 1);
    else if (e.key === 'ArrowUp') next = i < 0 ? 0 : Math.max(0, i - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    else return;
    e.preventDefault();
    items[next].focus();
  };
  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); setOpen(true); }
  };
  const onContainerBlur = (e: React.FocusEvent) => {
    if (open && !ref.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const display = renderOption || ((v: T) => v);
  const labelId = useId();
  const valueId = useId();

  const named = !!(label || ariaLabel);
  return (
    <div className="dropdown" ref={ref} onBlur={onContainerBlur}>
      {label && <label className="field__label" id={labelId}>{label}</label>}
      {!label && ariaLabel && <SrOnly id={labelId}>{ariaLabel}</SrOnly>}
      <button ref={triggerRef} className={`dropdown__trigger ${open ? 'dropdown__trigger--open' : ''}`} onClick={() => setOpen(!open)} onKeyDown={onTriggerKey}
        aria-haspopup="listbox" aria-expanded={open} aria-labelledby={named ? `${labelId} ${valueId}` : undefined}>
        <span id={valueId}>{display(value)}</span>
        <span className="dropdown__arrow" aria-hidden>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div ref={menuRef} className="dropdown__menu" role="listbox" aria-labelledby={named ? labelId : undefined} onKeyDown={onMenuKey}>
          {options.map(opt => (
            <button key={opt} className={`dropdown__item ${opt === value ? 'dropdown__item--active' : ''}`}
              role="option" aria-selected={opt === value}
              style={optionStyle ? optionStyle(opt) : undefined}
              onClick={() => { onChange(opt); setOpen(false); triggerRef.current?.focus(); }}>
              {display(opt)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const toggleChipStyle = (on: boolean): React.CSSProperties => ({
  borderColor: on ? 'var(--accent)' : 'var(--border)',
  background: on ? tint('var(--accent)', 18) : 'var(--surface)',
  color: on ? 'var(--accent)' : 'var(--dim)',
});

export const linkButton = (color: string, fontSize = 11): React.CSSProperties => ({ fontSize, color, background: 'none', border: 'none', cursor: 'pointer' });

export function CheckRow({ checked, onToggle, label, square = false, children }: {
  checked: boolean; onToggle: () => void; label: string; square?: boolean; children: React.ReactNode;
}) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} onClick={onToggle}
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 4px', background: 'none', border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer' }}>
      <span aria-hidden style={{ width: 18, height: 18, borderRadius: square ? 5 : 9, border: `2px solid ${checked || square ? 'var(--accent)' : 'var(--border)'}`, background: checked ? 'var(--accent)' : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--bg)', fontWeight: 700, flexShrink: 0 }}>
        {checked ? '✓' : ''}
      </span>
      {children}
    </button>
  );
}

export function ChipList({ items, onRemove, color = 'var(--info)' }: {
  items: string[]; onRemove: (item: string) => void; color?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="chip-list">
      {items.map(item => (
        <button key={item} className="chip" aria-label={t('common.removeNamed', { name: item })} style={{ borderColor: tint(color, 31), background: tint(color, 9) }} onClick={() => onRemove(item)}>
          <span style={{ color }}>{item}</span>
          <span className="chip__x" aria-hidden>✕</span>
        </button>
      ))}
    </div>
  );
}

export function AddRow({ value, onChange, onAdd, placeholder, label }: {
  value: string; onChange: (v: string) => void; onAdd: () => void; placeholder?: string; label?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="add-row">
      <input className="field__input" value={value} onChange={e => onChange(e.target.value)} aria-label={label || placeholder}
        placeholder={placeholder} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAdd(); } }} />
      <Btn onClick={onAdd}>{t('common.add')}</Btn>
    </div>
  );
}

export function Hint({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 12px' }}>{children}</p>;
}

export function PageHeading({ children }: { children: React.ReactNode }) {
  return <span role="heading" aria-level={2} style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, fontStyle: 'italic', color: 'var(--text)' }}>{children}</span>;
}

export function EmptyState({ children, padding = 40 }: { children: React.ReactNode; padding?: number }) {
  return <div style={{ textAlign: 'center', padding, color: 'var(--muted)', fontSize: 13 }}>{children}</div>;
}

export type StatusMsg = { msg: string; error: boolean };

export function StatusBanner({ status, style }: { status: StatusMsg | null; style?: React.CSSProperties }) {
  if (!status) return null;
  const tone = status.error ? 'var(--danger)' : 'var(--success)';
  return (
    <div role={status.error ? 'alert' : 'status'} style={{
      borderRadius: 8, fontSize: 13, color: tone, border: `1px solid ${tone}`,
      background: status.error ? 'var(--danger-bg)' : 'var(--success-bg)', ...style,
    }}>
      {status.msg}
    </div>
  );
}
