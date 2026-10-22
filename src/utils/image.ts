import { log } from './log';

const BANNER_WIDTH = 900;
const BANNER_HEIGHT = 300;

const MIRROR_THUMB_MAX = 128;

export const mirrorThumbDataUrl = (dataUrl: string, maxDim: number = MIRROR_THUMB_MAX, quality: number = 0.7): Promise<string | null> =>
  new Promise(resolve => {
    if (!dataUrl || !dataUrl.startsWith('data:')) { resolve(null); return; }
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const w = Math.max(1, Math.round((img.width || maxDim) * scale));
        const h = Math.max(1, Math.round((img.height || maxDim) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);
        const keepAlpha = /^data:image\/(png|gif|webp|svg)/i.test(dataUrl);
        resolve(keepAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality));
      } catch (e) {
        log.debug('image', e);
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });

export const resizeBannerDataUrl = (dataUrl: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const targetAspect = BANNER_WIDTH / BANNER_HEIGHT;
        const srcAspect = img.width / img.height;
        let cropW: number, cropH: number, offsetX: number, offsetY: number;
        if (srcAspect > targetAspect) {
          cropH = img.height;
          cropW = Math.round(img.height * targetAspect);
          offsetX = Math.round((img.width - cropW) / 2);
          offsetY = 0;
        } else {
          cropW = img.width;
          cropH = Math.round(img.width / targetAspect);
          offsetX = 0;
          offsetY = Math.round((img.height - cropH) / 2);
        }
        const canvas = document.createElement('canvas');
        canvas.width = BANNER_WIDTH;
        canvas.height = BANNER_HEIGHT;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas context unavailable')); return; }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, offsetX, offsetY, cropW, cropH, 0, 0, BANNER_WIDTH, BANNER_HEIGHT);
        resolve(canvas.toDataURL('image/png'));
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = dataUrl;
  });
