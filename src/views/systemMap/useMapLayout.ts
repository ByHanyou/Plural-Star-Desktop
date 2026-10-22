import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Member, clamp } from '../../utils';
import { saveData } from '../../store/actions';
import { useAppStore } from '../../store/appStore';
import type { SaveRun } from '../../hooks/useSaveGuard';

const MAP_HALF = 2000;
const MAP_ASPECT = 560 / 900;

export function useMapLayout(mapMembers: Member[], lockPositions: boolean, run: SaveRun) {
  const savedPositions = useAppStore(s => s.systemMapPositions);
  const [posOverrides, setPosOverrides] = useState(savedPositions);
  useEffect(() => { setPosOverrides(savedPositions); }, [savedPositions]);
  const posRef = useRef(posOverrides);
  posRef.current = posOverrides;
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ id: string; pointerId: number; startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);
  const lastDragMovedRef = useRef(false);

  const clampMap = (v: number) => clamp(Math.round(v), -MAP_HALF, MAP_HALF);
  const n = mapMembers.length;
  const radius = n <= 1 ? 0 : 200;
  const pos = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    mapMembers.forEach((mem, i) => {
      const o = posOverrides[mem.id];
      if (o) { m.set(mem.id, { x: o.x, y: o.y }); return; }
      if (n === 1) { m.set(mem.id, { x: 0, y: 0 }); return; }
      const a = (2 * Math.PI * i) / n - Math.PI / 2;
      m.set(mem.id, { x: radius * Math.cos(a), y: radius * Math.sin(a) });
    });
    return m;
  }, [mapMembers, n, radius, posOverrides]);
  const [extX, extY] = useMemo(() => {
    let ex = radius + 100;
    let ey = (radius + 100) * MAP_ASPECT;
    pos.forEach(p => { ex = Math.max(ex, Math.abs(p.x) + 70); ey = Math.max(ey, Math.abs(p.y) + 70); });
    ex = Math.max(ex, ey / MAP_ASPECT);
    return [ex, ex * MAP_ASPECT];
  }, [pos, radius]);

  const persistPositions = (next: Record<string, { x: number; y: number }>) => {
    void run(() => saveData('systemMapPositions', next));
  };
  const worldPerPixel = (): number => {
    const el = svgRef.current;
    if (!el) return 1;
    const r = el.getBoundingClientRect();
    return r.width > 0 ? (extX * 2) / r.width : 1;
  };
  const onNodePointerDown = (id: string, p: { x: number; y: number }) => (e: React.PointerEvent) => {
    if (e.button !== 0 || lockPositions) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { id, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, origX: p.x, origY: p.y, moved: false };
  };
  const onNodePointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 4) return;
    d.moved = true;
    const s = worldPerPixel();
    const nx = clampMap(d.origX + (e.clientX - d.startX) * s);
    const ny = clampMap(d.origY + (e.clientY - d.startY) * s);
    posRef.current = { ...posRef.current, [d.id]: { x: nx, y: ny } };
    setPosOverrides(posRef.current);
  };
  const onNodePointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    dragRef.current = null;
    if (d.moved) {
      lastDragMovedRef.current = true;
      persistPositions(posRef.current);
    }
  };
  const nudgeNode = (e: React.KeyboardEvent, id: string, p: { x: number; y: number }) => {
    if (lockPositions) return;
    const step = e.shiftKey ? 50 : 10;
    const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
    const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
    if (!dx && !dy) return;
    e.preventDefault();
    posRef.current = { ...posRef.current, [id]: { x: clampMap(p.x + dx), y: clampMap(p.y + dy) } };
    setPosOverrides(posRef.current);
    persistPositions(posRef.current);
  };

  return { svgRef, pos, extX, extY, lastDragMovedRef, onNodePointerDown, onNodePointerMove, onNodePointerUp, nudgeNode };
}
