import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Member, MemberGroup, GroupNodeKind, uid, childrenOf, descendantsOf, isDescendant, groupKind } from '../utils';
import { store, KEYS } from '../storage';
import { Btn, ConfirmDialog } from '../components/ui';
import { PALETTE } from '../theme';

interface Props {
  members: Member[];
  groups: MemberGroup[];
  onUpdate: () => void;
}

export default function SystemManagerView({ members, groups, onUpdate }: Props) {
  const { t } = useTranslation();

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PALETTE[0]);
  const [newKind, setNewKind] = useState<GroupNodeKind>('group');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState<string>(PALETTE[0]);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const saveGroups = async (g: MemberGroup[]) => {
    await store.set(KEYS.groups, g);
    onUpdate();
  };

  const addNode = () => {
    const name = newName.trim();
    if (!name) return;
    const siblings = childrenOf(groups, null);
    saveGroups([...groups, { id: uid(), name, color: newColor, kind: newKind, parentId: null, sortOrder: siblings.length }]);
    setNewName('');
  };

  const moveNode = (id: string, newParentId: string | null) => {
    if (newParentId === id || (newParentId && isDescendant(groups, newParentId, id))) { setMovingId(null); return; }
    const siblings = childrenOf(groups, newParentId).filter(g => g.id !== id);
    saveGroups(groups.map(g => g.id === id ? { ...g, parentId: newParentId, sortOrder: siblings.length } : g));
    setMovingId(null);
  };

  const renameNode = (id: string) => {
    const name = editName.trim();
    if (!name) return;
    saveGroups(groups.map(g => g.id === id ? { ...g, name, color: editColor } : g));
    setEditId(null); setEditName('');
  };

  const deleteLeaf = (id: string) => {
    saveGroups(groups.filter(g => g.id !== id));
    setConfirmDeleteId(null);
  };

  const deletePromoteChildren = (id: string) => {
    const node = groups.find(g => g.id === id);
    const parent = node ? (node.parentId ?? null) : null;
    saveGroups(groups.filter(g => g.id !== id).map(g => g.parentId === id ? { ...g, parentId: parent } : g));
    setConfirmDeleteId(null);
  };

  const deleteSubtree = (id: string) => {
    const kids = descendantsOf(groups, id);
    const removeSet = new Set([id, ...kids.map(k => k.id)]);
    saveGroups(groups.filter(g => !removeSet.has(g.id)));
    setConfirmDeleteId(null);
  };

  const confirmTarget = confirmDeleteId ? groups.find(g => g.id === confirmDeleteId) : null;
  const confirmKids = confirmDeleteId ? descendantsOf(groups, confirmDeleteId) : [];

  const cycleColor = (current: string, set: (c: string) => void) => {
    const idx = PALETTE.indexOf(current);
    set(PALETTE[(idx + 1) % PALETTE.length]);
  };

  const renderNode = (g: MemberGroup, depth: number): React.ReactNode => {
    const isEditing = editId === g.id;
    const isSub = groupKind(g) === 'subsystem';
    const memberCount = members.filter(m => (m.groupIds || []).includes(g.id)).length;
    const moving = movingId;
    const canDrop = !!moving && moving !== g.id && !isDescendant(groups, g.id, moving);
    return (
      <div key={g.id}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingLeft: depth * 18 }}>
          {depth > 0 && <span style={{ color: 'var(--muted)', fontSize: 12 }}>└</span>}
          {isEditing ? (
            <button title={t('memberGroups.changeColor')} onClick={() => cycleColor(editColor, setEditColor)}
              style={{ width: 18, height: 18, borderRadius: isSub ? 4 : 9, backgroundColor: editColor, border: '2px solid rgba(255,255,255,0.15)', cursor: 'pointer', flexShrink: 0 }} />
          ) : (
            <span style={{ width: 12, height: 12, borderRadius: isSub ? 3 : 6, backgroundColor: g.color || 'var(--accent)', flexShrink: 0 }} />
          )}
          {isEditing ? (
            <div style={{ flex: 1, display: 'flex', gap: 6, alignItems: 'center' }}>
              <input className="field__input" value={editName} autoFocus onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') renameNode(g.id); if (e.key === 'Escape') setEditId(null); }}
                style={{ flex: 1, fontSize: 13 }} />
              <button onClick={() => renameNode(g.id)} title={t('common.save')} style={{ background: 'none', border: 'none', color: 'var(--success)', fontSize: 14, cursor: 'pointer' }}>✓</button>
              <button onClick={() => setEditId(null)} title={t('common.cancel')} style={{ background: 'none', border: 'none', color: 'var(--dim)', fontSize: 12, cursor: 'pointer' }}>✕</button>
            </div>
          ) : (
            <>
              <span style={{ flex: 1, fontSize: 14, color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {isSub ? '⊟ ' : ''}{g.name}
              </span>
              {canDrop ? (
                <button onClick={() => moveNode(moving!, g.id)}
                  style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--success)', background: 'var(--success-bg)', color: 'var(--success)', cursor: 'pointer' }}>
                  {t('memberGroups.moveHere')}
                </button>
              ) : moving === g.id ? (
                <span style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>{t('memberGroups.moving')}</span>
              ) : (
                <>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{memberCount}</span>
                  <button onClick={() => setMovingId(g.id)} title={`${t('memberGroups.move')} ${g.name}`}
                    style={{ background: 'none', border: 'none', color: 'var(--dim)', fontSize: 15, cursor: 'pointer', padding: 2 }}>⇄</button>
                  <button onClick={() => { setEditId(g.id); setEditName(g.name); setEditColor(g.color || PALETTE[0]); }}
                    style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--accent-bg)', color: 'var(--accent)', cursor: 'pointer' }}>
                    {t('common.edit')}
                  </button>
                  <button onClick={() => setConfirmDeleteId(g.id)} title={`${t('common.delete')} ${g.name}`}
                    style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 12, cursor: 'pointer', padding: 4 }}>✕</button>
                </>
              )}
            </>
          )}
        </div>
        {childrenOf(groups, g.id).map(c => renderNode(c, depth + 1))}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <p style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 14, lineHeight: 1.5 }}>{t('systemManager.desc')}</p>

      {movingId && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: 8, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--accent)' }}>
          <span style={{ flex: 1, fontSize: 11, color: 'var(--dim)' }}>{t('memberGroups.movePrompt')}</span>
          <button onClick={() => moveNode(movingId!, null)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{t('memberGroups.toRoot')}</button>
          <button onClick={() => setMovingId(null)} style={{ background: 'none', border: 'none', color: 'var(--dim)', fontSize: 11, cursor: 'pointer' }}>{t('common.cancel')}</button>
        </div>
      )}

      {childrenOf(groups, null).map(g => renderNode(g, 0))}
      {groups.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', marginBottom: 10 }}>{t('memberGroups.none')}</p>}

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 12 }}>
        <button title={t('memberGroups.changeColor')} onClick={() => cycleColor(newColor, setNewColor)}
          style={{ width: 28, height: 28, borderRadius: newKind === 'subsystem' ? 6 : 14, backgroundColor: newColor, border: '2px solid rgba(255,255,255,0.15)', cursor: 'pointer', flexShrink: 0 }} />
        <input className="field__input" value={newName} onChange={e => setNewName(e.target.value)}
          placeholder={t('memberGroups.addPlaceholder')}
          onKeyDown={e => { if (e.key === 'Enter') addNode(); }}
          style={{ flex: 1, fontSize: 13 }} />
        <Btn variant="ghost" onClick={() => setNewKind(k => k === 'group' ? 'subsystem' : 'group')}>
          {newKind === 'subsystem' ? t('memberGroups.subsystem') : t('memberGroups.group')}
        </Btn>
        <Btn variant="solid" onClick={addNode}>{t('common.add')}</Btn>
      </div>

      {confirmTarget && confirmKids.length === 0 && (
        <ConfirmDialog open title={t('memberGroups.deleteGroup')} message={t('memberGroups.deleteGroupMsg')}
          danger onConfirm={() => deleteLeaf(confirmTarget.id)} onCancel={() => setConfirmDeleteId(null)} />
      )}
      {confirmTarget && confirmKids.length > 0 && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="modal modal--sm" onClick={e => e.stopPropagation()}>
            <div className="modal__header"><span className="modal__title">{t('memberGroups.deleteGroup')}</span></div>
            <div className="modal__body">
              <p style={{ color: 'var(--dim)', fontSize: 13, lineHeight: 1.5 }}>{t('memberGroups.deleteWithChildrenMsg', { count: confirmKids.length })}</p>
            </div>
            <div className="modal__footer">
              <Btn variant="ghost" onClick={() => setConfirmDeleteId(null)}>{t('common.cancel')}</Btn>
              <Btn onClick={() => deletePromoteChildren(confirmTarget.id)}>{t('memberGroups.promoteChildren')}</Btn>
              <Btn variant="danger" onClick={() => deleteSubtree(confirmTarget.id)}>{t('memberGroups.deleteSubtree')}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
