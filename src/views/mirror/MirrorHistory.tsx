import { useTranslation } from 'react-i18next';
import type { MirrorMember } from '../../network/types';
import { HistoryEntry, fmtTime, historyTier, historyTierIds, isFrontEntry } from '../../utils';
import { tint } from '../../theme';
import { TierDetailLine } from '../../components/TierDetailLine';
import { Nothing, mutedText, rowDivider } from './shared';

const tierLabelStyle = { fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 } as const;

const detailIndent = { marginTop: 3, marginLeft: 4 };

export function MirrorHistory({ entries, members }: { entries: HistoryEntry[]; members: MirrorMember[] }) {
  const { t } = useTranslation();
  const list = entries.filter(isFrontEntry).sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
  if (list.length === 0) return <Nothing />;
  const chips = (ids: string[]) => ids.map(id => {
    const m = members.find(x => x.id === id);
    return (
      <span key={id} className="chip" style={{ borderColor: m?.color ? tint(m.color, 31) : 'var(--border)', background: m?.color ? tint(m.color, 13) : 'transparent' }}>
        <span style={{ color: m?.color || 'var(--text)' }}>{m?.name || '-'}</span>
      </span>
    );
  });
  const subTier = (label: string, e: HistoryEntry, tierKey: 'coFront' | 'coConscious') => {
    const tier = historyTier(e, tierKey);
    return tier.memberIds.length > 0 ? (
      <div style={{ marginTop: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={tierLabelStyle}>{t('common.labelColon', { label })}</span>
          {chips(tier.memberIds)}
        </div>
        <TierDetailLine tier={tier} style={detailIndent} />
      </div>
    ) : null;
  };
  return (
    <div>
      {list.map((e, i) => (
        <div key={`${e.startTime}-${i}`} style={rowDivider}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {chips(historyTierIds(e, 'primary'))}
            <span style={{ marginLeft: 'auto', ...mutedText, fontVariantNumeric: 'tabular-nums' }}>
              {fmtTime(e.startTime || 0)}{e.endTime ? ` - ${fmtTime(e.endTime)}` : ''}
            </span>
          </div>
          <TierDetailLine tier={historyTier(e, 'primary')} style={detailIndent} />
          {subTier(t('tier.coFront'), e, 'coFront')}
          {subTier(t('tier.coConShort'), e, 'coConscious')}
        </div>
      ))}
    </div>
  );
}
