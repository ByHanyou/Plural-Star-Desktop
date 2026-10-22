import { useId, useState } from 'react';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { Member, MemberSortMode, MEMBER_SORT_MODES, FrontTierKey, childrenOf, groupKind, isRosterMember, isFacetMember, isCustomFrontMember, sortMembers, allFrontMemberIds, toggleId } from '../../utils';
import { patchSettings, bulkAddGroups, bulkRemoveFromGroup } from '../../store/actions';
import { useAppStore } from '../../store/appStore';
import { MemberSelect } from '../../components/MemberSelect';
import { pickerPool } from '../../picker/memberPicker';
import type { PickerPool } from '../../picker/memberPicker';
import { MemberAvatar } from '../../components/MemberAvatar';
import { Btn, Modal, ConfirmDialog, Dropdown, linkButton, SrOnly } from '../../components/ui';
import { QuickFrontButton, QuickFrontDialogs, QuickFrontTarget } from '../members/QuickFront';
import type { SaveRun } from '../../hooks/useSaveGuard';

const rowBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: 8, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' };
const roundBtn = (tone: string): React.CSSProperties => ({
  width: 24, height: 24, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  background: 'transparent', border: `1px solid ${tone}`, color: tone, fontSize: 14, lineHeight: 1,
});
const dot = (color: string) => <span aria-hidden style={{ width: 10, height: 10, borderRadius: 5, background: color, flexShrink: 0 }} />;

function FolderSection({ label, members, removeMode, removeIds, onToggleRemove, onViewMember, quickFront }: {
  label?: string;
  members: Member[];
  removeMode: boolean;
  removeIds: string[];
  onToggleRemove: (id: string) => void;
  onViewMember?: (id: string) => void;
  quickFront?: { frontingIds: Set<string>; onOpen: (target: QuickFrontTarget) => void };
}) {
  const headingId = useId();
  if (members.length === 0) return null;
  return (
    <>
      {label && <div className="field__label" id={headingId} style={{ marginTop: 10 }}>{label}</div>}
      <div role="group" aria-labelledby={label ? headingId : undefined}>
        {members.map(m => {
          if (removeMode) {
            const picked = removeIds.includes(m.id);
            return (
              <button key={m.id} type="button" onClick={() => onToggleRemove(m.id)} role="checkbox" aria-checked={picked} aria-label={m.name}
                style={{ ...rowBtn, borderBottom: '1px solid var(--border)' }}>
                <span aria-hidden style={{ fontSize: 14, color: picked ? 'var(--danger)' : 'var(--muted)' }}>{picked ? '☑' : '☐'}</span>
                {dot(m.color)}
                <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{m.name}</span>
              </button>
            );
          }
          return (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)' }}>
              <button type="button" onClick={() => onViewMember?.(m.id)} disabled={!onViewMember}
                style={{ ...rowBtn, flex: 1, width: undefined, cursor: onViewMember ? 'pointer' : 'default' }}>
                {dot(m.color)}
                <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{m.name}</span>
              </button>
              {quickFront && (
                <QuickFrontButton member={m} fronting={quickFront.frontingIds.has(m.id)} size={22} fontSize={12} onOpen={quickFront.onOpen} style={{ marginRight: 4 }} />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

export function GroupBrowser({ hideRootTitle, onViewMember, onQuickFront, onRemoveFromFront, run }: {
  hideRootTitle?: boolean;
  onViewMember?: (id: string) => void;
  onQuickFront?: (memberId: string, tier: FrontTierKey) => void;
  onRemoveFromFront?: (memberId: string) => void;
  run: SaveRun;
}) {
  const { t } = useTranslation();
  const members = useAppStore(s => s.members);
  const groups = useAppStore(s => s.groups);
  const front = useAppStore(s => s.front);
  const sortMode: MemberSortMode = useAppStore(s => s.settings.groupSortMode) || 'manual';
  const [browseId, setBrowseId] = useState<string | null>(null);
  const [addPickOpen, setAddPickOpen] = useState(false);
  const [addPickIds, setAddPickIds] = useState<string[]>([]);
  const [addSearch, setAddSearch] = useState('');
  const [removeMode, setRemoveMode] = useState(false);
  const [removeIds, setRemoveIds] = useState<string[]>([]);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [quickFront, setQuickFront] = useState<QuickFrontTarget | null>(null);

  const goTo = (id: string | null) => {
    setBrowseId(id);
    setRemoveMode(false);
    setRemoveIds([]);
    setAddPickOpen(false);
    setAddPickIds([]);
    setAddSearch('');
  };

  const folder = browseId ? groups.find(g => g.id === browseId) : undefined;
  const subFolders = childrenOf(groups, browseId);
  const inFolder = (m: Member) => !m.archived && (browseId ? (m.groupIds || []).includes(browseId) : (m.groupIds || []).length === 0);
  const folderMembers = sortMembers(members.filter(m => inFolder(m) && isRosterMember(m)), sortMode);
  const folderFacets = sortMembers(members.filter(m => inFolder(m) && isFacetMember(m)), sortMode);
  const folderCustomFronts = browseId ? sortMembers(members.filter(m => inFolder(m) && isCustomFrontMember(m)), sortMode) : [];
  const addEligible = (m: Member) => !!folder && !m.archived && !(m.groupIds || []).includes(folder.id);
  const addPools: PickerPool[] = folder ? [
    pickerPool('members', members.filter(m => isRosterMember(m) && addEligible(m)), t),
    pickerPool('facets', members.filter(m => isFacetMember(m) && addEligible(m)), t),
    pickerPool('customFronts', members.filter(m => isCustomFrontMember(m) && addEligible(m)), t),
  ] : [];
  const linked = folder && groupKind(folder) === 'subsystem' && folder.linkedMemberId
    ? members.find(m => m.id === folder.linkedMemberId && !m.deleted)
    : undefined;
  const frontingIds = new Set(allFrontMemberIds(front));
  const quickFrontRow = onQuickFront && onRemoveFromFront ? { frontingIds, onOpen: setQuickFront } : undefined;
  const isEmpty = subFolders.length === 0 && folderMembers.length === 0 && folderFacets.length === 0 && folderCustomFronts.length === 0;

  const addPicked = () => {
    if (folder && addPickIds.length > 0) void run(() => bulkAddGroups(addPickIds, [folder.id]));
    setAddPickOpen(false);
    setAddPickIds([]);
  };
  const removePicked = () => {
    if (folder && removeIds.length > 0) void run(() => bulkRemoveFromGroup(removeIds, folder.id));
    setConfirmRemove(false);
    setRemoveMode(false);
    setRemoveIds([]);
  };
  const sectionProps = { removeMode, removeIds, onToggleRemove: (id: string) => setRemoveIds(sel => toggleId(sel, id)), onViewMember };

  return (
    <div style={{ marginBottom: 16, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        {browseId && (
          <button type="button" onClick={() => goTo(folder?.parentId ?? null)} aria-label={t('common.back')} style={linkButton('var(--accent)', 14)}>←</button>
        )}
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{folder ? folder.name : (hideRootTitle ? '' : t('systemManager.title'))}</span>
        <Dropdown<MemberSortMode> value={sortMode} options={MEMBER_SORT_MODES} onChange={mode => void run(() => patchSettings({ groupSortMode: mode }))}
          ariaLabel={t('memberSort.label')} renderOption={v => t(`memberSort.${v}`)} />
        {folder && !removeMode && (
          <button type="button" onClick={() => { setAddPickIds([]); setAddSearch(''); setAddPickOpen(true); }} aria-label={t('memberGroups.addMembers')} title={t('memberGroups.addMembers')}
            style={roundBtn('var(--accent)')}>＋</button>
        )}
        {folder && folderMembers.length > 0 && !removeMode && (
          <button type="button" onClick={() => { setRemoveIds([]); setRemoveMode(true); }} aria-label={t('memberGroups.removeMembers')} title={t('memberGroups.removeMembers')}
            style={roundBtn('var(--danger)')}>−</button>
        )}
      </div>

      {linked && (
        <button type="button" onClick={() => onViewMember?.(linked.id)} disabled={!onViewMember} aria-label={t('common.labelValue', { label: t('memberGroups.linkedFronter'), value: linked.name })}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', marginBottom: 10, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', cursor: onViewMember ? 'pointer' : 'default', textAlign: 'left' }}>
          <MemberAvatar member={linked} size={28} fontSize={11} decorative />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--dim)', fontWeight: 600 }}>{t('memberGroups.linkedFronter')}</span>
            <span style={{ display: 'block', fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{linked.name}</span>
          </span>
          {onViewMember && <span aria-hidden style={{ fontSize: 11, color: 'var(--muted)' }}>›</span>}
        </button>
      )}

      {removeMode && folder && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: 8, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--danger)' }}>
          <span style={{ flex: 1, fontSize: 11, color: 'var(--dim)' }}>{t('members.selectedCount', { count: removeIds.length })}</span>
          <button type="button" onClick={() => setConfirmRemove(true)} disabled={removeIds.length === 0}
            style={{ ...linkButton('var(--danger)'), fontWeight: 600, opacity: removeIds.length === 0 ? 0.45 : 1 }}>{t('network.remove')}</button>
          <button type="button" onClick={() => { setRemoveMode(false); setRemoveIds([]); }}
            style={linkButton('var(--dim)')}>{t('common.cancel')}</button>
        </div>
      )}

      {subFolders.map(g => {
        const isSub = groupKind(g) === 'subsystem';
        return (
          <button key={g.id} type="button" onClick={() => goTo(g.id)} style={{ ...rowBtn, borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 14 }} aria-hidden>{isSub ? '⊟' : '📁'}</span>
            <SrOnly>{isSub ? t('memberGroups.subsystem') : t('memberGroups.group')}</SrOnly>
            <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{g.name}</span>
            <span aria-hidden style={{ fontSize: 11, color: 'var(--muted)' }}>›</span>
          </button>
        );
      })}

      <FolderSection label={t('members.title')} members={folderMembers} quickFront={quickFrontRow} {...sectionProps} />
      <FolderSection label={t('members.facets')} members={folderFacets} {...sectionProps} />
      <FolderSection label={t('members.customFronts')} members={folderCustomFronts} {...sectionProps} />

      {isEmpty && <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>{t('systemManager.emptyFolder')}</p>}

      <Modal open={addPickOpen} title={t('memberGroups.addMembersTo', { name: folder?.name || '' })} onClose={() => setAddPickOpen(false)}
        footer={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
            <span style={{ flex: 1, fontSize: 11, color: 'var(--dim)' }}>{t('members.selectedCount', { count: addPickIds.length })}</span>
            <Btn variant="ghost" onClick={() => setAddPickOpen(false)}>{t('common.cancel')}</Btn>
            <Btn variant="solid" disabled={addPickIds.length === 0} onClick={addPicked}>{t('common.add')}</Btn>
          </div>
        }>
        <MemberSelect pools={addPools} selected={addPickIds} onPick={m => setAddPickIds(sel => toggleId(sel, m.id))} multi maxResults={Infinity} listMaxHeight={320}
          search={addSearch} onSearch={setAddSearch} emptyLabel={t('members.noMembers')} />
      </Modal>

      {onQuickFront && onRemoveFromFront && (
        <QuickFrontDialogs target={quickFront} onClose={() => setQuickFront(null)} onAdd={onQuickFront} onRemove={onRemoveFromFront} />
      )}

      <ConfirmDialog open={confirmRemove} title={t('memberGroups.removeMembers')} message={t('members.selectedCount', { count: removeIds.length })} danger
        onConfirm={removePicked} onCancel={() => setConfirmRemove(false)} />
    </div>
  );
}
