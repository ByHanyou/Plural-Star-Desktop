import type React from 'react';
import { useTranslation } from 'react-i18next';
import { Member, fmtNum, fmtClock, fmtList } from '../../utils';
import { MemberToggleChip } from '../../components/MemberChip';
import { linkButton } from '../../components/ui';

const MAX_BOARD = 25;
export const nextBoardLimit = (cur: number) => (cur < 10 ? 10 : MAX_BOARD);

const headingStyle: React.CSSProperties = { fontSize: 13, fontFamily: 'var(--font-display)', color: 'var(--accent)', marginBottom: 10 };
const subHeadingStyle: React.CSSProperties = { fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 };
const emptyStyle: React.CSSProperties = { fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' };

function Bar({ label, value, max, color, suffix }: { label: string; value: number; max: number; color: string; suffix: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: 'var(--text)' }}>{label}</span>
        <span style={{ fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{suffix}</span>
      </div>
      <div style={{ height: 8, background: 'var(--surface)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 4, background: color, width: `${max > 0 ? (value / max) * 100 : 0}%`, transition: 'width 0.3s ease' }} />
      </div>
    </div>
  );
}

function ShowMoreButton({ total, limit, onExpand }: { total: number; limit: number; onExpand: () => void }) {
  const { t } = useTranslation();
  if (total <= limit || limit >= MAX_BOARD) return null;
  return (
    <button type="button" onClick={onExpand}
      style={{ ...linkButton('var(--accent)', 12), fontWeight: 600, padding: '4px 0' }}>
      {t('stats.showMoreCount', { shown: fmtNum(Math.min(limit, total), 0), total: fmtNum(total, 0) })}
    </button>
  );
}

export interface BoardRow {
  key: string;
  label: string;
  value: number;
  color: string;
  suffix: string;
}

export function Board({ title, sub = false, rows, limit, onExpand, emptyLabel, max }: {
  title: string; sub?: boolean; rows: BoardRow[]; limit: number; onExpand?: () => void; emptyLabel?: string; max?: number;
}) {
  const shown = rows.slice(0, limit);
  const top = max ?? (shown[0]?.value || 1);
  return (
    <div style={{ marginBottom: sub ? 10 : 20 }}>
      {sub ? <div style={subHeadingStyle}>{title}</div> : <h3 style={headingStyle}>{title}</h3>}
      {shown.length === 0 && emptyLabel ? <span style={emptyStyle}>{emptyLabel}</span>
        : shown.map(r => <Bar key={r.key} label={r.label} value={r.value} max={top} color={r.color} suffix={r.suffix} />)}
      {onExpand && <ShowMoreButton total={rows.length} limit={limit} onExpand={onExpand} />}
    </div>
  );
}

export const countRows = (counts: [string, number][], color: string, label: (key: string) => string = k => k): BoardRow[] =>
  counts.map(([key, count]) => ({ key, label: label(key), value: count, color, suffix: fmtNum(count, 0) }));

export const memberRows = (counts: [string, number][], getMember: (id: string) => Member | undefined, fallback: string, suffix: (value: number) => string = v => fmtNum(v, 0), color = 'var(--accent)'): BoardRow[] =>
  counts.map(([id, value]) => {
    const m = getMember(id);
    return { key: id, label: m?.name || fallback, value, color: m?.color || color, suffix: suffix(value) };
  });

export function HourChart({ title, values, height, valueLabel, highlightMax = false, minPct = 2 }: {
  title: string; values: number[]; height: (value: number, peak: number) => number; valueLabel: (value: number) => string; highlightMax?: boolean; minPct?: number;
}) {
  const { t } = useTranslation();
  const peak = Math.max(...values, 1);
  const summary = t('stats.chartSummary', {
    title,
    items: fmtList(values.flatMap((v, h) => (v > 0 ? [t('stats.chartItem', { label: fmtClock(h, 0), value: valueLabel(v) })] : []))),
  });
  return (
    <div style={{ marginTop: 20 }}>
      <h3 style={headingStyle}>{title}</h3>
      <div role="img" aria-label={summary} style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 60 }}>
        {values.map((v, h) => {
          const top = highlightMax && v === peak;
          return (
            <div key={h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: '100%', boxSizing: 'border-box', borderRadius: 2, minHeight: 2, transition: 'height 0.3s ease',
                background: top || (!highlightMax && v > 0) ? 'var(--accent)' : 'var(--border)', border: top ? '1px solid var(--text)' : 'none',
                height: `${v > 0 ? Math.max(height(v, peak), minPct) : 2}%`,
              }} />
              {h % 4 === 0 && <span style={{ fontSize: 8, color: 'var(--muted)', marginTop: 2 }}>{fmtNum(h, 0)}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MemberChips({ members, selected, onToggle, labelledBy }: {
  members: Member[]; selected: string | null; onToggle: (id: string) => void; labelledBy: string;
}) {
  return (
    <div role="group" aria-labelledby={labelledBy} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
      {members.map(m => <MemberToggleChip key={m.id} member={m} on={selected === m.id} onToggle={() => onToggle(m.id)} />)}
    </div>
  );
}
