import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Btn, useDialogFocus, useEscapeKey } from './ui';
import { CROP_CORNERS, CropCorner, CropMode, CropRect, CropSize, containRect, cornerPoint, cropPixels, dragCropRect, isLeftCorner, isTopCorner } from '../utils';

interface UploadRequest {
  dataUrl: string;
  resolve: (r: string | null) => void;
  reject: (e: Error) => void;
}

let hostOpen: ((req: UploadRequest) => void) | null = null;

export const chooseImageTreatment = (dataUrl: string): Promise<string | null> =>
  new Promise((resolve, reject) => {
    if (!hostOpen) { resolve(dataUrl); return; }
    hostOpen({ dataUrl, resolve, reject });
  });

const HANDLE = 22;

const CORNER_LABEL: Record<CropCorner, string> = {
  tl: 'modal.cropResizeTopLeft',
  tr: 'modal.cropResizeTopRight',
  bl: 'modal.cropResizeBottomLeft',
  br: 'modal.cropResizeBottomRight',
};

const SHADE = 'rgba(0,0,0,0.55)';

export const ImageCropHost = () => {
  const { t } = useTranslation();
  const [req, setReq] = useState<UploadRequest | null>(null);
  const [stage, setStage] = useState<'choose' | 'crop'>('choose');
  const [natural, setNatural] = useState<CropSize | null>(null);
  const [box, setBox] = useState<CropSize | null>(null);
  const [rect, setRect] = useState<CropRect | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const rectRef = useRef<CropRect | null>(null);
  const dispRef = useRef<CropRect | null>(null);
  const rectDispRef = useRef<CropRect | null>(null);
  const dragRef = useRef<{ mode: CropMode; startX: number; startY: number; start: CropRect } | null>(null);
  const activeRef = useRef<UploadRequest | null>(null);
  const chooseRef = useRef<HTMLDivElement | null>(null);
  const cropRef = useRef<HTMLDivElement | null>(null);
  useDialogFocus(!!req && stage === 'choose', chooseRef);
  useDialogFocus(!!req && stage === 'crop', cropRef);

  useEffect(() => {
    hostOpen = (r: UploadRequest) => {
      if (activeRef.current && activeRef.current !== r) activeRef.current.resolve(null);
      activeRef.current = r;
      setStage('choose'); setNatural(null); setBox(null); setRect(null); rectRef.current = null; rectDispRef.current = null;
      setReq(r);
      const img = new window.Image();
      img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => { r.reject(new Error(t('modal.imageUnreadable'))); if (activeRef.current === r) activeRef.current = null; setReq(null); };
      img.src = r.dataUrl;
    };
    return () => {
      hostOpen = null;
      if (activeRef.current) activeRef.current.resolve(null);
      activeRef.current = null;
    };
  }, [t]);

  useEffect(() => {
    if (stage !== 'crop') return;
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [stage, req]);

  const disp: CropRect | null = natural && box ? containRect(natural, box) : null;
  dispRef.current = disp;

  useEffect(() => {
    if (!disp) return;
    const prev = rectDispRef.current;
    const cur = rectRef.current;
    const next = !cur || !prev ? { ...disp } : {
      x: disp.x + (cur.x - prev.x) * disp.w / prev.w,
      y: disp.y + (cur.y - prev.y) * disp.h / prev.h,
      w: cur.w * disp.w / prev.w,
      h: cur.h * disp.h / prev.h,
    };
    rectDispRef.current = disp;
    rectRef.current = next;
    setRect(next);
  }, [disp?.x, disp?.y, disp?.w, disp?.h]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      const d = dispRef.current;
      if (!drag || !d) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const next = dragCropRect(drag.mode, drag.start, dx, dy, d);
      rectRef.current = next;
      setRect(next);
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const startDrag = (mode: CropMode) => (e: React.MouseEvent) => {
    if (!rectRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, start: rectRef.current };
  };

  const nudge = (mode: CropMode) => (e: React.KeyboardEvent) => {
    const s = rectRef.current;
    const d = dispRef.current;
    if (!s || !d) return;
    const step = e.shiftKey ? 20 : 4;
    const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
    const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
    if (!dx && !dy) return;
    e.preventDefault();
    const next = dragCropRect(mode, s, dx, dy, d);
    rectRef.current = next;
    setRect(next);
  };

  const settle = (): UploadRequest | null => {
    const r = req;
    if (activeRef.current === r) activeRef.current = null;
    setReq(null);
    return r;
  };
  const finish = (result: string | null) => settle()?.resolve(result);
  const fail = () => settle()?.reject(new Error(t('modal.imageUnreadable')));

  useEscapeKey(!!req, () => finish(null));

  const confirmCrop = () => {
    const r = rectRef.current;
    const d = dispRef.current;
    if (!req || !r || !d || !natural) return;
    const img = new window.Image();
    img.onload = () => {
      const { x: ox, y: oy, width: cw, height: ch } = cropPixels(r, d, natural);
      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');
      if (!ctx) { fail(); return; }
      ctx.drawImage(img, ox, oy, cw, ch, 0, 0, cw, ch);
      const jpeg = req.dataUrl.startsWith('data:image/jpeg');
      finish(canvas.toDataURL(jpeg ? 'image/jpeg' : 'image/png', 0.92));
    };
    img.onerror = fail;
    img.src = req.dataUrl;
  };

  if (!req) return null;

  const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' };

  if (stage === 'choose') {
    return (
      <div ref={chooseRef} tabIndex={-1} style={overlay} role="dialog" aria-modal="true" aria-label={t('modal.imagePickHow')} onClick={() => finish(null)}>
        <div role="presentation" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, minWidth: 300 }} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>{t('modal.imagePickHow')}</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => finish(null)}>{t('common.cancel')}</Btn>
            <Btn variant="primary" onClick={() => finish(req.dataUrl)}>{t('modal.imageAuto')}</Btn>
            <Btn variant="solid" onClick={() => setStage('crop')}>{t('common.edit')}</Btn>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={cropRef} tabIndex={-1} style={{ ...overlay, background: 'rgba(0,0,0,0.85)', flexDirection: 'column', padding: 24 }} role="dialog" aria-modal="true" aria-label={t('modal.cropImage')}>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 10 }}>{t('modal.cropImage')}</div>
      <div ref={boxRef} style={{ position: 'relative', flex: 1, alignSelf: 'stretch', overflow: 'hidden', userSelect: 'none' }}>
        {box && (
          <img src={req.dataUrl} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
        )}
        {rect && disp && (
          <>
            {[
              { left: disp.x, top: disp.y, width: disp.w, height: rect.y - disp.y },
              { left: disp.x, top: rect.y + rect.h, width: disp.w, height: disp.y + disp.h - rect.y - rect.h },
              { left: disp.x, top: rect.y, width: rect.x - disp.x, height: rect.h },
              { left: rect.x + rect.w, top: rect.y, width: disp.x + disp.w - rect.x - rect.w, height: rect.h },
            ].map((shade, i) => <div key={i} style={{ position: 'absolute', ...shade, background: SHADE, pointerEvents: 'none' }} />)}
            <div onMouseDown={startDrag('move')} role="button" tabIndex={0} aria-label={t('modal.cropMove')} onKeyDown={nudge('move')}
              style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h, border: '2px solid var(--accent)', cursor: 'move' }} />
            {CROP_CORNERS.map(corner => (
              <div key={corner} onMouseDown={startDrag(corner)} role="button" tabIndex={0} aria-label={t(CORNER_LABEL[corner])} onKeyDown={nudge(corner)}
                style={{
                  position: 'absolute',
                  left: cornerPoint(corner, rect).x - HANDLE / 2,
                  top: cornerPoint(corner, rect).y - HANDLE / 2,
                  width: HANDLE, height: HANDLE, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: isLeftCorner(corner) === isTopCorner(corner) ? 'nwse-resize' : 'nesw-resize',
                }}>
                <div style={{ width: 12, height: 12, borderRadius: 6, background: 'var(--accent)', border: '2px solid #fff' }} />
              </div>
            ))}
          </>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(255,255,255,0.4)', color: '#fff' }} onClick={() => finish(null)}>{t('common.cancel')}</button>
        <Btn variant="solid" onClick={confirmCrop}>{t('common.save')}</Btn>
      </div>
    </div>
  );
};
