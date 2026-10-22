import { useCallback, useState } from 'react';
import { errorMessage, logError } from '../utils/log';

export type SaveRun = (op: () => Promise<unknown>) => Promise<boolean>;

export const useSaveGuard = (): [string | null, SaveRun, () => void] => {
  const [error, setError] = useState<string | null>(null);
  const run = useCallback<SaveRun>(async op => {
    try {
      await op();
      return true;
    } catch (e) {
      logError('save', e);
      setError(errorMessage(e));
      return false;
    }
  }, []);
  const clear = useCallback(() => setError(null), []);
  return [error, run, clear];
};
