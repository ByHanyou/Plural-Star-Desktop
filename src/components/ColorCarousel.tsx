import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { colorChoices } from '../utils';
import { useAppStore } from '../store/appStore';

const JUMP_SETTLE_MS = 50;

const ColorCarouselInner =({ value, onChange, size = 26 }: { value: string; onChange: (hex: string) => void; size?: number }) => {
  const { t } = useTranslation();
  const customColors = useAppStore(s => s.customColors);
  const scrollRef = useRef<HTMLDivElement>(null);
  const jumpingRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const cur = (value || '').toUpperCase();

  const entries = useMemo(() => colorChoices(customColors, value, t), [customColors, value, t]);

  const itemW = size + 8;
  const blockW = entries.length * itemW;
  const data = useMemo(() => [...entries, ...entries, ...entries], [entries]);
  const selIdx = Math.max(0, entries.findIndex(e => e.hex === cur));
  const selectedLabel = entries.find(e => e.hex === cur)?.label || '';

  useEffect(() => {
    const el = scrollRef.current;
    if (el && blockW > 0) el.scrollLeft = blockW + selIdx * itemW - itemW * 2;
  }, [blockW]);

  const jump = (el: HTMLDivElement, delta: number) => {
    jumpingRef.current = true;
    el.scrollLeft += delta;
    setTimeout(() => { jumpingRef.current = false; }, JUMP_SETTLE_MS);
  };

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el || jumpingRef.current || blockW <= 0) return;
    if (el.scrollLeft < blockW * 0.25) jump(el, blockW);
    else if (el.scrollLeft > blockW * 1.75) jump(el, -blockW);
  };

  return (
    <div>
      <div ref={scrollRef} onScroll={onScroll}
        style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '2px 0', scrollbarWidth: 'thin' }}>
        {data.map((item, i) => (
          <button key={i} onClick={() => onChangeRef.current(item.hex)}
            aria-label={item.label} title={item.label} aria-pressed={item.hex === cur}
            {...(i < entries.length || i >= 2 * entries.length ? { tabIndex: -1, 'aria-hidden': true } : {})}
            style={{
              width: size, height: size, minWidth: size, borderRadius: '50%', backgroundColor: item.hex,
              border: item.hex === cur ? '2px solid #fff' : '1px solid var(--border)', cursor: 'pointer', padding: 0,
            }} />
        ))}
      </div>
      {selectedLabel ? (
        <div aria-hidden style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{selectedLabel}</div>
      ) : null}
    </div>
  );
};

export const ColorCarousel = React.memo(
  ColorCarouselInner,
  (prev, next) => prev.value === next.value && prev.size === next.size,
);
