import React, { useState, useEffect, useMemo, useRef, useCallback, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog, SaveErrorDialog, SrOnly } from '../components/ui';
import { WhiteboardToolbar } from './whiteboard/WhiteboardToolbar';
import { clamp, uid, WhiteboardStroke } from '../utils';
import { saveData } from '../store/actions';
import { useAppStore } from '../store/appStore';
import { BOARD_PATH, Tool, WIDTHS, ZOOM_IN_STEP, ZOOM_OUT_STEP, bucketFill, clampScale, clampWorld, closePolygon, eraseStrokes, extendStroke, isShapeTap, isShapeTool, polyCloseThreshold, shapePts, strokeAttrs, strokePath } from '../whiteboard/geometry';
import { useSaveGuard } from '../hooks/useSaveGuard';
import { cssVar } from '../theme';

type Stroke = WhiteboardStroke;

const ERASING_ID = '__erasing__';
const WHEEL_ZOOM_IN = 1.12;
const WHEEL_ZOOM_OUT = 0.9;
const PAN_STEP = 50;
const PAN_STEP_FAST = 200;
const CLEAR_STEPS: [string, string][] = [
  ['whiteboard.clearTitle', 'whiteboard.clearMsg'],
  ['whiteboard.clearConfirm2Title', 'whiteboard.clearConfirm2Msg'],
  ['whiteboard.clearConfirm3Title', 'whiteboard.clearConfirm3Msg'],
];

export default function WhiteboardView() {
  const { t } = useTranslation();
  const savedStrokes = useAppStore(s => s.whiteboard);
  const [strokes, setStrokes] = useState<Stroke[]>(savedStrokes);
  useEffect(() => { setStrokes(savedStrokes); }, [savedStrokes]);
  const [current, setCurrent] = useState<Stroke | null>(null);
  const [color, setColor] = useState(() => cssVar('--text') || '#FFFFFF');
  const [width, setWidth] = useState(WIDTHS[2]);
  const [tool, setTool] = useState<Tool>('draw');
  const [view, setView] = useState({ tx: 0, ty: 0, scale: 0.5 });
  const panHintId = useId();
  const onBoardKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? PAN_STEP_FAST : PAN_STEP;
    const dx = e.key === 'ArrowLeft' ? step : e.key === 'ArrowRight' ? -step : 0;
    const dy = e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0;
    if (!dx && !dy) return;
    e.preventDefault();
    setView(v => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
  };
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
  const polyPtsRef = useRef<number[] | null>(null);
  const polyIdRef = useRef<string | null>(null);
  const [saveError, run, clearSaveError] = useSaveGuard();

  const persist = useCallback((next: Stroke[]) => {
    void run(() => saveData('whiteboard', next));
  }, [run]);

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
    const closed = closePolygon(pts);
    if (!closed) return;
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
    const closeThresh = polyCloseThreshold(viewRef.current.scale);
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

  useEffect(() => {
    if (tool !== 'poly' && polyPtsRef.current) cancelPoly();
  }, [tool, cancelPoly]);

  const eraseAt = (wx: number, wy: number) => {
    const radius = widthRef.current;
    const survivors = eraseStrokes(strokesRef.current, wx, wy, radius);
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
      currentRef.current = { id: ERASING_ID, c: '', w: 0, pts: [] };
      return;
    }
    if (toolRef.current === 'bucket') {
      const fill = bucketFill(wx, wy, strokesRef.current, colorRef.current);
      if (!fill) return;
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
    if (cur.id === ERASING_ID) {
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
    const extended = extendStroke(cur, cx, cy, viewRef.current.scale);
    if (extended) {
      currentRef.current = extended;
      setCurrent(extended);
    }
  };

  const onPointerUp = () => {
    if (panStartRef.current) {
      panStartRef.current = null;
      return;
    }
    if (toolRef.current === 'poly') return;
    const cur = currentRef.current;
    currentRef.current = null;
    if (cur && cur.id === ERASING_ID) {
      persist(strokesRef.current);
      return;
    }
    const shapeTap = isShapeTap(shapeStartRef.current !== null, cur);
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

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? WHEEL_ZOOM_IN : WHEEL_ZOOM_OUT;
      setView(v => ({ ...v, scale: clampScale(v.scale * factor) }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const undo = () => {
    if (strokesRef.current.length === 0) return;
    const next = strokesRef.current.slice(0, -1);
    setStrokes(next);
    persist(next);
  };

  const paths = useMemo(() => strokes.map(s => ({ id: s.id, ...strokeAttrs(s) })), [strokes]);
  const currentPath = current ? strokePath(current.pts) : '';
  const clearStep = CLEAR_STEPS[clamp(confirmClear, 1, CLEAR_STEPS.length) - 1];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 480 }}>
      <WhiteboardToolbar tool={tool} onTool={setTool} width={width} onWidth={setWidth} color={color} onColor={setColor}
        canUndo={strokes.length > 0} onUndo={undo}
        onZoomIn={() => setView(v => ({ ...v, scale: clampScale(v.scale * ZOOM_IN_STEP) }))}
        onZoomOut={() => setView(v => ({ ...v, scale: clampScale(v.scale * ZOOM_OUT_STEP) }))}
        onClear={() => setConfirmClear(1)} />

      <div
        ref={wrapRef}
        role="group"
        aria-label={t('whiteboard.title')}
        tabIndex={0}
        aria-describedby={panHintId}
        onKeyDown={onBoardKey}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{ flex: 1, overflow: 'hidden', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, cursor: tool === 'move' ? 'grab' : tool === 'erase' ? 'cell' : 'crosshair', touchAction: 'none' }}>
        <svg width="100%" height="100%">
          <g transform={`translate(${(wrapRef.current?.clientWidth || 0) / 2 + view.tx}, ${(wrapRef.current?.clientHeight || 0) / 2 + view.ty}) scale(${view.scale})`}>
            {paths.map(({ id, ...attrs }) => <path key={id} {...attrs} />)}
            <path d={BOARD_PATH} fill="none" stroke="var(--border)" strokeWidth={2 / view.scale} />
            {current && currentPath ? (
              <path d={currentPath} stroke={current.c} strokeWidth={current.w} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            ) : null}
          </g>
        </svg>
      </div>
      <SrOnly id={panHintId}>{t('whiteboard.panHint')}</SrOnly>
      <SaveErrorDialog error={saveError} onClose={clearSaveError} />

      <ConfirmDialog key={confirmClear}
        open={confirmClear > 0}
        title={t(clearStep[0])}
        message={t(clearStep[1])}
        danger single
        onConfirm={() => {
          if (confirmClear < CLEAR_STEPS.length) { setConfirmClear(confirmClear + 1); return; }
          setConfirmClear(0);
          setStrokes([]);
          persist([]);
        }}
        onCancel={() => setConfirmClear(0)}
      />
    </div>
  );
}
