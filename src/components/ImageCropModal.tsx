import React, { useEffect, useRef, useState } from 'react';
import i18n from '../i18n/i18n';

// The picture upload choice and its Edit half. Every upload site funnels the
// picked data URL through chooseImageTreatment: Auto returns it untouched
// (exactly what the site got before this existed), Edit opens a freeform
// crop over a canvas and returns the cropped data URL. Either result then
// rides the site's own save/resize path, so storage stays identical.
//
// Promise bridge instead of per-call-site modals: one host mounted in App
// serves MembersView, ProfileView and SystemProfileView.

interface UploadRequest {
  dataUrl: string;
  resolve: (r: string | null) => void;
}

let hostOpen: ((req: UploadRequest) => void) | null = null;

/** Resolves with the data URL to store (original for Auto, cropped for Edit),
 *  or null if the user backs out (or the host is not mounted, which callers
 *  must treat as cancel). */
export const chooseImageTreatment = (dataUrl: string): Promise<string | null> =>
  new Promise(resolve => {
    if (!hostOpen) { resolve(null); return; }
    hostOpen({ dataUrl, resolve });
  });

const HANDLE = 22;
const MIN_SIZE = 40;

type Corner = 'tl' | 'tr' | 'bl' | 'br';

interface Rect { x: number; y: number; w: number; h: number; }

export const ImageCropHost = () => {
  const [req, setReq] = useState<UploadRequest | null>(null);
  const [stage, setStage] = useState<'choose' | 'crop'>('choose');
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const rectRef = useRef<Rect | null>(null);
  const dispRef = useRef<Rect | null>(null);
  const dragRef = useRef<{ mode: 'move' | Corner; startX: number; startY: number; start: Rect } | null>(null);

  useEffect(() => {
    hostOpen = (r: UploadRequest) => {
      setStage('choose'); setNatural(null); setBox(null); setRect(null); rectRef.current = null;
      setReq(r);
      const img = new window.Image();
      img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => { r.resolve(null); setReq(null); };
      img.src = r.dataUrl;
    };
    return () => { hostOpen = null; };
  }, []);

  // Measure the crop area once the crop stage renders.
  useEffect(() => {
    if (stage !== 'crop') return;
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [stage, req]);

  const disp: Rect | null = natural && box ? (() => {
    const scale = Math.min(box.w / natural.w, box.h / natural.h);
    const w = natural.w * scale;
    const h = natural.h * scale;
    return { x: (box.w - w) / 2, y: (box.h - h) / 2, w, h };
  })() : null;
  dispRef.current = disp;

  useEffect(() => {
    if (disp && !rectRef.current) {
      const full = { x: disp.x, y: disp.y, w: disp.w, h: disp.h };
      rectRef.current = full;
      setRect(full);
    }
  }, [disp?.x, disp?.y, disp?.w, disp?.h]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      const d = dispRef.current;
      if (!drag || !d) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const s = drag.start;
      let next: Rect;
      if (drag.mode === 'move') {
        const w = s.w, h = s.h;
        const x = Math.max(d.x, Math.min(s.x + dx, d.x + d.w - w));
        const y = Math.max(d.y, Math.min(s.y + dy, d.y + d.h - h));
        next = { x, y, w, h };
      } else {
        let { x, y, w, h } = s;
        if (drag.mode === 'tl' || drag.mode === 'bl') { x = s.x + dx; w = s.w - dx; }
        if (drag.mode === 'tr' || drag.mode === 'br') { w = s.w + dx; }
        if (drag.mode === 'tl' || drag.mode === 'tr') { y = s.y + dy; h = s.h - dy; }
        if (drag.mode === 'bl' || drag.mode === 'br') { h = s.h + dy; }
        if (w < MIN_SIZE) { if (drag.mode === 'tl' || drag.mode === 'bl') x = s.x + s.w - MIN_SIZE; w = MIN_SIZE; }
        if (h < MIN_SIZE) { if (drag.mode === 'tl' || drag.mode === 'tr') y = s.y + s.h - MIN_SIZE; h = MIN_SIZE; }
        const x1 = Math.max(d.x, x);
        const y1 = Math.max(d.y, y);
        const x2 = Math.min(d.x + d.w, x + w);
        const y2 = Math.min(d.y + d.h, y + h);
        next = { x: x1, y: y1, w: Math.max(MIN_SIZE, x2 - x1), h: Math.max(MIN_SIZE, y2 - y1) };
      }
      rectRef.current = next;
      setRect(next);
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const startDrag = (mode: 'move' | Corner) => (e: React.MouseEvent) => {
    if (!rectRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, start: rectRef.current };
  };

  const finish = (result: string | null) => {
    const r = req;
    setReq(null);
    r?.resolve(result);
  };

  const confirmCrop = () => {
    const r = rectRef.current;
    const d = dispRef.current;
    if (!req || !r || !d || !natural) return;
    const img = new window.Image();
    img.onload = () => {
      const sx = natural.w / d.w;
      const sy = natural.h / d.h;
      const ox = Math.max(0, Math.round((r.x - d.x) * sx));
      const oy = Math.max(0, Math.round((r.y - d.y) * sy));
      const cw = Math.max(1, Math.min(natural.w - ox, Math.round(r.w * sx)));
      const ch = Math.max(1, Math.min(natural.h - oy, Math.round(r.h * sy)));
      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');
      if (!ctx) { finish(null); return; }
      ctx.drawImage(img, ox, oy, cw, ch, 0, 0, cw, ch);
      // Keep the source format where it matters: jpeg stays jpeg (size),
      // everything else goes png (alpha survives).
      const jpeg = req.dataUrl.startsWith('data:image/jpeg');
      finish(canvas.toDataURL(jpeg ? 'image/jpeg' : 'image/png', 0.92));
    };
    img.onerror = () => finish(null);
    img.src = req.dataUrl;
  };

  if (!req) return null;

  const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const btn: React.CSSProperties = { padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' };

  if (stage === 'choose') {
    return (
      <div style={overlay} role="dialog" aria-label={i18n.t('modal.imagePickHow')} onClick={() => finish(null)}>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, minWidth: 300 }} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>{i18n.t('modal.imagePickHow')}</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button style={btn} onClick={() => finish(null)}>{i18n.t('common.cancel')}</button>
            <button style={{ ...btn, borderColor: 'var(--accent)', color: 'var(--accent)' }} onClick={() => finish(req.dataUrl)}>{i18n.t('modal.imageAuto')}</button>
            <button style={{ ...btn, background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }} onClick={() => setStage('crop')}>{i18n.t('common.edit')}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...overlay, background: 'rgba(0,0,0,0.85)', flexDirection: 'column', padding: 24 }} role="dialog" aria-label={i18n.t('modal.cropImage')}>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 10 }}>{i18n.t('modal.cropImage')}</div>
      <div ref={boxRef} style={{ position: 'relative', flex: 1, alignSelf: 'stretch', overflow: 'hidden', userSelect: 'none' }}>
        {box && (
          <img src={req.dataUrl} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
        )}
        {rect && disp && (
          <>
            <div style={{ position: 'absolute', left: disp.x, top: disp.y, width: disp.w, height: rect.y - disp.y, background: 'rgba(0,0,0,0.55)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', left: disp.x, top: rect.y + rect.h, width: disp.w, height: disp.y + disp.h - rect.y - rect.h, background: 'rgba(0,0,0,0.55)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', left: disp.x, top: rect.y, width: rect.x - disp.x, height: rect.h, background: 'rgba(0,0,0,0.55)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', left: rect.x + rect.w, top: rect.y, width: disp.x + disp.w - rect.x - rect.w, height: rect.h, background: 'rgba(0,0,0,0.55)', pointerEvents: 'none' }} />
            <div onMouseDown={startDrag('move')}
              style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h, border: '2px solid var(--accent)', cursor: 'move' }} />
            {(['tl', 'tr', 'bl', 'br'] as Corner[]).map(corner => (
              <div key={corner} onMouseDown={startDrag(corner)}
                style={{
                  position: 'absolute',
                  left: (corner === 'tl' || corner === 'bl' ? rect.x : rect.x + rect.w) - HANDLE / 2,
                  top: (corner === 'tl' || corner === 'tr' ? rect.y : rect.y + rect.h) - HANDLE / 2,
                  width: HANDLE, height: HANDLE, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: corner === 'tl' || corner === 'br' ? 'nwse-resize' : 'nesw-resize',
                }}>
                <div style={{ width: 12, height: 12, borderRadius: 6, background: 'var(--accent)', border: '2px solid #fff' }} />
              </div>
            ))}
          </>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button style={{ ...btn, background: 'transparent', borderColor: 'rgba(255,255,255,0.4)', color: '#fff' }} onClick={() => finish(null)}>{i18n.t('common.cancel')}</button>
        <button style={{ ...btn, background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }} onClick={confirmCrop}>{i18n.t('common.save')}</button>
      </div>
    </div>
  );
};
