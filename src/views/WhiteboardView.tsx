import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../components/ui';
import { ColorCarousel } from '../components/ColorCarousel';
import { uid } from '../utils';
import { store, KEYS } from '../storage';
import { NetworkManager } from '../network/NetworkManager';
import { logError } from '../log';
import { traceEnclosedRegion } from '../floodFill';

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

type ShapeTool = 'line' | 'rect' | 'ellipse';
type Tool = 'draw' | 'move' | 'erase' | 'bucket' | 'poly' | ShapeTool;

const isShapeTool = (tl: Tool): tl is ShapeTool => tl === 'line' || tl === 'rect' || tl === 'ellipse';

/** Shape outlines as plain polyline points, so a committed shape IS an
 *  ordinary stroke: mirrors, sync and older builds render it with no format
 *  change. Closed shapes repeat their first point; the ellipse is a
 *  48-segment approximation. (The polygon tool builds its points click by
 *  click instead — see addPolyVertex.) */
const shapePts = (shape: ShapeTool, x0: number, y0: number, x1: number, y1: number): number[] => {
  if (shape === 'line') return [x0, y0, x1, y1];
  if (shape === 'rect') return [x0, y0, x1, y0, x1, y1, x0, y1, x0, y0];
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const rx = Math.abs(x1 - x0) / 2;
  const ry = Math.abs(y1 - y0) / 2;
  const pts: number[] = [];
  const N = 48;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    pts.push(Math.round(cx + rx * Math.cos(a)), Math.round(cy + ry * Math.sin(a)));
  }
  return pts;
};

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
  const [color, setColor] = useState('#FFFFFF');
  const [width, setWidth] = useState(WIDTHS[2]);
  const [tool, setTool] = useState<Tool>('draw');
  const [view, setView] = useState({ tx: 0, ty: 0, scale: 0.5 });
  const [confirmClear, setConfirmClear] = useState(0);

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
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null);
  // Polygon tool (Paint-style): each click adds a corner, lines connect them.
  // Clicking the first corner again (3+ corners) or double-clicking finishes;
  // the shape commits closed, exactly two corners commit as a line. The
  // in-progress polygon lives in `current` as the preview, with a rubber
  // band to the hovered point.
  const polyPtsRef = useRef<number[] | null>(null);
  const polyIdRef = useRef<string | null>(null);

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

  const cancelPoly = useCallback(() => {
    polyPtsRef.current = null;
    polyIdRef.current = null;
    currentRef.current = null;
    setCurrent(null);
  }, []);

  const finishPoly = () => {
    const pts = polyPtsRef.current;
    polyPtsRef.current = null;
    polyIdRef.current = null;
    currentRef.current = null;
    setCurrent(null);
    if (!pts || pts.length < 4) return;
    // 3+ corners close back to the first; exactly two commit as a line.
    const closed = pts.length >= 6 ? [...pts, pts[0], pts[1]] : pts;
    const s: Stroke = { id: uid(), c: colorRef.current, w: widthRef.current, pts: closed };
    const next = [...strokesRef.current, s];
    setStrokes(next);
    persist(next);
  };

  const addPolyVertex = (wx: number, wy: number, dblClick: boolean): void => {
    const cx = clampWorld(wx);
    const cy = clampWorld(wy);
    const pts = polyPtsRef.current;
    if (!pts) {
      polyPtsRef.current = [cx, cy];
      polyIdRef.current = uid();
      currentRef.current = { id: polyIdRef.current, c: colorRef.current, w: widthRef.current, pts: [cx, cy] };
      setCurrent(currentRef.current);
      return;
    }
    const closeThresh = Math.max(12, 16 / viewRef.current.scale);
    const nearFirst = Math.hypot(cx - pts[0], cy - pts[1]) <= closeThresh;
    if ((nearFirst && pts.length >= 6) || (dblClick && pts.length >= 4)) {
      finishPoly();
      return;
    }
    if (Math.hypot(cx - pts[pts.length - 2], cy - pts[pts.length - 1]) < 1) return;
    polyPtsRef.current = [...pts, cx, cy];
    currentRef.current = { id: polyIdRef.current || uid(), c: colorRef.current, w: widthRef.current, pts: polyPtsRef.current };
    setCurrent(currentRef.current);
  };

  // Leaving the polygon tool abandons the unfinished polygon.
  useEffect(() => {
    if (tool !== 'poly' && polyPtsRef.current) cancelPoly();
  }, [tool, cancelPoly]);

  const eraseAt = (wx: number, wy: number) => {
    const radius = widthRef.current;
    const survivors = strokesRef.current.filter(s => {
      if (s.w === -1) return true;
      for (let i = 0; i < s.pts.length; i += 2) {
        if (Math.hypot(s.pts[i] - wx, s.pts[i + 1] - wy) < radius + Math.max(s.w, 0) / 2) return false;
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
    if (toolRef.current === 'bucket') {
      // Real enclosure detection: all strokes' segments are walls, flood from
      // the tap. Enclosed → fill exactly that region (works across multiple
      // strokes and un-touching endpoints — the old single-stroke polygon
      // test missed those and fell through to painting the whole board).
      // Open → the deliberate background fill, which now only happens when
      // the click genuinely isn't enclosed. On a wall → do nothing.
      const region = traceEnclosedRegion(wx, wy, strokesRef.current);
      if (region === null) return;
      const fill: Stroke = Array.isArray(region)
        ? { id: uid(), c: colorRef.current, w: -2, pts: region }
        : { id: uid(), c: colorRef.current, w: -1, pts: [0, 0, 0, 0] };
      const next = [...strokesRef.current, fill];
      setStrokes(next);
      persist(next);
      return;
    }
    if (toolRef.current === 'poly') {
      addPolyVertex(wx, wy, e.detail >= 2);
      return;
    }
    if (isShapeTool(toolRef.current)) {
      // Anchor corner; the preview stroke is rebuilt from it on every move.
      shapeStartRef.current = { x: clampWorld(wx), y: clampWorld(wy) };
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
    // Polygon rubber band: preview the placed corners plus a segment to the
    // hovered point. Never mutates polyPtsRef — corners are added on click.
    if (toolRef.current === 'poly') {
      const pts = polyPtsRef.current;
      if (!pts) return;
      const [hx, hy] = toWorld(e.clientX, e.clientY);
      currentRef.current = { id: polyIdRef.current || uid(), c: colorRef.current, w: widthRef.current, pts: [...pts, clampWorld(hx), clampWorld(hy)] };
      setCurrent(currentRef.current);
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
    const start = shapeStartRef.current;
    if (start && isShapeTool(toolRef.current)) {
      currentRef.current = { ...cur, pts: shapePts(toolRef.current, start.x, start.y, cx, cy) };
      setCurrent(currentRef.current);
      return;
    }
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
    // The polygon preview lives in `current` between clicks; falling through
    // would commit it on every click (and onPointerLeave routes here too).
    if (toolRef.current === 'poly') return;
    const cur = currentRef.current;
    currentRef.current = null;
    if (cur && cur.id === '__erasing__') {
      persist(strokesRef.current);
      return;
    }
    // A shape that was never dragged out is a click, not a shape: committing
    // it would leave an invisible dot the eraser then has to hunt down.
    const shapeTap = shapeStartRef.current !== null && cur !== null && cur.pts.length <= 2;
    shapeStartRef.current = null;
    if (cur && cur.pts.length >= 2 && !shapeTap) {
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
        {toolBtn('line', '╱', t('whiteboard.shapeLine'))}
        {toolBtn('rect', '▭', t('whiteboard.shapeRect'))}
        {toolBtn('ellipse', '◯', t('whiteboard.shapeEllipse'))}
        {toolBtn('poly', '⬠', t('whiteboard.shapePoly'))}
        <span style={{ width: 1, height: 22, background: 'var(--border)' }} aria-hidden />
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', alignItems: 'center', flexShrink: 1 }}>
        {WIDTHS.map(wd => (
          <button key={wd} className="chip" aria-pressed={width === wd} aria-label={`${t('whiteboard.brushSize')} ${wd}`} title={`${t('whiteboard.brushSize')} ${wd}`}
            style={{ borderColor: width === wd ? 'var(--accent)' : 'var(--border)', background: 'var(--surface)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, minWidth: 30, borderRadius: 15, padding: 0 }}
            onClick={() => setWidth(wd)}>
            <span aria-hidden style={{ width: wd + 4, height: wd + 4, borderRadius: '50%', background: color, display: 'inline-block' }} />
          </button>
        ))}
        <button className="chip" aria-pressed={tool === 'bucket'} aria-label={t('whiteboard.bucket', {defaultValue: 'Fill bucket'})} title={t('whiteboard.bucket', {defaultValue: 'Fill bucket'})}
          style={{ borderColor: tool === 'bucket' ? 'var(--accent)' : 'var(--border)', background: tool === 'bucket' ? 'var(--accent-bg)' : 'var(--surface)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, minWidth: 30, borderRadius: 15, padding: 0 }}
          onClick={() => setTool('bucket')}>🪣</button>
        </div>
        <span style={{ width: 1, height: 22, background: 'var(--border)' }} aria-hidden />
        <div style={{ flex: 1, minWidth: 0 }}>
          <ColorCarousel value={color} onChange={setColor} size={22} />
        </div>
        <button className="btn btn--ghost" aria-label={t('whiteboard.undo')} title={t('whiteboard.undo')} onClick={undo} disabled={strokes.length === 0}>↩</button>
        <button className="btn btn--ghost" aria-label={t('systemMap.zoomIn')} title={t('systemMap.zoomIn')} onClick={() => setView(v => ({ ...v, scale: Math.min(MAX_SCALE, v.scale * 1.25) }))}>＋</button>
        <button className="btn btn--ghost" aria-label={t('systemMap.zoomOut')} title={t('systemMap.zoomOut')} onClick={() => setView(v => ({ ...v, scale: Math.max(MIN_SCALE, v.scale * 0.8) }))}>－</button>
        <button className="btn btn--danger" aria-label={t('whiteboard.clear')} onClick={() => setConfirmClear(1)}>🗑</button>
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
            {paths.map(p => p.w === -1 ? (
              <path key={p.id} d={`M ${-HALF} ${-HALF} H ${HALF} V ${HALF} H ${-HALF} Z`} fill={p.c} stroke="none" />
            ) : p.w === -2 ? (
              <path key={p.id} d={`${p.d} Z`} fill={p.c} stroke="none" />
            ) : (
              <path key={p.id} d={p.d} stroke={p.c} strokeWidth={p.w} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            ))}
            <path d={`M ${-HALF} ${-HALF} H ${HALF} V ${HALF} H ${-HALF} Z`} fill="none" stroke="var(--border)" strokeWidth={2 / view.scale} />
            {currentPath ? (
              <path d={currentPath} stroke={current!.c} strokeWidth={current!.w} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            ) : null}
          </g>
        </svg>
      </div>

      <ConfirmDialog
        open={confirmClear > 0}
        title={confirmClear >= 3 ? t('whiteboard.clearConfirm3Title', {defaultValue: 'Last chance'}) : confirmClear === 2 ? t('whiteboard.clearConfirm2Title', {defaultValue: 'Are you sure?'}) : t('whiteboard.clearTitle')}
        message={confirmClear >= 3 ? t('whiteboard.clearConfirm3Msg', {defaultValue: 'Really erase everything on the whiteboard?'}) : confirmClear === 2 ? t('whiteboard.clearConfirm2Msg', {defaultValue: "The whole board will be erased. This can't be undone."}) : t('whiteboard.clearMsg')}
        danger
        onConfirm={() => {
          if (confirmClear < 3) { setConfirmClear(confirmClear + 1); return; }
          setConfirmClear(0);
          setStrokes([]);
          persist([]);
        }}
        onCancel={() => setConfirmClear(0)}
      />
    </div>
  );
}
