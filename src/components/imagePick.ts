import { resizeBannerDataUrl } from '../utils/image';
import { chooseImageTreatment } from './ImageCropModal';
import { logError } from '../utils/log';

type Translate = (key: string) => string;

export const pickImageFile = async (t: Translate): Promise<string | null> => {
  const filePath = await window.electronAPI.dialog.openFile([
    { name: t('fileDialog.images'), extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
  ]);
  if (!filePath) return null;
  const dataUrl = await window.electronAPI.file.readAsBase64(filePath);
  if (!dataUrl) throw new Error(t('modal.imageUnreadable'));
  return chooseImageTreatment(dataUrl);
};

export const pickBannerFile = async (t: Translate): Promise<string | null> => {
  const chosen = await pickImageFile(t);
  if (!chosen) return null;
  try {
    return await resizeBannerDataUrl(chosen);
  } catch (e) {
    logError('image', e);
    return chosen;
  }
};
