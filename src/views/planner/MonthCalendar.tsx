import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlannerData, getLocale, firstDayOfWeek } from '../../utils';
import { ColorCarousel } from '../../components/ColorCarousel';
import { appointmentsOn, dayKey, monthGrid, weekdayInitials } from '../../planner/planner';
import { tint } from '../../theme';

export function MonthCalendar({ planner, viewMonth, onViewMonth, selected, onSelect, markColor, onMarkColor }: {
  planner: PlannerData; viewMonth: Date; onViewMonth: (d: Date) => void;
  selected: Date; onSelect: (d: Date) => void; markColor: string; onMarkColor: (hex: string) => void;
}) {
  const { t } = useTranslation();
  const locale = getLocale();
  const weekStart = firstDayOfWeek();
  const [markPickerOpen, setMarkPickerOpen] = useState(false);
  const initials = useMemo(() => weekdayInitials(locale, weekStart), [locale, weekStart]);
  const grid = useMemo(() => monthGrid(viewMonth, weekStart), [viewMonth, weekStart]);
  const todayKey = dayKey(new Date());
  const selectedKey = dayKey(selected);
  const monthLabel = viewMonth.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const shift = (delta: number) => onViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + delta, 1));

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <button type="button" className="icon-btn" aria-label={t('planner.prevMonth')} onClick={() => shift(-1)} style={{ color: 'var(--accent)', fontSize: 16 }}>‹</button>
        <h3 aria-live="polite" style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{monthLabel}</h3>
        <button type="button" className="icon-btn" aria-label={t('planner.nextMonth')} onClick={() => shift(1)} style={{ color: 'var(--accent)', fontSize: 16 }}>›</button>
      </div>
      <div role="group" aria-label={monthLabel} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {initials.map((w, i) => (
          <div key={`w${i}`} aria-hidden style={{ textAlign: 'center', fontSize: 10, color: 'var(--muted)' }}>{w}</div>
        ))}
        {grid.map((d, i) => {
          const inMonth = d.getMonth() === viewMonth.getMonth();
          const key = dayKey(d);
          const isSel = key === selectedKey;
          const isToday = key === todayKey;
          const dayList = appointmentsOn(planner, d);
          const count = dayList.length;
          const dots = Array.from(new Set(dayList.map(a => a.color || markColor))).slice(0, 3);
          const dateText = d.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' });
          const label = count > 0 ? t('planner.dayCellLabel', { date: dateText, appts: t('planner.apptCount', { count }) }) : dateText;
          return (
            <button key={i} type="button" onClick={() => { onSelect(new Date(d)); if (!inMonth) onViewMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}
              aria-label={label} aria-pressed={isSel} aria-current={isToday ? 'date' : undefined}
              style={{ aspectRatio: '1', borderRadius: 8, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
                background: isSel ? tint('var(--accent)', 22) : 'transparent',
                border: isToday ? '1px solid var(--accent)' : '1px solid transparent',
                color: inMonth ? (isSel ? 'var(--accent)' : 'var(--text)') : 'var(--muted)',
                fontSize: 12, fontWeight: isSel ? 700 : 400 }}>
              {d.getDate()}
              {count > 0 && (
                <span aria-hidden style={{ display: 'flex', gap: 2 }}>
                  {dots.map(c => <span key={c} style={{ width: 6, height: 6, borderRadius: 3, background: c, display: 'inline-block' }} />)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <button type="button" onClick={() => setMarkPickerOpen(v => !v)} aria-expanded={markPickerOpen}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', marginTop: 8, paddingTop: 8, background: 'none', border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer', color: 'var(--dim)', fontSize: 11 }}>
        <span aria-hidden style={{ width: 10, height: 10, borderRadius: 5, background: markColor, display: 'inline-block' }} />
        <span style={{ flex: 1, textAlign: 'left' }}>{t('planner.markColor')}</span>
        <span aria-hidden>{markPickerOpen ? '▲' : '▼'}</span>
      </button>
      {markPickerOpen && (
        <div style={{ marginTop: 8 }}>
          <ColorCarousel value={markColor} onChange={onMarkColor} size={22} />
        </div>
      )}
    </div>
  );
}
