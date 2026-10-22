import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Hsv, clamp, colorName, colorHexToHsv, colorHsvToHex, isValidHex, mergeHsv, normalizeHex } from '../utils';

function hexToHsv(hex: string): Hsv {
  const n = normalizeHex(hex.trim());
  if (!isValidHex(n)) return { h: 0, s: 0, v: 80 };
  const { h, s, v } = colorHexToHsv(n);
  return { h, s: s * 100, v: v * 100 };
}

function hsvToHex(h: number, s: number, v: number): string {
  return colorHsvToHex(h, s / 100, v / 100);
}

export function ColorPicker({ value, onChange, palette }: {
  value: string; onChange: (v: string) => void; palette: readonly string[];
}) {
  const { t } = useTranslation();
  const [hex, setHex] = useState(value);
  const [error, setError] = useState(false);
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<'sv' | 'hue' | null>(null);
  const hsvRef = useRef(hsv);
  hsvRef.current = hsv;
  const lastHexRef = useRef(value.toUpperCase());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const adopt = (n: string) => {
    const merged = mergeHsv(hsvRef.current, hexToHsv(n));
    hsvRef.current = merged;
    setHsv(merged);
    lastHexRef.current = n.toUpperCase();
  };

  useEffect(() => {
    if (!isValidHex(value)) return;
    setHex(value);
    if (value.toUpperCase() === lastHexRef.current) return;
    adopt(value);
  }, [value]);

  const commit = (h: number, s: number, v: number) => {
    const nx = hsvToHex(h, s, v);
    setHsv({ h, s, v }); setHex(nx); setError(false);
    lastHexRef.current = nx.toUpperCase();
    onChangeRef.current(nx);
  };

  const onSvPointer = (e: { clientX: number; clientY: number }) => {
    const el = svRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = clamp((e.clientX - r.left) / r.width, 0, 1);
    const y = clamp((e.clientY - r.top) / r.height, 0, 1);
    commit(hsvRef.current.h, x * 100, (1 - y) * 100);
  };
  const onHuePointer = (e: { clientX: number }) => {
    const el = hueRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = clamp((e.clientX - r.left) / r.width, 0, 1);
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
    const n = normalizeHex(v);
    if (isValidHex(n)) {
      adopt(n); onChange(n); setError(false);
    } else { setError(v.length > 1); }
  };

  const onSvKey = (e: React.KeyboardEvent) => {
    const { h, s, v } = hsvRef.current;
    let ns = s, nv = v;
    if (e.key === 'ArrowLeft') ns = clamp(s - 2, 0, 100);
    else if (e.key === 'ArrowRight') ns = clamp(s + 2, 0, 100);
    else if (e.key === 'ArrowUp') nv = clamp(v + 2, 0, 100);
    else if (e.key === 'ArrowDown') nv = clamp(v - 2, 0, 100);
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
        <div ref={svRef} className="color-picker__sv" role="slider" aria-label={t('modal.color')} aria-valuetext={value} aria-valuenow={Math.round(hsv.v)} aria-valuemin={0} aria-valuemax={100}
          tabIndex={0} onKeyDown={onSvKey}
          style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})` }}
          onPointerDown={e => { dragRef.current = 'sv'; onSvPointer(e); }}>
          <div className="color-picker__thumb" style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%`, background: value }} />
        </div>
        <div ref={hueRef} className="color-picker__hue" role="slider" aria-label={t('modal.hue')} aria-valuetext={`${Math.round(hsv.h)}`} aria-valuenow={Math.round(hsv.h)} aria-valuemin={0} aria-valuemax={360}
          tabIndex={0} onKeyDown={onHueKey}
          onPointerDown={e => { dragRef.current = 'hue'; onHuePointer(e); }}>
          <div className="color-picker__hue-thumb" style={{ left: `${(hsv.h / 360) * 100}%`, background: hueColor }} />
        </div>
      </div>
      <div className="color-picker__row">
        <div className="color-picker__preview" style={{ background: value }} />
        <input className={`field__input field__input--mono ${error ? 'field__input--error' : ''}`}
          value={hex} onChange={e => handleHex(e.target.value)} aria-label={t('modal.color')} placeholder="#C9A96E" maxLength={7}
          style={{ width: 100 }} />
      </div>
      <div className="color-picker__swatches">
        {palette.map(c => (
          <button key={c} className={`color-picker__swatch ${c === value ? 'color-picker__swatch--active' : ''}`}
            aria-label={colorName(c, t)} title={colorName(c, t)} aria-pressed={c === value}
            style={{ background: c }} onClick={() => { adopt(c); setHex(c); onChange(c); setError(false); }} />
        ))}
      </div>
    </div>
  );
}
