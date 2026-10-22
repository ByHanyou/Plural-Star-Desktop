import { useMemo, useState } from 'react';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import {
  MemberGroup, GroupNodeKind,
  uid, childrenOf, countUp, descendantsOf, isDescendant, groupKind, nameCompare, moveGroupsTo, removeGroupsPromoting, removeGroupSubtrees,
} from '../../utils';
import { saveData } from '../../store/actions';
import { useAppStore } from '../../store/appStore';
import { Btn, ConfirmDialog, ChoiceDialog, linkButton, SrOnly } from '../../components/ui';
import { ColorCarousel } from '../../components/ColorCarousel';
import { PALETTE } from '../../theme';
import type { SaveRun } from '../../hooks/useSaveGuard';

interface EditDraft {
  id: string;
  name: string;
  color: string;
  description: string;
  linked: string;
  showColor: boolean;
}

const INDENT = 18;
const descStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 13, resize: 'vertical',
};
const pillBtn = (border: string, background: string, color: string): React.CSSProperties => ({
  fontSize: 11, padding: '3px 8px', borderRadius: 6, border: `1px solid ${border}`, background, color, cursor: 'pointer',
});

export function GroupTree({ run }: { run: SaveRun }) {
  const { t } = useTranslation();
  const members = useAppStore(s => s.members);
  const groups = useAppStore(s => s.groups);
  const [edit, setEdit] = useState<EditDraft | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<string>(PALETTE[0]);
  const [newDesc, setNewDesc] = useState('');
  const [newKind, setNewKind] = useState<GroupNodeKind>('group');
  const [showNewColor, setShowNewColor] = useState(false);

  const saveGroups = (next: MemberGroup[]) => { void run(() => saveData('groups', next)); };
  const patchEdit = (p: Partial<EditDraft>) => setEdit(e => (e ? { ...e, ...p } : e));
  const fronterChoices = members.filter(m => !m.deleted && !m.archived && !m.isCustomFront).sort((a, b) => nameCompare(a.name, b.name));
  const memberCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of members) {
      if (m.deleted || m.archived) continue;
      for (const gid of new Set(m.groupIds || [])) countUp(counts, gid);
    }
    return counts;
  }, [members]);

  const addNode = () => {
    const name = newName.trim();
    if (!name) return;
    saveGroups([...groups, { id: uid(), name, color: newColor, kind: newKind, parentId: null, sortOrder: childrenOf(groups, null).length, description: newDesc.trim() || undefined }]);
    setNewName('');
    setNewDesc('');
  };

  const moveNode = (id: string, parentId: string | null) => {
    const next = moveGroupsTo(groups, [id], parentId);
    setMovingId(null);
    if (next !== groups) saveGroups(next);
  };

  const startEdit = (g: MemberGroup) => setEdit({ id: g.id, name: g.name, color: g.color || PALETTE[0], description: g.description || '', linked: g.linkedMemberId || '', showColor: false });

  const saveEdit = () => {
    if (!edit) return;
    const name = edit.name.trim();
    if (!name) return;
    saveGroups(groups.map(g => (g.id === edit.id
      ? { ...g, name, color: edit.color, description: edit.description.trim() || undefined, ...(groupKind(g) === 'subsystem' ? { linkedMemberId: edit.linked || undefined } : {}) }
      : g)));
    setEdit(null);
  };

  const removeWith = (next: MemberGroup[]) => {
    saveGroups(next);
    setDeleteId(null);
  };

  const deleteTarget = deleteId ? groups.find(g => g.id === deleteId) : undefined;
  const deleteKids = deleteId ? descendantsOf(groups, deleteId) : [];

  const editRow = (draft: EditDraft, isSub: boolean) => (
    <>
      <button type="button" title={t('memberGroups.changeColor')} aria-label={t('memberGroups.changeColor')} aria-expanded={draft.showColor} onClick={() => patchEdit({ showColor: !draft.showColor })}
        style={{ width: 18, height: 18, borderRadius: isSub ? 4 : 9, backgroundColor: draft.color, border: '2px solid rgba(255,255,255,0.15)', cursor: 'pointer', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', gap: 6, alignItems: 'center' }}>
        <input className="field__input" aria-label={t('memberGroups.groupName')} value={draft.name} autoFocus onChange={e => patchEdit({ name: e.target.value })}
          onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEdit(null); }}
          style={{ flex: 1, fontSize: 13 }} />
        <button type="button" onClick={saveEdit} title={t('common.save')} aria-label={t('common.save')} style={linkButton('var(--success)', 14)}>✓</button>
        <button type="button" onClick={() => setEdit(null)} title={t('common.cancel')} aria-label={t('common.cancel')} style={linkButton('var(--dim)', 12)}>✕</button>
      </div>
    </>
  );

  const editDetails = (draft: EditDraft, depth: number, isSub: boolean) => {
    const linkedElsewhere = draft.linked && !fronterChoices.some(m => m.id === draft.linked) ? members.find(m => m.id === draft.linked && !m.deleted) : undefined;
    return (
      <div style={{ paddingLeft: depth * INDENT + 26, marginBottom: 10 }}>
        {draft.showColor && <div style={{ marginBottom: 10 }}><ColorCarousel value={draft.color} onChange={color => patchEdit({ color })} /></div>}
        <textarea value={draft.description} onChange={e => patchEdit({ description: e.target.value })} placeholder={t('modal.descriptionBio')} aria-label={t('modal.descriptionBio')} rows={2} style={descStyle} />
        {isSub && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--dim)', flexShrink: 0 }}>{t('memberGroups.linkedFronter')}</span>
            <select className="field__input" value={draft.linked} onChange={e => patchEdit({ linked: e.target.value })} style={{ flex: 1, fontSize: 13 }}>
              <option value="">{t('memberGroups.noLinkedFronter')}</option>
              {linkedElsewhere && <option value={linkedElsewhere.id}>{linkedElsewhere.name}</option>}
              {fronterChoices.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
        )}
      </div>
    );
  };

  const renderNode = (g: MemberGroup, depth: number, seen: Set<string>): React.ReactNode => {
    if (seen.has(g.id)) return null;
    seen.add(g.id);
    const draft = edit?.id === g.id ? edit : null;
    const isSub = groupKind(g) === 'subsystem';
    const memberCount = memberCounts.get(g.id) || 0;
    const canDrop = !!movingId && movingId !== g.id && !isDescendant(groups, g.id, movingId);
    return (
      <div key={g.id}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingLeft: depth * INDENT }}>
          {depth > 0 && <span aria-hidden style={{ color: 'var(--muted)', fontSize: 12 }}>└</span>}
          {draft ? editRow(draft, isSub) : (
            <>
              <span aria-hidden style={{ width: 12, height: 12, borderRadius: isSub ? 3 : 6, backgroundColor: g.color || 'var(--accent)', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 14, color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {isSub && <><span aria-hidden>⊟ </span><SrOnly>{t('memberGroups.subsystem')}</SrOnly></>}{g.name}
              </span>
              {canDrop && movingId ? (
                <button type="button" onClick={() => moveNode(movingId, g.id)} style={pillBtn('var(--success)', 'var(--success-bg)', 'var(--success)')}>
                  {t('memberGroups.moveHere')}
                </button>
              ) : movingId === g.id ? (
                <span style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>{t('memberGroups.moving')}</span>
              ) : (
                <>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }} title={t('memberGroups.memberCount', { count: memberCount })}>
                    <span aria-hidden>{memberCount}</span><SrOnly>{t('memberGroups.memberCount', { count: memberCount })}</SrOnly>
                  </span>
                  <button type="button" onClick={() => setMovingId(g.id)} title={t('memberGroups.moveNamed', { name: g.name })} aria-label={t('memberGroups.moveNamed', { name: g.name })}
                    style={{ ...linkButton('var(--dim)', 15), padding: 2 }}>⇄</button>
                  <button type="button" aria-label={t('common.editNamed', { name: g.name })} onClick={() => startEdit(g)} style={{ ...pillBtn('var(--border)', 'var(--accent-bg)', 'var(--accent)'), fontWeight: 500 }}>
                    {t('common.edit')}
                  </button>
                  <button type="button" onClick={() => setDeleteId(g.id)} title={t('common.deleteNamed', { name: g.name })} aria-label={t('common.deleteNamed', { name: g.name })}
                    style={{ ...linkButton('var(--danger)', 12), padding: 4 }}>✕</button>
                </>
              )}
            </>
          )}
        </div>
        {draft && editDetails(draft, depth, isSub)}
        {childrenOf(groups, g.id).map(c => renderNode(c, depth + 1, seen))}
      </div>
    );
  };

  const seen = new Set<string>();
  return (
    <>
      {movingId && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: 8, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--accent)' }}>
          <span style={{ flex: 1, fontSize: 11, color: 'var(--dim)' }}>{t('memberGroups.movePrompt')}</span>
          <button type="button" onClick={() => moveNode(movingId, null)} style={{ ...linkButton('var(--accent)'), fontWeight: 600 }}>{t('memberGroups.toRoot')}</button>
          <button type="button" onClick={() => setMovingId(null)} style={linkButton('var(--dim)')}>{t('common.cancel')}</button>
        </div>
      )}

      {childrenOf(groups, null).map(g => renderNode(g, 0, seen))}
      {groups.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', marginBottom: 10 }}>{t('memberGroups.none')}</p>}

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 12 }}>
        <button type="button" aria-label={t('memberGroups.changeColor')} title={t('memberGroups.changeColor')} aria-expanded={showNewColor} onClick={() => setShowNewColor(v => !v)}
          style={{ width: 28, height: 28, borderRadius: newKind === 'subsystem' ? 6 : 14, backgroundColor: newColor, border: '2px solid rgba(255,255,255,0.15)', cursor: 'pointer', flexShrink: 0 }} />
        <input className="field__input" value={newName} onChange={e => setNewName(e.target.value)}
          aria-label={t('memberGroups.addPlaceholder')} placeholder={t('memberGroups.addPlaceholder')}
          onKeyDown={e => { if (e.key === 'Enter') addNode(); }}
          style={{ flex: 1, fontSize: 13 }} />
        <Btn variant="ghost" aria-label={t('memberGroups.kindToggle', { kind: newKind === 'subsystem' ? t('memberGroups.subsystem') : t('memberGroups.group') })}
          onClick={() => setNewKind(k => (k === 'group' ? 'subsystem' : 'group'))}>
          {newKind === 'subsystem' ? t('memberGroups.subsystem') : t('memberGroups.group')}
        </Btn>
        <Btn variant="solid" onClick={addNode}>{t('common.add')}</Btn>
      </div>
      {showNewColor && (
        <div style={{ marginTop: 10 }}>
          <ColorCarousel value={newColor} onChange={setNewColor} />
          <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder={t('modal.descriptionBio')} aria-label={t('modal.descriptionBio')} rows={2}
            style={{ ...descStyle, marginTop: 8 }} />
        </div>
      )}

      <ConfirmDialog open={!!deleteTarget && deleteKids.length === 0} title={t('memberGroups.deleteGroup')} message={t('memberGroups.deleteGroupMsg')} danger
        onConfirm={() => { if (deleteId) removeWith(groups.filter(g => g.id !== deleteId)); }} onCancel={() => setDeleteId(null)} />
      <ChoiceDialog open={!!deleteTarget && deleteKids.length > 0} title={t('memberGroups.deleteGroup')}
        message={t('memberGroups.deleteWithChildrenMsg', { count: deleteKids.length })} onCancel={() => setDeleteId(null)}>
        <Btn onClick={() => { if (deleteId) removeWith(removeGroupsPromoting(groups, [deleteId])); }}>{t('memberGroups.promoteChildren')}</Btn>
        <Btn variant="danger" onClick={() => { if (deleteId) removeWith(removeGroupSubtrees(groups, [deleteId])); }}>{t('memberGroups.deleteSubtree')}</Btn>
      </ChoiceDialog>
    </>
  );
}
