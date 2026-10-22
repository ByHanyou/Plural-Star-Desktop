import { useTranslation } from 'react-i18next';
import { HistoryEntry, Member, fmtTime, fmtDur, historyTier } from '../../utils';
import { TierDetailLine } from '../../components/TierDetailLine';
import { linkButton } from '../../components/ui';
import { MemberAvatar } from '../../components/MemberAvatar';
import { tint } from '../../theme';

function MemberChip({ member: m }: { member: Member }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: m.color, padding: '2px 8px', borderRadius: 999,
      background: tint(m.color, 8), border: `1px solid ${tint(m.color, 19)}`,
    }}>
      <MemberAvatar member={m} size={16} fontSize={8} decorative />
      {m.name}
    </span>
  );
}

export function HistoryEntryCard({ entry, end, getMember, chipIds, showCoTiers, onDelete }: {
  entry: HistoryEntry;
  end: number | null;
  getMember: (id: string) => Member | undefined;
  chipIds: string[];
  showCoTiers: boolean;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const chips = (ids: string[]) => ids.flatMap(id => {
    const m = getMember(id);
    return m ? [<MemberChip key={id} member={m} />] : [];
  });
  const coTiers = showCoTiers ? [
    { tier: historyTier(entry, 'coFront'), label: t('tier.coFront') },
    { tier: historyTier(entry, 'coConscious'), label: t('tier.coConShort') },
  ].filter(c => c.tier.memberIds.length > 0) : [];

  return (
    <div style={{ padding: 12, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {chips(chipIds)}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
          {fmtTime(entry.startTime)} - {end ? fmtTime(end) : t('history.now')}
        </span>
        <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtDur(entry.startTime, end)}</span>
      </div>

      {coTiers.map((c, i) => (
        <div key={c.label} style={{ marginTop: i === 0 ? 6 : 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('common.labelColon', { label: c.label })}</span>
            {chips(c.tier.memberIds)}
          </div>
          <TierDetailLine tier={c.tier} style={{ marginTop: 3, marginLeft: 4 }} />
        </div>
      ))}

      <TierDetailLine tier={historyTier(entry, 'primary')} style={{ marginTop: 6 }} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
        <button type="button" style={{ ...linkButton('var(--danger)'), opacity: 0.6, padding: '2px 6px' }}
          aria-label={t('history.deleteEntryAt', { time: fmtTime(entry.startTime) })} onClick={onDelete}>
          {t('history.deleteEntry')}
        </button>
      </div>
    </div>
  );
}
