import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Member, MemberSortMode, MEMBER_SORT_MODES, FrontTierKey, blankMember, randomPaletteColor, sortMembers, memberMatchesSearch, uniqueTags, tagKey, setSubsystemLinks, allFrontMemberIds, toggleInSet } from '../utils';
import {
  saveData, saveMember, patchSettings, deleteMember, restoreDeletedMember,
  bulkSetFacet, bulkSetArchived, bulkDeleteMembers, bulkAddGroups, bulkAddTags,
} from '../store/actions';
import { useSaveGuard } from '../hooks/useSaveGuard';
import { Btn, Section, ConfirmDialog, EmptyState, SaveErrorDialog, Dropdown, useDndA11y } from '../components/ui';
import { useAppStore } from '../store/appStore';
import { DndContext, closestCenter } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import SortableCard, { ReorderLockButton, useSortSensors } from '../components/SortableCard';
import { MemberAvatar } from '../components/MemberAvatar';
import SystemManagerView from './SystemManagerView';
import MemberEditor from './members/MemberEditor';
import { TagAssignDialog } from './members/TagAssignDialog';
import { GroupAssignDialog } from './members/GroupAssignDialog';
import { MemberCard, MemberListFields } from './members/MemberCard';
import { ListFieldsMenu } from './members/ListFieldsMenu';
import { TagFilter } from './members/TagFilter';
import { QuickFrontDialogs, QuickFrontTarget } from './members/QuickFront';

type ListView = 'active' | 'customFronts' | 'facets';
type BulkKind = 'archive' | 'restore' | 'delete' | 'facet';

interface Props {
  archiveOnly?: boolean;
  focusMemberId?: string | null;
  onFocusHandled?: () => void;
  onShowOnMap?: (id: string) => void;
  onQuickFront?: (memberId: string, tier: FrontTierKey) => void;
  onRemoveFromFront?: (memberId: string) => void;
}

const DEFAULT_FIELDS: MemberListFields = { pronouns: true, roles: true, groups: false, descriptions: false };
const EMPTY_KEYS: Record<ListView, string> = { active: 'members.noMembers', facets: 'members.noFacets', customFronts: 'members.noCustomFronts' };
const ARCHIVED_EMPTY_KEYS: Record<ListView, string> = { active: 'members.noArchived', facets: 'members.noArchivedFacets', customFronts: 'members.noArchivedCustomFronts' };
const ADD_KEYS: Record<ListView, string> = { active: 'members.add', facets: 'members.addFacet', customFronts: 'members.addCustomFront' };

const inListView = (m: Member, view: ListView): boolean =>
  view === 'customFronts' ? !!m.isCustomFront : !m.isCustomFront && (view === 'facets') === !!m.isFacet;

export default function MembersView({ archiveOnly = false, focusMemberId, onFocusHandled, onShowOnMap, onQuickFront, onRemoveFromFront }: Props) {
  const members = useAppStore(s => s.members);
  const groups = useAppStore(s => s.groups);
  const settings = useAppStore(s => s.settings);
  const front = useAppStore(s => s.front);
  const { t } = useTranslation();
  const listFields = settings.memberListFields ?? DEFAULT_FIELDS;
  const [editing, setEditing] = useState<Member | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [editSession, setEditSession] = useState(0);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [listView, setListView] = useState<ListView>('active');
  const [sortMode, setSortMode] = useState<MemberSortMode>(settings.memberSortMode || 'alphabetical');
  const [reorderLocked, setReorderLocked] = useState(true);
  const [quickFront, setQuickFront] = useState<QuickFrontTarget | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState<BulkKind | null>(null);
  const [showGroupAssign, setShowGroupAssign] = useState(false);
  const [showTagAssign, setShowTagAssign] = useState(false);
  const [saveError, run, clearSaveError] = useSaveGuard();

  const exitSelection = () => { setSelectionMode(false); setSelectedIds(new Set()); setBulkConfirm(null); setShowGroupAssign(false); setShowTagAssign(false); };
  const switchListView = (v: ListView) => { if (v !== listView) exitSelection(); setListView(v); };
  const saveListFields = (next: MemberListFields) => { void run(() => patchSettings({ memberListFields: next })); };
  const changeSortMode = (mode: MemberSortMode) => { setSortMode(mode); void run(() => patchSettings({ memberSortMode: mode })); };
  const browseGroups = !archiveOnly && listFields.browse === true;
  const toggleBrowseGroups = () => { exitSelection(); saveListFields({ ...listFields, browse: !browseGroups }); };
  const toggleSelected = (id: string) => setSelectedIds(prev => toggleInSet(prev, id));

  const frontingIds = useMemo(() => new Set(allFrontMemberIds(front)), [front]);
  const quickFrontEnabled = !!onQuickFront && !!onRemoveFromFront && !archiveOnly;

  const inStateMembers = useMemo(() => members.filter(m => !m.deleted && archiveOnly === !!m.archived), [members, archiveOnly]);
  const counts: Record<ListView, number> = {
    active: inStateMembers.filter(m => inListView(m, 'active')).length,
    facets: inStateMembers.filter(m => inListView(m, 'facets')).length,
    customFronts: inStateMembers.filter(m => inListView(m, 'customFronts')).length,
  };
  const inView = useMemo(() => inStateMembers.filter(m => inListView(m, listView)), [inStateMembers, listView]);
  const sorted = sortMembers(inView, sortMode);
  const deletedMembers = archiveOnly ? members.filter(m => m.deleted && inListView(m, listView)) : [];
  const allTags = useMemo(() => uniqueTags(inView.flatMap(m => m.tags || [])), [inView]);
  const knownTags = useMemo(() => uniqueTags(members.filter(m => !m.deleted).flatMap(m => m.tags || [])), [members]);
  const activeTagKey = activeTag ? tagKey(activeTag) : null;
  const filtered = sorted.filter(m => memberMatchesSearch(m, search) && (!activeTagKey || (m.tags || []).some(tag => tagKey(tag) === activeTagKey)));

  const canReorder = !archiveOnly && sortMode === 'manual' && !search && !activeTag;
  const reorderActive = canReorder && !reorderLocked;

  const sensors = useSortSensors();
  const membersDndA11y = useDndA11y(id => members.find(m => m.id === id)?.name || '');

  const onDragEnd = ({ active: dragged, over }: DragEndEvent) => {
    if (!over || dragged.id === over.id) return;
    const from = filtered.findIndex(m => m.id === dragged.id);
    const to = filtered.findIndex(m => m.id === over.id);
    if (from < 0 || to < 0) return;
    const orderById = new Map(arrayMove(filtered, from, to).map((m, i) => [m.id, i]));
    void run(() => saveData('members', useAppStore.getState().members.map(m => (orderById.has(m.id) ? { ...m, sortOrder: orderById.get(m.id) } : m))));
  };

  const openNew = () => {
    setIsNew(true);
    setEditing(blankMember({ color: randomPaletteColor(), isCustomFront: listView === 'customFronts', isFacet: listView === 'facets' }));
    setEditSession(s => s + 1);
  };

  const openEdit = (m: Member) => {
    setIsNew(false);
    setEditing(m);
    setEditSession(s => s + 1);
  };
  const openFromBrowser = (id: string) => {
    const m = members.find(mm => mm.id === id);
    if (m) openEdit(m);
  };

  useEffect(() => {
    if (!focusMemberId) return;
    const m = useAppStore.getState().members.find(mm => mm.id === focusMemberId);
    if (m) openEdit(m);
    onFocusHandled?.();
  }, [focusMemberId]);

  const saveEdited = async (draft: Member, linkSel: string[] | null) => {
    const ok = await run(async () => {
      await saveMember(draft);
      if (!linkSel) return;
      const liveGroups = useAppStore.getState().groups;
      const nextGroups = setSubsystemLinks(liveGroups, draft.id, linkSel);
      if (nextGroups !== liveGroups) await saveData('groups', nextGroups);
    });
    if (ok) setEditing(null);
  };

  const cloneMember = async (clone: Member) => {
    if (await run(() => saveMember(clone))) setEditing(null);
  };

  const removeMember = async (id: string) => {
    if (await run(() => deleteMember(id))) setEditing(null);
  };

  const bulkIds = [...selectedIds];
  const blockedByFront = bulkIds.some(id => frontingIds.has(id));
  const runBulk = async (kind: BulkKind) => {
    if (bulkIds.length === 0) return;
    const op = kind === 'archive' ? () => bulkSetArchived(bulkIds, true)
      : kind === 'restore' ? () => bulkSetArchived(bulkIds, false)
      : kind === 'delete' ? () => bulkDeleteMembers(bulkIds)
      : () => bulkSetFacet(bulkIds, listView === 'active');
    await run(op);
    exitSelection();
  };
  const applyGroupAssign = async (groupIds: string[]) => {
    if (bulkIds.length > 0 && groupIds.length > 0) await run(() => bulkAddGroups(bulkIds, groupIds));
    exitSelection();
  };
  const applyTagAssign = async (tags: string[]) => {
    setShowTagAssign(false);
    if (bulkIds.length === 0 || tags.length === 0) return;
    await run(() => bulkAddTags(bulkIds, tags));
    exitSelection();
  };
  const frontLockTitle = blockedByFront ? t('members.frontingLockMsg') : undefined;

  const listButton = (view: ListView, label: string) => (
    <Btn variant={listView === view ? 'info' : 'ghost'} aria-pressed={listView === view} onClick={() => switchListView(view)}>{label}</Btn>
  );
  const emptyLabel = t((search || activeTag) ? 'members.noMembers' : (archiveOnly ? ARCHIVED_EMPTY_KEYS : EMPTY_KEYS)[listView]);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        {!archiveOnly && (
          <button type="button" role="switch" aria-checked={browseGroups} onClick={toggleBrowseGroups}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 2px', flexShrink: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: browseGroups ? 'var(--accent)' : 'var(--dim)' }}>{t('memberGroups.title')}</span>
            <span aria-hidden className={`toggle ${browseGroups ? 'toggle--on' : ''}`} style={{ display: 'inline-block' }}><span className="toggle__knob" /></span>
          </button>
        )}
        {!browseGroups && (
          <>
            <input className="field__input" value={search} onChange={e => setSearch(e.target.value)}
              aria-label={t('members.search')} placeholder={t('members.search')} style={{ flex: 1, minWidth: 140 }} />
            <Dropdown<MemberSortMode> value={sortMode} options={MEMBER_SORT_MODES} onChange={changeSortMode} ariaLabel={t('memberSort.label')} renderOption={v => t(`memberSort.${v}`)} />
            {canReorder && (
              <ReorderLockButton locked={reorderLocked} onToggle={() => setReorderLocked(v => !v)} fontSize={16} padding={8} />
            )}
            {listButton('active', t('members.titleCount', { count: counts.active }))}
            {listButton('facets', t('members.facetsCount', { count: counts.facets }))}
            {listButton('customFronts', t('members.customFrontsCount', { count: counts.customFronts }))}
            <Btn variant={selectionMode ? 'info' : 'ghost'} aria-pressed={selectionMode} onClick={() => (selectionMode ? exitSelection() : setSelectionMode(true))}>
              {selectionMode ? t('common.cancel') : t('members.select')}
            </Btn>
            {!archiveOnly && (
              <Btn variant="solid" onClick={openNew}>{t(ADD_KEYS[listView])}</Btn>
            )}
            <ListFieldsMenu fields={listFields} onChange={saveListFields} />
          </>
        )}
      </div>

      {browseGroups ? (
        <SystemManagerView startBrowsing hideRootTitle onViewMember={openFromBrowser} onQuickFront={onQuickFront} onRemoveFromFront={onRemoveFromFront} />
      ) : (
        <>
          {selectionMode && (
            <div role="toolbar" aria-label={t('members.selectedCount', { count: selectedIds.size })} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--dim)', minWidth: 90 }} aria-live="polite">{t('members.selectedCount', { count: selectedIds.size })}</span>
              <Btn variant="ghost" onClick={() => setSelectedIds(new Set(filtered.map(m => m.id)))}>{t('members.selectAll')}</Btn>
              <Btn variant="ghost" onClick={() => setSelectedIds(new Set())}>{t('members.selectNone')}</Btn>
              {selectedIds.size > 0 && (
                <>
                  {groups.length > 0 && <Btn variant="ghost" onClick={() => setShowGroupAssign(true)}>{t('members.assignGroup')}</Btn>}
                  <Btn variant="ghost" onClick={() => setShowTagAssign(true)} aria-label={t('members.addTags')}>{t('members.assignTag')}</Btn>
                  {!archiveOnly && listView !== 'customFronts' && (
                    <Btn variant="ghost" onClick={() => setBulkConfirm('facet')} title={frontLockTitle} disabled={blockedByFront}>
                      {listView === 'active' ? t('members.makeFacet') : t('members.makeMember')}
                    </Btn>
                  )}
                  {!archiveOnly && <Btn variant="ghost" onClick={() => setBulkConfirm('archive')} title={frontLockTitle} disabled={blockedByFront}>{t('members.archive')}</Btn>}
                  {archiveOnly && <Btn variant="ghost" onClick={() => setBulkConfirm('restore')}>{t('members.restore')}</Btn>}
                  <Btn variant="danger" onClick={() => setBulkConfirm('delete')} title={frontLockTitle} disabled={blockedByFront}>{t('common.delete')}</Btn>
                </>
              )}
            </div>
          )}

          <TagFilter tags={allTags} active={activeTag} onChange={setActiveTag} />

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} accessibility={membersDndA11y}>
            <SortableContext items={filtered.map(m => m.id)} strategy={rectSortingStrategy}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                {filtered.map(m => (
                  <SortableCard key={m.id} id={m.id} label={m.name} disabled={!reorderActive}>
                    <MemberCard member={m} groups={groups} fields={listFields} selecting={selectionMode} selected={selectedIds.has(m.id)}
                      quickFront={quickFrontEnabled && !m.archived && !selectionMode ? { fronting: frontingIds.has(m.id), onOpen: setQuickFront } : undefined}
                      onActivate={() => (selectionMode ? toggleSelected(m.id) : openEdit(m))} />
                  </SortableCard>
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {filtered.length === 0 && (
            <EmptyState>{emptyLabel}</EmptyState>
          )}

          {deletedMembers.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <Section label={t('members.recentlyDeleted')} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {deletedMembers.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', opacity: 0.85 }}>
                    <MemberAvatar member={m} size={32} fontSize={12} decorative />
                    <div style={{ flex: 1, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                    <Btn variant="ghost" onClick={() => void run(() => restoreDeletedMember(m.id))} aria-label={t('members.restoreNamed', { name: m.name })}>{t('members.restore')}</Btn>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmDialog open={bulkConfirm === 'archive'} title={t('members.bulkArchive')} message={t('members.bulkArchiveMsg', { count: selectedIds.size })}
        onConfirm={() => void runBulk('archive')} onCancel={() => setBulkConfirm(null)} />
      <ConfirmDialog open={bulkConfirm === 'restore'} title={t('members.bulkRestore')} message={t('members.bulkRestoreMsg', { count: selectedIds.size })}
        onConfirm={() => void runBulk('restore')} onCancel={() => setBulkConfirm(null)} />
      <ConfirmDialog open={bulkConfirm === 'delete'} danger title={t('members.bulkDelete')} message={t('members.bulkDeleteMsg', { count: selectedIds.size })}
        onConfirm={() => void runBulk('delete')} onCancel={() => setBulkConfirm(null)} />
      <ConfirmDialog open={bulkConfirm === 'facet'} title={listView === 'active' ? t('members.makeFacet') : t('members.makeMember')} message={t('members.selectedCount', { count: selectedIds.size })}
        onConfirm={() => void runBulk('facet')} onCancel={() => setBulkConfirm(null)} />

      {showGroupAssign && <GroupAssignDialog groups={groups} onApply={ids => void applyGroupAssign(ids)} onClose={() => setShowGroupAssign(false)} />}
      {showTagAssign && <TagAssignDialog known={knownTags} onApply={tags => void applyTagAssign(tags)} onClose={() => setShowTagAssign(false)} />}

      {editing && (
        <MemberEditor key={editSession} member={editing} isNew={isNew} onClose={() => setEditing(null)}
          onSave={saveEdited} onDelete={removeMember} onClone={cloneMember} onOpenMember={openEdit} onShowOnMap={onShowOnMap} />
      )}

      {onQuickFront && onRemoveFromFront && (
        <QuickFrontDialogs target={quickFront} onClose={() => setQuickFront(null)} onAdd={onQuickFront} onRemove={onRemoveFromFront} />
      )}
      <SaveErrorDialog error={saveError} onClose={clearSaveError} />
    </div>
  );
}
