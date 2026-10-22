import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Member, FrontTier, FrontTierKey, FrontSortMode, AppSettings, isFrontEmpty, moodChoices, orderFronters, placeInCustomOrder, fmtList, frontTiersWithout, FRONT_TIER_KEYS } from '../utils';
import { saveData, patchSettings, updateFront } from '../store/actions';
import { Btn, ConfirmDialog, SaveErrorDialog, linkButton, useDndA11y } from '../components/ui';
import { useSaveGuard } from '../hooks/useSaveGuard';
import { useAppStore } from '../store/appStore';
import { useMinuteTick } from '../hooks/useMinuteTick';
import { useFlash } from '../hooks/useFlash';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useSortSensors } from '../components/SortableCard';
import { TierCard } from './front/TierCard';
import { SetFrontModal } from './front/SetFrontModal';
import { EditDetailModal } from './front/EditDetailModal';

interface Props {
  onOpenMember?: (id: string) => void;
}

const FRONT_SORTS: [FrontSortMode, string][] = [
  ['added', 'frontSort.added'],
  ['az', 'frontSort.az'],
  ['za', 'frontSort.za'],
  ['custom', 'frontSort.custom'],
];

export default function FrontView({ onOpenMember }: Props) {
  useMinuteTick();
  const front = useAppStore(s => s.front);
  const members = useAppStore(s => s.members);
  const settings = useAppStore(s => s.settings);
  const { t } = useTranslation();
  const [showSetFront, setShowSetFront] = useState(false);
  const [editDetailTier, setEditDetailTier] = useState<FrontTierKey | null>(null);
  const [noteboardAlert, flashNoteboardAlert, clearNoteboardAlert] = useFlash<string[]>(6000);
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);
  const [saveError, run, clearSaveError] = useSaveGuard();

  const memberById = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);
  const getMember = (id: string) => memberById.get(id);
  const activeMembers = useMemo(() => members.filter(m => !m.archived), [members]);
  const allMoods = useMemo(() => moodChoices(settings.customMoods), [settings.customMoods]);

  const frontSortMode: FrontSortMode = settings.frontSortMode || 'added';
  const customOn = frontSortMode === 'custom';
  const sensors = useSortSensors();
  const frontDndA11y = useDndA11y(id => getMember(String(id))?.name || '');

  const saveFrontSort = (patch: Pick<AppSettings, 'frontSortMode' | 'frontCustomOrder'>) =>
    run(() => patchSettings(patch));
  const orderedIds = (tier: FrontTier) =>
    orderFronters(tier.memberIds.filter(id => !!getMember(id)), frontSortMode, id => getMember(id)?.name || '', settings.frontCustomOrder);
  const onTierDragEnd = ({ active, over }: DragEndEvent, ids: string[]) => {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const live = useAppStore.getState();
    const keep = (id: string) => live.members.some(m => m.id === id && !m.deleted);
    void saveFrontSort({ frontCustomOrder: placeInCustomOrder(live.settings.frontCustomOrder, arrayMove(ids, from, to), keep) });
  };

  const saveFront = (primary: Partial<FrontTier>, coFront: Partial<FrontTier>, coConscious: Partial<FrontTier>) => run(async () => {
    const newFront = await updateFront(primary, coFront, coConscious);
    if (!newFront) return;
    const notes = useAppStore.getState().noteboards;
    const withNotes = FRONT_TIER_KEYS.flatMap(k => newFront[k].memberIds).filter(id => notes.some(n => n.memberId === id));
    if (withNotes.length > 0) flashNoteboardAlert(withNotes.map(id => getMember(id)?.name || '?'));
  });

  const quickRemove = (memberId: string) => {
    if (!front) return;
    const tiers = frontTiersWithout(front, memberId);
    void saveFront(tiers.primary, tiers.coFront, tiers.coConscious);
  };

  const saveTier = (tier: FrontTierKey, patch: Partial<FrontTier>) => run(async () => {
    const live = useAppStore.getState().front;
    if (live) await saveData('front', { ...live, [tier]: { ...live[tier], ...patch } });
  });

  const updateTierDetail = async (tier: FrontTierKey, mood?: string, location?: string, note?: string) => {
    await saveTier(tier, { mood, location, note: note || '' });
    setEditDetailTier(null);
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text)', fontWeight: 600, fontStyle: 'italic', marginBottom: 10 }}>
          {t('front.currentlyFronting')}
        </h2>
        <Btn variant="primary" onClick={() => setShowSetFront(true)}>{t('front.update')}</Btn>
      </div>

      {!isFrontEmpty(front) && (
        <div role="group" aria-label={t('frontSort.label')} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {FRONT_SORTS.map(([mode, key]) => {
            const sel = frontSortMode === mode;
            return (
              <button key={mode} type="button" aria-pressed={sel} onClick={() => { if (!sel) void saveFrontSort({ frontSortMode: mode }); }}
                style={{ padding: '5px 12px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
                  background: sel ? 'var(--accent-bg)' : 'var(--surface)', color: sel ? 'var(--accent)' : 'var(--dim)',
                  border: `1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`, fontWeight: sel ? 600 : 400 }}>
                {t(key)}
              </button>
            );
          })}
        </div>
      )}

      {noteboardAlert && (
        <div role="status" style={{
          padding: '10px 14px', marginBottom: 12, borderRadius: 8, background: 'var(--accent-bg)', border: '1px solid var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 13, color: 'var(--accent)' }}>
            <span aria-hidden>📋</span> {t('noteboard.hasNotes', { names: fmtList(noteboardAlert) })}
          </span>
          <button type="button" aria-label={t('common.close')} style={linkButton('var(--accent)', 14)}
            onClick={clearNoteboardAlert}>✕</button>
        </div>
      )}

      {!front || isFrontEmpty(front) ? (
        <div style={{ padding: 32, textAlign: 'center', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>{t('front.noOneFronting')}</p>
          <Btn onClick={() => setShowSetFront(true)}>{t('front.setFront')}</Btn>
        </div>
      ) : (
        FRONT_TIER_KEYS.filter(key => front[key].memberIds.length > 0).map(key => {
          const ids = orderedIds(front[key]);
          return (
            <TierCard key={key} tierKey={key} front={front} tier={front[key]} getMember={getMember} ids={ids} canDrag={customOn && ids.length > 1}
              onSaveNote={(tier, note) => { void saveTier(tier, { note }); }} onEditDetail={setEditDetailTier} onRemove={setConfirmRemove}
              onOpenMember={onOpenMember} sensors={sensors} onTierDragEnd={onTierDragEnd} dndA11y={frontDndA11y} />
          );
        })
      )}

      <SetFrontModal open={showSetFront} onClose={() => setShowSetFront(false)} onSave={saveFront}
        members={activeMembers} current={front} settings={settings} allMoods={allMoods} />

      {editDetailTier && front && (
        <EditDetailModal tier={editDetailTier} tierData={front[editDetailTier]} allMoods={allMoods} allLocations={settings.locations}
          onClose={() => setEditDetailTier(null)} onSave={(mood, location, note) => updateTierDetail(editDetailTier, mood, location, note)} />
      )}

      <ConfirmDialog open={!!confirmRemove}
        title={confirmRemove ? t('front.quickRemove', { name: confirmRemove.name }) : ''}
        message={confirmRemove ? t('members.removeFromFrontMsg', { name: confirmRemove.name }) : ''}
        danger single
        onConfirm={() => { if (confirmRemove) quickRemove(confirmRemove.id); setConfirmRemove(null); }}
        onCancel={() => setConfirmRemove(null)} />
      <SaveErrorDialog error={saveError} onClose={clearSaveError} />
    </div>
  );
}
