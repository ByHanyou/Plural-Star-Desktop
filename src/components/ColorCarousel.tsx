import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PRESET_COLORS, PresetColor, presetColorName, colorName, normalizeCustomColors } from '../utils';
import { store, KEYS } from '../storage';

interface CarouselEntry {
  hex: string;
  label: string;
  selected: boolean;
}

const ColorCarouselInner = ({ value, onChange, size = 26 }: { value: string; onChange: (hex: string) => void; size?: number }) => {
  const { t } = useTranslation();
  const [customColors, setCustomColors] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const jumpingRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    store.get<string[]>(KEYS.customColors, []).then(v => setCustomColors(normalizeCustomColors(v))).catch(() => {});
  }, []);

  const cur = (value || '').toUpperCase();

  const entries = useMemo<CarouselEntry[]>(() => {
    const out: CarouselEntry[] = [];
    const seen = new Set<string>();
    for (const p of PRESET_COLORS as PresetColor[]) {
      out.push({ hex: p.hex, label: presetColorName(p, t), selected: p.hex === cur });
      seen.add(p.hex);
    }
    customColors.forEach((c, i) => {
      if (!c || seen.has(c)) return;
      out.push({ hex: c, label: t('colors.customSlot', { n: i + 1 }), selected: c === cur });
      seen.add(c);
    });
    if (cur && /^#[0-9A-F]{6}$/.test(cur) && !seen.has(cur)) {
      out.unshift({ hex: cur, label: colorName(cur, t), selected: true });
    }
    return out;
  }, [customColors, cur, t]);

  const itemW = size + 8;
  const blockW = entries.length * itemW;
  const data = useMemo(() => [...entries, ...entries, ...entries], [entries]);
  const selIdx = Math.max(0, entries.findIndex(e => e.selected));
  const selectedLabel = entries.find(e => e.selected)?.label || '';

  useEffect(() => {
    const el = scrollRef.current;
    if (el && blockW > 0) el.scrollLeft = blockW + selIdx * itemW - itemW * 2;
  }, [blockW]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el || jumpingRef.current || blockW <= 0) return;
    if (el.scrollLeft < blockW * 0.25) {
      jumpingRef.current = true;
      el.scrollLeft += blockW;
      setTimeout(() => { jumpingRef.current = false; }, 50);
    } else if (el.scrollLeft > blockW * 1.75) {
      jumpingRef.current = true;
      el.scrollLeft -= blockW;
      setTimeout(() => { jumpingRef.current = false; }, 50);
    }
  };

  return (
    <div>
      <div ref={scrollRef} onScroll={onScroll}
        style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '2px 0', scrollbarWidth: 'thin' }}>
        {data.map((item, i) => (
          <button key={i} onClick={() => onChangeRef.current(item.hex)}
            aria-label={item.label} title={item.label} aria-pressed={item.selected}
            style={{
              width: size, height: size, minWidth: size, borderRadius: '50%', backgroundColor: item.hex,
              border: item.selected ? '2px solid #fff' : '1px solid var(--border)', cursor: 'pointer', padding: 0,
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
