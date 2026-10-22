import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FrontTierKey, Member, DAY_MS, fmtDur, fmtNum, translateMood, isSingletHiddenStatus, localDateKey, parseFieldDate } from '../utils';
import { StatsRange, TierBoardEntry, STATS_RANGES, computeStats, memberDetail, memberKind, statsWindow } from '../stats/compute';
import { Interp, slots } from '../components/ui';
import { useAppStore } from '../store/appStore';
import { getTierNameOverride } from '../i18n/terminology';
import { Board, BoardRow, HourChart, MemberChips, countRows, memberRows, nextBoardLimit } from './stats/StatsParts';
import { useChatMessages } from './stats/useChatMessages';

interface Props {
  singlet?: boolean;
  selfId?: string;
}

const RANGE_LABEL: Record<StatsRange, string> = { all: 'stats.allTime', '7d': 'stats.last7', '30d': 'stats.last30', custom: 'stats.customRange' };
const DEFAULT_LIMIT = 5;
const LAST_30_MS = 30 * DAY_MS;

const QUICK_RANGES: [string, () => [number, number]][] = [
  ['stats.last30', () => { const now = Date.now(); return [now - LAST_30_MS, now]; }],
  ['stats.thisMonth', () => { const now = new Date(); return [new Date(now.getFullYear(), now.getMonth(), 1).getTime(), now.getTime()]; }],
  ['stats.thisYear', () => { const now = new Date(); return [new Date(now.getFullYear(), 0, 1).getTime(), now.getTime()]; }],
];

const dayValue = (ts: number) => localDateKey(new Date(ts));
const dayTs = (value: string): number | null => parseFieldDate(value)?.getTime() ?? null;

export default function StatsView({ singlet = false, selfId }: Props) {
  const { t } = useTranslation();
  const history = useAppStore(s => s.history);
  const members = useAppStore(s => s.members);
  const channels = useAppStore(s => s.channels);
  const chatMessages = useChatMessages(channels);
  const [range, setRange] = useState<StatsRange>('all');
  const [customStart, setCustomStart] = useState<number>(() => Date.now() - LAST_30_MS);
  const [customEnd, setCustomEnd] = useState<number>(() => Date.now());
  const [selected, setSelected] = useState<string | null>(null);
  const [boardLimits, setBoardLimits] = useState<Record<string, number>>({});
  const detailsHeadingId = useId();

  const memberById = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);
  const getMember = (id: string) => memberById.get(id);
  const limitFor = (k: string) => boardLimits[k] ?? DEFAULT_LIMIT;
  const expand = (k: string) => () => setBoardLimits(p => ({ ...p, [k]: nextBoardLimit(p[k] ?? DEFAULT_LIMIT) }));
  const tierHeading = (tier: FrontTierKey, stock: string): string => {
    const custom = getTierNameOverride(tier);
    return custom ? t('stats.topTier', { tier: custom }) : stock;
  };

  const timeWindow = useMemo(() => statsWindow(range, customStart, customEnd), [range, customStart, customEnd]);
  const stats = useMemo(
    () => computeStats({ history, chatMessages, members, period: timeWindow, singlet, selfId }),
    [history, chatMessages, members, timeWindow, singlet, selfId],
  );
  const detail = useMemo(
    () => (selected ? memberDetail(stats.entries, selected, singlet, selfId) : null),
    [stats, selected, singlet, selfId],
  );

  const setCustomRange = (start: number, end: number) => {
    setCustomStart(start);
    setCustomEnd(end);
  };
  const tierRows = (entries: TierBoardEntry[]): BoardRow[] => entries.map(e => {
    const m = getMember(e.id);
    return { key: e.id, label: m?.name || t('common.unknown'), value: e.time, color: m?.color || 'var(--accent)', suffix: `${fmtDur(0, e.time)} · ${t('stats.sessionCount', { count: e.sessions, num: fmtNum(e.sessions, 0) })}` };
  });
  const board = (key: string, title: string, rows: BoardRow[], emptyLabel = t('common.noData')) => (
    <Board key={key} title={title} rows={rows} limit={limitFor(key)} onExpand={expand(key)} emptyLabel={emptyLabel} />
  );

  const live = members.filter(m => !m.archived);
  const chipGroups: { key: string; label?: string; members: Member[] }[] = singlet
    ? [{ key: 'main', members: live.filter(m => !m.isFacet && m.isCustomFront && !isSingletHiddenStatus(m)) }]
    : [
      { key: 'main', members: live.filter(m => !m.isFacet && !m.isCustomFront) },
      { key: 'facets', label: t('members.facets'), members: live.filter(m => m.isFacet) },
      { key: 'cf', label: t('members.customFronts'), members: live.filter(m => m.isCustomFront && !m.isFacet) },
    ];
  const toggleSelected = (id: string) => setSelected(cur => (cur === id ? null : id));
  const selectedMember = selected ? getMember(selected) : undefined;
  const accent = selectedMember?.color || 'var(--accent)';
  const bigStat = (text: string, num: string) => (
    <div><Interp text={text} textStyle={{ fontSize: 11, color: 'var(--muted)' }}
      nodes={{ num: <span style={{ fontSize: 20, fontWeight: 700, color: accent }}>{num}</span> }} /></div>
  );
  const coGroups = !detail ? [] : (singlet
    ? [{ key: 'coMembers', label: t('stats.coStatuses'), all: detail.coMembers }]
    : [
      { key: 'coMembers', label: t('stats.topCoMembers'), all: detail.coMembers.filter(([id]) => memberKind(getMember(id)) === 'member') },
      { key: 'coFacets', label: t('members.facets'), all: detail.coMembers.filter(([id]) => memberKind(getMember(id)) === 'facet') },
      { key: 'coCustomFronts', label: t('members.customFronts'), all: detail.coMembers.filter(([id]) => memberKind(getMember(id)) === 'customFront') },
    ]).filter(g => g.all.length > 0);

  const tiles = [
    { label: t('stats.totalSessions'), value: fmtNum(stats.totalSessions, 0) },
    { label: t('stats.totalFrontTime'), value: fmtDur(0, stats.totalMs) },
    ...(singlet ? [] : [
      { label: t('stats.uniqueFronters'), value: fmtNum(stats.fronters.length, 0) },
      { label: t('stats.chatMessages'), value: fmtNum(stats.totalMessages, 0) },
    ]),
  ];

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {STATS_RANGES.map(r => (
          <button key={r} type="button" className={`btn ${range === r ? 'btn--primary' : 'btn--ghost'}`} aria-pressed={range === r} onClick={() => setRange(r)}>
            {t(RANGE_LABEL[r])}
          </button>
        ))}
      </div>

      {range === 'custom' && (
        <div style={{ padding: 14, background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
            <label className="field">
              <span className="field__label">{t('stats.rangeStart')}</span>
              <input className="field__input" type="date" value={dayValue(customStart)} max={dayValue(customEnd)}
                onChange={e => { const ts = dayTs(e.target.value); if (ts !== null) setCustomRange(ts, Math.max(ts, customEnd)); }} />
            </label>
            <label className="field">
              <span className="field__label">{t('stats.rangeEnd')}</span>
              <input className="field__input" type="date" value={dayValue(customEnd)} min={dayValue(customStart)}
                onChange={e => { const ts = dayTs(e.target.value); if (ts !== null) setCustomRange(Math.min(customStart, ts), ts); }} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {QUICK_RANGES.map(([labelKey, span]) => (
              <button key={labelKey} type="button" className="btn btn--ghost" onClick={() => setCustomRange(...span())}>{t(labelKey)}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        {tiles.map(({ label, value }) => (
          <div key={label} style={{ padding: 16, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
        {board('fronters', singlet ? t('stats.topStatuses') : tierHeading('primary', t('stats.topFronters')), tierRows(stats.fronters))}
        {!singlet && board('cofronters', tierHeading('coFront', t('stats.topCoFronters')), tierRows(stats.coFronters))}
        {!singlet && board('cocon', tierHeading('coConscious', t('stats.topCoCon')), tierRows(stats.coConscious))}
        {!singlet && board('chatters', t('stats.topChatters'), memberRows(stats.chatters, getMember, t('common.unknown')))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20, marginTop: 20 }}>
        {board('moods', t('stats.topMoods'), countRows(stats.moods, 'var(--info)', mood => translateMood(mood, t)), t('stats.noMoodsRecorded'))}
        {board('locations', t('stats.topLocations'), countRows(stats.locations, 'var(--success)'), t('stats.noLocationsRecorded'))}
      </div>

      {stats.energyAvgs.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <Board title={t('energy.avgEnergy')} limit={8} max={10}
            rows={memberRows(stats.energyAvgs.map(({ id, avg }): [string, number] => [id, avg]), getMember, '?', avg => t('energy.outOfTen', { value: fmtNum(avg, 1) }))} />
        </div>
      )}

      <HourChart title={t('stats.peakHours')} values={stats.peakHours} highlightMax valueLabel={c => fmtNum(c)}
        height={(c, peak) => (c / peak) * 100} />

      {stats.energyByHour.some(v => v > 0) && (
        <HourChart title={t('stats.energyByHour')} values={stats.energyByHour} minPct={3} valueLabel={avg => t('energy.outOfTen', { value: fmtNum(avg, 1) })}
          height={avg => (avg / 10) * 100} />
      )}

      <div style={{ marginTop: 20 }}>
        <h3 id={detailsHeadingId} style={{ fontSize: 13, fontFamily: 'var(--font-display)', color: 'var(--accent)', marginBottom: 10 }}>{singlet ? t('stats.statusDetails') : t('stats.memberDetails')}</h3>
        {chipGroups.filter(g => g.key === 'main' || g.members.length > 0).map(g => (
          <div key={g.key}>
            {g.label && <div className="field__label" id={`${detailsHeadingId}-${g.key}`}>{g.label}</div>}
            <MemberChips members={g.members} selected={selected} onToggle={toggleSelected} labelledBy={g.label ? `${detailsHeadingId}-${g.key}` : detailsHeadingId} />
          </div>
        ))}

        {detail && selected && (
          <div style={{ padding: 14, background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
              {bigStat(t('stats.sessionCount', { count: detail.sessions, ...slots('num') }), fmtNum(detail.sessions, 0))}
              {detail.avgEnergy !== null && bigStat(t('stats.avgEnergyValue', slots('num')), fmtNum(detail.avgEnergy, 1))}
            </div>
            {coGroups.map(g => (
              <Board key={g.key} sub title={g.label} rows={memberRows(g.all, getMember, '?', undefined, 'var(--info)')} limit={limitFor(g.key)} onExpand={expand(g.key)} />
            ))}
            {detail.moods.length > 0 && (
              <Board sub title={t('stats.topMoods')} rows={countRows(detail.moods, 'var(--info)', mood => translateMood(mood, t))} limit={limitFor('coMoods')} onExpand={expand('coMoods')} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
