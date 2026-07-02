import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Member, MemberGroup, FrontState, FrontTier, FrontTierKey, HistoryEntry, NoteboardEntry,
  AppSettings, TIER_LABELS, DEFAULT_MOODS, EMPTY_TIER,
  fmtTime, fmtDur, getInitials, isFrontEmpty, frontToHistoryEntry, uid, translateMood,
  parseMoodList, toggleMoodInList, serializeMoodList,
} from '../utils';
import { store, KEYS } from '../storage';
import { Btn, Field, Section, Modal, ConfirmDialog } from '../components/ui';

interface Props {
  front: FrontState | null;
  members: Member[];
  groups: MemberGroup[];
  history: HistoryEntry[];
  settings: AppSettings;
  onUpdate: () => void;
  autoOpenEditor?: boolean;
  onAutoOpenConsumed?: () => void;
}

const TIER_COLORS: Record<FrontTierKey, string> = {
  primary: 'var(--accent)',
  coFront: 'var(--info)',
  coConscious: 'var(--success)',
};

const TIER_ORDER: FrontTierKey[] = ['primary', 'coFront', 'coConscious'];

export async function applyFrontUpdate(current: FrontState | null, primary: any, coFront: any, coConscious: any): Promise<FrontState | null> {
  if (current && !isFrontEmpty(current)) {
    const entry = frontToHistoryEntry(current, Date.now());
    const h = await store.get<HistoryEntry[]>(KEYS.history, []) || [];
    await store.set(KEYS.history, [entry, ...h]);
  }
  const newFront: FrontState = {
    primary: { memberIds: primary.memberIds || [], mood: primary.mood, note: primary.note || '', location: primary.location, energyLevel: primary.energyLevel },
    coFront: { memberIds: coFront.memberIds || [], mood: coFront.mood, note: coFront.note || '', energyLevel: coFront.energyLevel },
    coConscious: { memberIds: coConscious.memberIds || [], mood: coConscious.mood, note: coConscious.note || '', energyLevel: coConscious.energyLevel },
    startTime: Date.now(),
  };
  if (isFrontEmpty(newFront)) {
    await store.set(KEYS.front, null);
    return null;
  }
  await store.set(KEYS.front, newFront);
  return newFront;
}

export default function FrontView({ front, members, groups, history, settings, onUpdate, autoOpenEditor, onAutoOpenConsumed }: Props) {
  const { t } = useTranslation();
  const [tick, setTick] = useState(0);
  const [showSetFront, setShowSetFront] = useState(false);

  useEffect(() => {
    if (autoOpenEditor) { setShowSetFront(true); onAutoOpenConsumed?.(); }
  }, [autoOpenEditor]);
  const [editDetailTier, setEditDetailTier] = useState<FrontTierKey | null>(null);
  const [noteboardAlert, setNoteboardAlert] = useState<string[] | null>(null);
  const [editingNote, setEditingNote] = useState<FrontTierKey | null>(null);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const getMember = (id: string) => members.find(m => m.id === id);
  const activeMembers = members.filter(m => !m.archived);
  const allMoods = [...DEFAULT_MOODS, ...(settings.customMoods || [])];


  const saveFront = async (primary: any, coFront: any, coConscious: any) => {
    const newFront = await applyFrontUpdate(front, primary, coFront, coConscious);
    if (newFront) {
      const allFrontIds = [...newFront.primary.memberIds, ...newFront.coFront.memberIds, ...newFront.coConscious.memberIds];
      try {
        const notes = await store.get<NoteboardEntry[]>(KEYS.noteboards, []) || [];
        const withNotes = allFrontIds.filter(id => notes.some(n => n.memberId === id));
        if (withNotes.length > 0) {
          const names = withNotes.map(id => members.find(m => m.id === id)?.name || '?');
          setNoteboardAlert(names);
          setTimeout(() => setNoteboardAlert(null), 6000);
        }
      } catch {}
    }
    onUpdate();
  };

  const updateNote = async (tier: FrontTierKey, note: string) => {
    if (!front) return;
    const updated = { ...front, [tier]: { ...front[tier], note } };
    await store.set(KEYS.front, updated);
    onUpdate();
  };

  const updateTierDetail = async (tier: FrontTierKey, mood?: string, location?: string, note?: string) => {
    if (!front) return;
    const updated = {
      ...front,
      [tier]: {
        ...front[tier],
        mood: mood ?? front[tier].mood,
        location: tier === 'primary' ? (location ?? front[tier].location) : front[tier].location,
        note: note ?? front[tier].note,
      },
    };
    await store.set(KEYS.front, updated);
    setEditDetailTier(null);
    onUpdate();
  };


  const TierCard = ({ tierKey }: { tierKey: FrontTierKey }) => {
    if (!front) return null;
    const tier = front[tierKey];
    if (tier.memberIds.length === 0) return null;

    const color = TIER_COLORS[tierKey];
    const isPrimary = tierKey === 'primary';
    const isEditingNote = editingNote === tierKey;

    return (
      <div style={{ marginBottom: 16 }}>
        <div className="section-div">
          <span className="section-div__dot" style={{ background: color }} />
          <span className="section-div__label" style={{ color }}>{TIER_LABELS[tierKey]}</span>
          <span className="section-div__line" />
        </div>

        <div style={{
          padding: 16, background: 'var(--card)', border: `1px solid ${color}40`,
          borderRadius: 'var(--radius)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 10 }}>
            {tier.memberIds.map(id => {
              const m = getMember(id);
              if (!m) return null;
              return (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="tile__avatar" style={{
                    width: isPrimary ? 48 : 40, height: isPrimary ? 48 : 40,
                    fontSize: isPrimary ? 16 : 14, overflow: 'hidden',
                    ...(!m.avatar ? { backgroundColor: m.color } : {}),
                  }}>
                    {m.avatar ? <img src={m.avatar} alt="" style={{ width: isPrimary ? 48 : 40, height: isPrimary ? 48 : 40, borderRadius: '50%', objectFit: 'cover' }} /> : getInitials(m.name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: isPrimary ? 16 : 14, fontWeight: 500, color: 'var(--text)' }}>{m.name}</div>
                    {m.pronouns && <div style={{ fontSize: 12, color: 'var(--dim)' }}>{m.pronouns}</div>}
                    {m.role && <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: m.color, marginTop: 1 }}>{m.role.toUpperCase()}</div>}
                  </div>
                </div>
              );
            })}
          </div>

          {isPrimary && (
            <div style={{ borderTop: '1px solid var(--border)', padding: '8px 0', marginBottom: 8, fontSize: 11, color: 'var(--muted)' }}>
              Fronting for <span style={{ color: 'var(--accent)' }}>{fmtDur(front.startTime)}</span>
              {' · Since '}{fmtTime(front.startTime)}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 6 }}>
            {tier.mood && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 2 }}>{t('front.mood')}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{translateMood(tier.mood, t)}</div>
              </div>
            )}
            {isPrimary && tier.location && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 2 }}>{t('modal.location')}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{tier.location}</div>
              </div>
            )}
            {tier.energyLevel && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 2 }}>{t('energy.label')}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{tier.energyLevel}/10</div>
              </div>
            )}
            <button style={{ background: 'none', border: 'none', color: 'var(--dim)', fontSize: 14, cursor: 'pointer' }}
              onClick={() => setEditDetailTier(tierKey)}>✎</button>
          </div>
          {!tier.mood && !tier.location && (
            <button style={{ background: 'none', border: 'none', color: 'var(--dim)', fontSize: 12, cursor: 'pointer', padding: '4px 0' }}
              onClick={() => setEditDetailTier(tierKey)}>
              {isPrimary ? '+ Add mood / location' : '+ Add mood'}
            </button>
          )}

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--dim)', fontWeight: 600 }}>Front Note</span>
              {!isEditingNote ? (
                <button style={{ background: 'none', border: 'none', color: 'var(--dim)', fontSize: 14, cursor: 'pointer' }}
                  onClick={() => { setEditingNote(tierKey); setNoteText(tier.note || ''); }}>✎</button>
              ) : (
                <button style={{ background: 'none', border: 'none', color: 'var(--success)', fontSize: 14, cursor: 'pointer' }}
                  onClick={() => { setEditingNote(null); updateNote(tierKey, noteText); }}>✓</button>
              )}
            </div>
            {isEditingNote ? (
              <textarea className="field__input field__input--multi" value={noteText} onChange={e => setNoteText(e.target.value)}
                placeholder={t('modal.whatHappening')} style={{ minHeight: 56, fontSize: 12 }} />
            ) : (
              <p style={{ fontSize: 12, lineHeight: 1.5, color: tier.note ? 'var(--text)' : 'var(--muted)' }}>
                {tier.note || t('front.noNote')}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const empty = isFrontEmpty(front);

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text)', fontWeight: 600, fontStyle: 'italic', marginBottom: 10 }}>
          {t('front.currentlyFronting')}
        </h2>
        <Btn variant="primary" onClick={() => setShowSetFront(true)}>{t('front.update')}</Btn>
      </div>

      {noteboardAlert && (
        <div style={{
          padding: '10px 14px', marginBottom: 12, borderRadius: 8,
          background: 'var(--accent-bg)', border: '1px solid var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 13, color: 'var(--accent)' }}>
            📋 {t('noteboard.hasNotes', { names: noteboardAlert.join(', ') })}
          </span>
          <button style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 14 }}
            onClick={() => setNoteboardAlert(null)}>✕</button>
        </div>
      )}

      {empty ? (
        <div style={{
          padding: 32, textAlign: 'center', background: 'var(--card)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius)',
        }}>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>{t('front.noOneFronting')}</p>
          <Btn onClick={() => setShowSetFront(true)}>{t('front.setFront')}</Btn>
        </div>
      ) : (
        TIER_ORDER.map(t => <React.Fragment key={t}>{TierCard({ tierKey: t })}</React.Fragment>)
      )}

      <SetFrontModal
        open={showSetFront}
        onClose={() => setShowSetFront(false)}
        onSave={saveFront}
        members={activeMembers}
        groups={groups}
        current={front}
        settings={settings}
        allMoods={allMoods}
      />

      {editDetailTier && front && (
        <EditDetailModal
          open={!!editDetailTier}
          tier={editDetailTier}
          tierData={front[editDetailTier]}
          isPrimary={editDetailTier === 'primary'}
          allMoods={allMoods}
          allLocations={settings.locations}
          onClose={() => setEditDetailTier(null)}
          onSave={(mood, location, note) => updateTierDetail(editDetailTier, mood, location, note)}
        />
      )}
    </div>
  );
}


export function SetFrontModal({ open, onClose, onSave, members, groups, current, settings, allMoods }: {
  open: boolean; onClose: () => void; onSave: (p: any, cf: any, cc: any) => void;
  members: Member[]; groups: MemberGroup[]; current: FrontState | null;
  settings: AppSettings; allMoods: string[];
}) {
  const { t } = useTranslation();
  const [primaryIds, setPrimaryIds] = useState<Set<string>>(new Set());
  const [coFrontIds, setCoFrontIds] = useState<Set<string>>(new Set());
  const [coConsciousIds, setCoConsciousIds] = useState<Set<string>>(new Set());
  const [primaryMood, setPrimaryMood] = useState('');
  const [primaryLocation, setPrimaryLocation] = useState('');
  const [primaryNote, setPrimaryNote] = useState('');
  const [coFrontMood, setCoFrontMood] = useState('');
  const [coFrontNote, setCoFrontNote] = useState('');
  const [coConMood, setCoConMood] = useState('');
  const [coConNote, setCoConNote] = useState('');
  const [primaryEnergy, setPrimaryEnergy] = useState<number | undefined>(undefined);
  const [coFrontEnergy, setCoFrontEnergy] = useState<number | undefined>(undefined);
  const [coConEnergy, setCoConEnergy] = useState<number | undefined>(undefined);
  const [search, setSearch] = useState<Record<FrontTierKey, string>>({ primary: '', coFront: '', coConscious: '' });
  const [searchCf, setSearchCf] = useState<Record<FrontTierKey, string>>({ primary: '', coFront: '', coConscious: '' });
  const [customMood, setCustomMood] = useState<Record<FrontTierKey, string>>({ primary: '', coFront: '', coConscious: '' });
  const [showCustomMood, setShowCustomMood] = useState<Record<FrontTierKey, boolean>>({ primary: false, coFront: false, coConscious: false });
  const [confirmClear, setConfirmClear] = useState(false);

  const prevOpen = React.useRef(false);
  useEffect(() => {
    if (open && !prevOpen.current) {
      if (current) {
        setPrimaryIds(new Set(current.primary.memberIds));
        setCoFrontIds(new Set(current.coFront.memberIds));
        setCoConsciousIds(new Set(current.coConscious.memberIds));
        setPrimaryMood(current.primary.mood || '');
        setPrimaryLocation(current.primary.location || '');
        setPrimaryNote(current.primary.note || '');
        setCoFrontMood(current.coFront.mood || '');
        setCoFrontNote(current.coFront.note || '');
        setCoConMood(current.coConscious.mood || '');
        setCoConNote(current.coConscious.note || '');
        setPrimaryEnergy(current.primary.energyLevel);
        setCoFrontEnergy(current.coFront.energyLevel);
        setCoConEnergy(current.coConscious.energyLevel);
      } else {
        setPrimaryIds(new Set()); setCoFrontIds(new Set()); setCoConsciousIds(new Set());
        setPrimaryMood(''); setPrimaryLocation(''); setPrimaryNote('');
        setCoFrontMood(''); setCoFrontNote(''); setCoConMood(''); setCoConNote('');
        setPrimaryEnergy(undefined); setCoFrontEnergy(undefined); setCoConEnergy(undefined);
      }
      setSearch({ primary: '', coFront: '', coConscious: '' });
      setSearchCf({ primary: '', coFront: '', coConscious: '' });
      setCustomMood({ primary: '', coFront: '', coConscious: '' });
      setShowCustomMood({ primary: false, coFront: false, coConscious: false });
    }
    prevOpen.current = open;
  }, [open]);

  const allAssigned = useMemo(() => {
    const map: Record<string, FrontTierKey> = {};
    primaryIds.forEach(id => { map[id] = 'primary'; });
    coFrontIds.forEach(id => { map[id] = 'coFront'; });
    coConsciousIds.forEach(id => { map[id] = 'coConscious'; });
    return map;
  }, [primaryIds, coFrontIds, coConsciousIds]);

  const toggleMember = (tier: FrontTierKey, id: string) => {
    const setters: Record<FrontTierKey, [Set<string>, (s: Set<string>) => void]> = {
      primary: [primaryIds, setPrimaryIds], coFront: [coFrontIds, setCoFrontIds], coConscious: [coConsciousIds, setCoConsciousIds],
    };
    const [set, setter] = setters[tier];
    const next = new Set(set);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
      for (const [key, [otherSet, otherSetter]] of Object.entries(setters)) {
        if (key !== tier && otherSet.has(id)) {
          const cleaned = new Set(otherSet);
          cleaned.delete(id);
          otherSetter(cleaned);
        }
      }
    }
    setter(next);
  };

  const resolveMood = (tier: FrontTierKey, mood: string): string | undefined => {
    const moods = parseMoodList(mood);
    if (showCustomMood[tier] && customMood[tier].trim()) moods.push(customMood[tier].trim());
    return serializeMoodList(moods) || undefined;
  };

  const handleSave = () => {
    onSave(
      { memberIds: [...primaryIds], mood: resolveMood('primary', primaryMood), note: primaryNote, location: primaryLocation || undefined, energyLevel: primaryEnergy },
      { memberIds: [...coFrontIds], mood: resolveMood('coFront', coFrontMood), note: coFrontNote, energyLevel: coFrontEnergy },
      { memberIds: [...coConsciousIds], mood: resolveMood('coConscious', coConMood), note: coConNote, energyLevel: coConEnergy },
    );
    onClose();
  };

  const handleClear = () => setConfirmClear(true);
  const handleConfirmClear = () => {
    onSave({ memberIds: [] }, { memberIds: [] }, { memberIds: [] });
    setConfirmClear(false);
    onClose();
  };

  const TierPicker = ({ tierKey, selectedIds, mood, setMood, note, setNote, color, energy, setEnergy }: {
    tierKey: FrontTierKey; selectedIds: Set<string>;
    mood: string; setMood: (v: string) => void;
    note: string; setNote: (v: string) => void;
    color: string;
    energy?: number; setEnergy: (v: number | undefined) => void;
  }) => {
    const renderPool = (pool: Member[], q: string, setQ: (v: string) => void, showHint: boolean) => {
      const ql = q.toLowerCase();
      const filtered = ql ? pool.filter(m => !selectedIds.has(m.id) && m.name.toLowerCase().includes(ql)) : [];
      const poolSelected = pool.filter(m => selectedIds.has(m.id));
      return (
        <>
          {poolSelected.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {poolSelected.map(m => (
                <button key={m.id} className="chip" style={{ borderColor: `${m.color}50`, background: `${m.color}20` }}
                  onClick={() => toggleMember(tierKey, m.id)}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, display: 'inline-block' }} />
                  <span style={{ color: m.color }}>{m.name}</span>
                  <span style={{ fontSize: 10, color: m.color }}>✕</span>
                </button>
              ))}
            </div>
          )}
          <input className="field__input" value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={t('members.searchToAdd')} style={{ marginBottom: 6, fontSize: 12 }} />
          {ql && filtered.length > 0 && (
            <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', marginBottom: 10 }}>
              {filtered.slice(0, 20).map(m => {
                const assignedTo = allAssigned[m.id];
                return (
                  <button key={m.id} onClick={() => toggleMember(tierKey, m.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', opacity: assignedTo && assignedTo !== tierKey ? 0.5 : 1 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: m.color, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ flex: 1, color: 'var(--text)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                    {m.pronouns ? <span style={{ fontSize: 11, color: 'var(--muted)' }}>{m.pronouns}</span> : null}
                    {assignedTo && assignedTo !== tierKey && (
                      <span style={{ fontSize: 10, color: 'var(--muted)', fontStyle: 'italic' }}>({TIER_LABELS[assignedTo].split(' ')[0]})</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {showHint && !ql && poolSelected.length === 0 && (
            <p style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', textAlign: 'center', padding: '4px 0 8px' }}>{t('members.searchHint')}</p>
          )}
        </>
      );
    };

    const regularPool = members.filter(m => !m.isCustomFront && !m.deleted);
    const customPool = members.filter(m => m.isCustomFront && !m.deleted);

    return (
      <div style={{ marginBottom: 16 }}>
        <div className="section-div">
          <span className="section-div__dot" style={{ background: color }} />
          <span className="section-div__label" style={{ color }}>{TIER_LABELS[tierKey]}</span>
          <span className="section-div__line" />
        </div>

        {renderPool(regularPool, search[tierKey], v => setSearch({ ...search, [tierKey]: v }), true)}

        {customPool.length > 0 && (
          <>
            <label className="field__label">{t('members.customFronts')}</label>
            {renderPool(customPool, searchCf[tierKey], v => setSearchCf({ ...searchCf, [tierKey]: v }), false)}
          </>
        )}

        <label className="field__label" style={{ marginTop: 4 }}>{t('modal.mood')}</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
          {(() => { const sel = parseMoodList(mood); const chips = [...allMoods, ...sel.filter(m => !allMoods.includes(m))]; return chips.map(m => {
            const on = sel.includes(m);
            return (
              <button key={m} className={`btn ${on ? 'btn--primary' : 'btn--ghost'}`}
                style={{ padding: '4px 10px', fontSize: 11 }}
                onClick={() => setMood(toggleMoodInList(mood, m))}>{translateMood(m, t)}</button>
            );
          }); })()}
          <button className={`btn ${showCustomMood[tierKey] ? 'btn--primary' : 'btn--ghost'}`}
            style={{ padding: '4px 10px', fontSize: 11 }}
            onClick={() => setShowCustomMood({ ...showCustomMood, [tierKey]: !showCustomMood[tierKey] })}>
            {showCustomMood[tierKey] ? `− ${t('modal.custom')}` : `+ ${t('modal.custom')}`}
          </button>
        </div>
        {showCustomMood[tierKey] && (
          <input className="field__input" value={customMood[tierKey]}
            onChange={e => setCustomMood({ ...customMood, [tierKey]: e.target.value })}
            placeholder={t('modal.enterMood')} style={{ fontSize: 12, marginBottom: 8 }} />
        )}

        {tierKey === 'primary' && (
          <>
            <label className="field__label" style={{ marginTop: 4 }}>{t('modal.location')}</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 4 }}>
              {(settings.locations || []).map(l => (
                <button key={l} className={`btn ${primaryLocation === l ? 'btn--primary' : 'btn--ghost'}`}
                  style={{ padding: '4px 10px', fontSize: 11 }}
                  onClick={() => setPrimaryLocation(primaryLocation === l ? '' : l)}>{l}</button>
              ))}
            </div>
            <input className="field__input" value={primaryLocation} onChange={e => setPrimaryLocation(e.target.value)}
              placeholder={t('modal.typeLocation')} style={{ fontSize: 12, marginBottom: 8 }} />
          </>
        )}

        <label className="field__label" style={{ marginTop: 4 }}>{t('energy.level')}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 28 }}>{energy ?? '—'}</span>
          <input type="range" min={1} max={10} value={energy ?? 5} aria-label={t('energy.level')}
            onChange={e => setEnergy(Number(e.target.value))}
            style={{ flex: 1, accentColor: color }} />
          <button className="btn btn--ghost" style={{ padding: '2px 8px', fontSize: 10 }}
            onClick={() => setEnergy(undefined)}>✕</button>
        </div>

        <textarea className="field__input field__input--multi" value={note} onChange={e => setNote(e.target.value)}
          placeholder={t('modal.whatHappening')} style={{ minHeight: 48, fontSize: 12 }} />
      </div>
    );
  };

  return (
    <>
      <Modal open={open} title={t('modal.updateFront')} onClose={onClose}
        footer={
          <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'space-between' }}>
            <Btn variant="ghost" onClick={handleClear}>{t('front.clearFront')}</Btn>
            <Btn variant="solid" onClick={handleSave}>{t('common.save')}</Btn>
          </div>
        }>
        {/* Call as a function (not <TierPicker/>) so the inputs are part of this modal's
            own render tree — defining a component inside render gave it a new identity on
            every keystroke, remounting the input and dropping focus after one character. */}
        {TierPicker({ tierKey: 'primary', selectedIds: primaryIds, mood: primaryMood, setMood: setPrimaryMood, note: primaryNote, setNote: setPrimaryNote, color: 'var(--accent)', energy: primaryEnergy, setEnergy: setPrimaryEnergy })}
        {TierPicker({ tierKey: 'coFront', selectedIds: coFrontIds, mood: coFrontMood, setMood: setCoFrontMood, note: coFrontNote, setNote: setCoFrontNote, color: 'var(--info)', energy: coFrontEnergy, setEnergy: setCoFrontEnergy })}
        {TierPicker({ tierKey: 'coConscious', selectedIds: coConsciousIds, mood: coConMood, setMood: setCoConMood, note: coConNote, setNote: setCoConNote, color: 'var(--success)', energy: coConEnergy, setEnergy: setCoConEnergy })}
      </Modal>
      <ConfirmDialog
        open={confirmClear}
        title={t('front.clearFrontTitle')}
        message={t('front.clearFrontMsg')}
        danger
        onConfirm={handleConfirmClear}
        onCancel={() => setConfirmClear(false)}
      />
    </>
  );
}


function EditDetailModal({ open, tier, tierData, isPrimary, allMoods, allLocations, onClose, onSave }: {
  open: boolean; tier: FrontTierKey; tierData: FrontTier; isPrimary: boolean;
  allMoods: string[]; allLocations: string[];
  onClose: () => void; onSave: (mood?: string, location?: string, note?: string) => void;
}) {
  const [mood, setMood] = useState(tierData.mood || '');
  const [location, setLocation] = useState(tierData.location || '');
  const [note, setNote] = useState(tierData.note || '');
  const { t } = useTranslation();

  useEffect(() => {
    setMood(tierData.mood || '');
    setLocation(tierData.location || '');
    setNote(tierData.note || '');
  }, [tierData, open]);

  return (
    <Modal open={open} title={t('tier.editTier', { tier: TIER_LABELS[tier] })} onClose={onClose}
      footer={<Btn variant="solid" onClick={() => onSave(mood || undefined, isPrimary ? location || undefined : undefined, note || undefined)}>{t('common.save')}</Btn>}>
      <label className="field__label">{t('modal.mood')}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
        {allMoods.map(m => (
          <button key={m} className={`btn ${mood === m ? 'btn--primary' : 'btn--ghost'}`}
            style={{ padding: '4px 10px', fontSize: 11 }}
            onClick={() => setMood(mood === m ? "" : m)}>{translateMood(m, t)}</button>
        ))}
      </div>
      {isPrimary && (
        <>
          <label className="field__label">{t('modal.location')}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 4 }}>
            {allLocations.map(l => (
              <button key={l} className={`btn ${location === l ? 'btn--primary' : 'btn--ghost'}`}
                style={{ padding: '4px 10px', fontSize: 11 }}
                onClick={() => setLocation(location === l ? '' : l)}>{l}</button>
            ))}
          </div>
          <input className="field__input" value={location} onChange={e => setLocation(e.target.value)}
            placeholder={t('modal.typeLocation')} style={{ fontSize: 12, marginBottom: 10 }} />
        </>
      )}
      <Field label={t('modal.note')} value={note} onChange={setNote} placeholder={t('modal.whatHappening')} multiline />
    </Modal>
  );
}
