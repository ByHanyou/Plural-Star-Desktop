import { useCallback, useEffect, useRef, useState } from 'react';

export const useFlash = <T>(ms: number): [T | null, (value: T, holdMs?: number) => void, () => void] => {
  const [value, setValue] = useState<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setValue(null);
  }, []);
  const flash = useCallback((next: T, holdMs = ms) => {
    if (timer.current) clearTimeout(timer.current);
    setValue(next);
    timer.current = setTimeout(() => { timer.current = null; setValue(null); }, holdMs);
  }, [ms]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return [value, flash, clear];
};
