import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HistoryEntry, Member, fmtTime, fmtDur, getLocale, TIER_I18N_KEY } from '../utils';
import { RANGE_MS, RANGE_KEYS, RANGE_LABEL, TIER_BAR, buildTimelineRows } from '../stats/timeline';
import type { RangeKey, Span } from '../stats/timeline';
import { MemberAvatar } from './MemberAvatar';

const LABEL_W = 130;
const ROW_H = 34;

export default function FrontTimeline({ history, members, singlet = false }: {
  history: HistoryEntry[];
  members: Member[];
  singlet?: boolean;
}) {
  const { t } = useTranslation();
  const [range, setRange] = useState<RangeKey>('week');
  const [endAnchor, setEndAnchor] = useState<number | null>(null);

  const span = RANGE_MS[range];
  const end = endAnchor ?? Math.ceil(Date.now() / 60000) * 60000;
  const start = end - span;
  const live = endAnchor === null;

  const rows = useMemo(() => buildTimelineRows(history, members, start, end, Date.now()), [history, members, start, end]);

  const tickLabel = (ts: number): string => range === 'day'
    ? new Date(ts).toLocaleTimeString(getLocale(), { hour: 'numeric', minute: '2-digit' })
    : new Date(ts).toLocaleDateString(getLocale(), { month: 'short', day: 'numeric' });

  const goEarlier = () => setEndAnchor(end - span);
  const goLater = () => {
    const next = end + span;
    if (next >= Date.now()) setEndAnchor(null); else setEndAnchor(next);
  };

  const spanLabel = (sp: Span): string =>
    t('history.tlSpan', { start: fmtTime(sp.start), end: sp.open && live ? t('history.now') : fmtTime(sp.end), dur: fmtDur(sp.start, sp.end) });

  const barLabel = (member: Member, sp: Span): string => {
    const tierLine = singlet ? null : t(TIER_I18N_KEY[sp.tier]);
    return [member.name, tierLine, spanLabel(sp)].filter(Boolean).join(' · ');
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
        {RANGE_KEYS.map(k => (
          <button key={k} className={`btn ${range === k ? 'btn--primary' : 'btn--ghost'}`}
            style={{ padding: '7px 10px', fontSize: 12 }} aria-pressed={range === k}
            onClick={() => setRange(k)}>
            {t(RANGE_LABEL[k])}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <button className="btn btn--ghost" style={{ padding: '7px 12px', fontSize: 13 }}
          aria-label={t('history.tlEarlier')} title={t('history.tlEarlier')} onClick={goEarlier}>‹</button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 12, color: 'var(--dim)' }} aria-live="polite">
          {t('history.tlRange', { start: tickLabel(start), end: live ? t('history.tlNow') : tickLabel(end) })}
        </span>
        <button className="btn btn--ghost" style={{ padding: '7px 12px', fontSize: 13, opacity: live ? 0.4 : 1 }}
          aria-label={t('history.tlLater')} title={t('history.tlLater')} disabled={live} onClick={goLater}>›</button>
        {!live && (
          <button className="btn btn--primary" style={{ padding: '7px 12px', fontSize: 12 }}
            onClick={() => setEndAnchor(null)}>{t('history.tlNow')}</button>
        )}
      </div>
      <div style={{ display: 'flex', marginBottom: 4 }}>
        <div style={{ width: LABEL_W, flexShrink: 0 }} />
        {[0, 1 / 3, 2 / 3].map(f => (
          <span key={f} style={{ flex: 1, fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden' }}>{tickLabel(start + f * span)}</span>
        ))}
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: '48px 0', textAlign: 'center' }}>
          <div aria-hidden style={{ fontSize: 36, opacity: 0.4, marginBottom: 12 }}>◷</div>
          <div style={{ fontSize: 13, color: 'var(--dim)' }}>
            {singlet ? t('history.noHistorySinglet') : t('history.noHistory')}
          </div>
        </div>
      ) : (
        <div style={{ maxHeight: '62vh', overflowY: 'auto' }}>
          {rows.map(row => (
            <div key={row.member.id} style={{ display: 'flex', alignItems: 'center', height: ROW_H }}>
              <div style={{ width: LABEL_W, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, paddingRight: 8, overflow: 'hidden' }}>
                <MemberAvatar member={row.member} size={18} fontSize={8} decorative />
                <span style={{ fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.member.name}</span>
              </div>
              <div style={{ flex: 1, position: 'relative', height: ROW_H }}>
                <div style={{ position: 'absolute', top: ROW_H / 2, left: 0, right: 0, height: 1, background: 'var(--border)', opacity: 0.6 }} />
                {row.spans.map((sp, i) => {
                  const bar = TIER_BAR[sp.tier];
                  return (
                    <div
                      key={`${sp.start}-${sp.tier}-${i}`}
                      role="img"
                      aria-label={barLabel(row.member, sp)}
                      title={barLabel(row.member, sp)}
                      style={{
                        position: 'absolute',
                        left: `${((sp.start - start) / span) * 100}%`,
                        width: `${((sp.end - sp.start) / span) * 100}%`,
                        minWidth: 3,
                        height: bar.height,
                        top: (ROW_H - bar.height) / 2,
                        borderRadius: 3,
                        background: row.member.color,
                        opacity: bar.opacity,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
