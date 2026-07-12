import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../components/ui';
import { uid } from '../utils';
import { store, KEYS } from '../storage';
import { NetworkManager } from '../network/NetworkManager';
import { logError } from '../log';

const WORLD = 8000;
const HALF = WORLD / 2;
const MIN_SCALE = 0.05;
const MAX_SCALE = 6;

interface Stroke {
  id: string;
  c: string;
  w: number;
  pts: number[];
}

type Tool = 'draw' | 'move' | 'erase';

const COLORS = ['#FFFFFF', '#111111', '#E05B5B', '#E8933A', '#D9B84A', '#5BBF7A', '#4AA8D9', '#7B6BE8', '#E87BA8', '#8B5A2B', '#9AA5B1', '#DAA520'];
const WIDTHS = [1, 3, 6, 12, 15];

const strokePath = (pts: number[]): string => {
  if (pts.length < 2) return '';
  let d = `M ${pts[0]} ${pts[1]}`;
  if (pts.length === 2) d += ` L ${pts[0] + 0.1} ${pts[1] + 0.1}`;
  for (let i = 2; i < pts.length; i += 2) d += ` L ${pts[i]} ${pts[i + 1]}`;
  return d;
};

export default function WhiteboardView() {
  const { t } = useTranslation();
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [current, setCurrent] = useState<Stroke | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[2]);
  const [tool, setTool] = useState<Tool>('draw');
  const [view, setView] = useState({ tx: 0, ty: 0, scale: 0.5 });
  const [confirmClear, setConfirmClear] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;
  const currentRef = useRef<Stroke | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const colorRef = useRef(color);
  colorRef.current = color;
  const widthRef = useRef(width);
  widthRef.current = width;
  const panStartRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  useEffect(() => {
    store.get<Stroke[]>(KEYS.whiteboard, []).then(saved => {
      if (saved && Array.isArray(saved)) setStrokes(saved.filter(s => s && Array.isArray(s.pts) && s.pts.length >= 2));
    });
  }, []);

  const persist = useCallback((next: Stroke[]) => {
    store.set(KEYS.whiteboard, next).then(() => NetworkManager.notifyDataChanged()).catch(e => logError('whiteboard', e));
  }, []);

  const toWorld = (clientX: number, clientY: number): [number, number] => {
    const el = wrapRef.current;
    const v = viewRef.current;
    if (!el) return [0, 0];
    const r = el.getBoundingClientRect();
    return [
      (clientX - r.left - r.width / 2 - v.tx) / v.scale,
      (clientY - r.top - r.height / 2 - v.ty) / v.scale,
    ];
  };

  const clampWorld = (v: number) => Math.max(-HALF + 20, Math.min(HALF - 20, Math.round(v)));

  const eraseAt = (wx: number, wy: number) => {
    const radius = widthRef.current;
    const survivors = strokesRef.current.filter(s => {
      for (let i = 0; i < s.pts.length; i += 2) {
        if (Math.hypot(s.pts[i] - wx, s.pts[i + 1] - wy) < radius + s.w / 2) return false;
      }
      return true;
    });
    if (survivors.length !== strokesRef.current.length) setStrokes(survivors);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const [wx, wy] = toWorld(e.clientX, e.clientY);
    const middlePan = e.button === 1;
    if (middlePan || toolRef.current === 'move') {
      panStartRef.current = { x: e.clientX, y: e.clientY, tx: viewRef.current.tx, ty: viewRef.current.ty };
      return;
    }
    if (toolRef.current === 'erase') {
      eraseAt(wx, wy);
      panStartRef.current = null;
      currentRef.current = { id: '__erasing__', c: '', w: 0, pts: [] };
      return;
    }
    currentRef.current = { id: uid(), c: colorRef.current, w: widthRef.current, pts: [clampWorld(wx), clampWorld(wy)] };
    setCurrent(currentRef.current);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (panStartRef.current) {
      const p = panStartRef.current;
      setView(v => ({ ...v, tx: p.tx + (e.clientX - p.x), ty: p.ty + (e.clientY - p.y) }));
      return;
    }
    const cur = currentRef.current;
    if (!cur) return;
    const [wx, wy] = toWorld(e.clientX, e.clientY);
    if (cur.id === '__erasing__') {
      eraseAt(wx, wy);
      return;
    }
    const cx = clampWorld(wx);
    const cy = clampWorld(wy);
    const n = cur.pts.length;
    const minStep = Math.max(1, 1.5 / viewRef.current.scale);
    if (Math.hypot(cx - cur.pts[n - 2], cy - cur.pts[n - 1]) >= minStep) {
      currentRef.current = { ...cur, pts: [...cur.pts, cx, cy] };
      setCurrent(currentRef.current);
    }
  };

  const onPointerUp = () => {
    if (panStartRef.current) {
      panStartRef.current = null;
      return;
    }
    const cur = currentRef.current;
    currentRef.current = null;
    if (cur && cur.id === '__erasing__') {
      persist(strokesRef.current);
      return;
    }
    if (cur && cur.pts.length >= 2) {
      const next = [...strokesRef.current, cur];
      setStrokes(next);
      setCurrent(null);
      persist(next);
    } else {
      setCurrent(null);
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.9;
    setView(v => ({ ...v, scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor)) }));
  };

  const undo = () => {
    if (strokesRef.current.length === 0) return;
    const next = strokesRef.current.slice(0, -1);
    setStrokes(next);
    persist(next);
  };

  const paths = useMemo(() => strokes.map(s => ({ id: s.id, d: strokePath(s.pts), c: s.c, w: s.w })), [strokes]);
  const currentPath = current ? strokePath(current.pts) : '';

  const toolBtn = (id: Tool, glyph: string, label: string) => (
    <button key={id} className="chip" aria-pressed={tool === id} aria-label={label} title={label}
      style={{
        borderColor: tool === id ? 'var(--accent)' : 'var(--border)',
        background: tool === id ? 'color-mix(in srgb, var(--accent) 18%, transparent)' : 'var(--surface)',
        color: tool === id ? 'var(--accent)' : 'var(--dim)',
        fontSize: 14,
      }}
      onClick={() => setTool(id)}>
      {glyph}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 480 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {toolBtn('draw', '✎', t('whiteboard.draw'))}
        {toolBtn('move', '✥', t('whiteboard.move'))}
        {toolBtn('erase', '⌫', t('whiteboard.erase'))}
        <span style={{ width: 1, height: 22, background: 'var(--border)' }} aria-hidden />
        {WIDTHS.map(wd => (
          <button key={wd} className="chip" aria-pressed={width === wd} aria-label={`${t('whiteboard.brushSize')} ${wd}`} title={`${t('whiteboard.brushSize')} ${wd}`}
            style={{ borderColor: width === wd ? 'var(--accent)' : 'var(--border)', background: 'var(--surface)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 15, padding: 0 }}
            onClick={() => setWidth(wd)}>
            <span aria-hidden style={{ width: wd + 4, height: wd + 4, borderRadius: '50%', background: color, display: 'inline-block' }} />
          </button>
        ))}
        <span style={{ width: 1, height: 22, background: 'var(--border)' }} aria-hidden />
        {COLORS.map(c => (
          <button key={c} className="chip" aria-pressed={color === c} aria-label={`${t('whiteboard.penColor')} ${c}`} title={c}
            style={{ width: 22, height: 22, borderRadius: 11, padding: 0, background: c, borderWidth: color === c ? 3 : 1, borderStyle: 'solid', borderColor: color === c ? 'var(--accent)' : 'var(--border)' }}
            onClick={() => setColor(c)} />
        ))}
        <span style={{ flex: 1 }} />
        <button className="btn btn--ghost" aria-label={t('whiteboard.undo')} title={t('whiteboard.undo')} onClick={undo} disabled={strokes.length === 0}>↩</button>
        <button className="btn btn--ghost" aria-label={t('systemMap.zoomIn')} title={t('systemMap.zoomIn')} onClick={() => setView(v => ({ ...v, scale: Math.min(MAX_SCALE, v.scale * 1.25) }))}>＋</button>
        <button className="btn btn--ghost" aria-label={t('systemMap.zoomOut')} title={t('systemMap.zoomOut')} onClick={() => setView(v => ({ ...v, scale: Math.max(MIN_SCALE, v.scale * 0.8) }))}>－</button>
        <button className="btn btn--danger" aria-label={t('whiteboard.clear')} onClick={() => setConfirmClear(true)}>🗑</button>
      </div>

      <div
        ref={wrapRef}
        role="img"
        aria-label={t('whiteboard.title')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
        style={{ flex: 1, overflow: 'hidden', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, cursor: tool === 'move' ? 'grab' : tool === 'erase' ? 'cell' : 'crosshair', touchAction: 'none' }}>
        <svg width="100%" height="100%">
          <g transform={`translate(${(wrapRef.current?.clientWidth || 0) / 2 + view.tx}, ${(wrapRef.current?.clientHeight || 0) / 2 + view.ty}) scale(${view.scale})`}>
            <path d={`M ${-HALF} ${-HALF} H ${HALF} V ${HALF} H ${-HALF} Z`} fill="none" stroke="var(--border)" strokeWidth={2 / view.scale} />
            {paths.map(p => (
              <path key={p.id} d={p.d} stroke={p.c} strokeWidth={p.w} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            ))}
            {currentPath ? (
              <path d={currentPath} stroke={current!.c} strokeWidth={current!.w} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            ) : null}
          </g>
        </svg>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title={t('whiteboard.clearTitle')}
        message={t('whiteboard.clearMsg')}
        danger
        onConfirm={() => { setConfirmClear(false); setStrokes([]); persist([]); }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
