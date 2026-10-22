import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { pickBannerFile, pickImageFile } from '../components/imagePick';
import { useSaveGuard } from './useSaveGuard';

export const useImagePick = () => {
  const { t } = useTranslation();
  const [imageError, run, clearImageError] = useSaveGuard();
  const pick = useCallback((kind: 'image' | 'banner', apply: (dataUrl: string) => void) => {
    void run(async () => {
      const chosen = kind === 'banner' ? await pickBannerFile(t) : await pickImageFile(t);
      if (chosen) apply(chosen);
    });
  }, [run, t]);
  return { pick, imageError, clearImageError };
};
