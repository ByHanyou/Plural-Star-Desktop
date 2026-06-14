import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Member, MemberGroup, GroupNodeKind, uid, childrenOf, descendantsOf, isDescendant, groupKind } from '../utils';
import { store, KEYS } from '../storage';
import { Btn, ConfirmDialog, ColorPicker } from '../components/ui';
import { PALETTE } from '../theme';

interface Props {
  members: Member[];
  groups: MemberGroup[];
  onUpdate: () => void;
  onViewMember?: (id: string) => void;
}

export default function SystemManagerView({ members, groups, onUpdate, onViewMember }: Props) {
  const { t } = useTranslation();

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PALETTE[0]);
  const [newKind, setNewKind] = useState<GroupNodeKind>('group');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState<string>(PALETTE[0]);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showNewColor, setShowNewColor] = useState(false);
  const [showEditColor, setShowEditColor] = useState(false);
  const [browse, setBrowse] = useState(false);
  const [browseId, setBrowseId] = useState<string | null>(null);

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
            <button title={t('memberGroups.changeColor')} onClick={() => setShowEditColor(v => !v)}
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
                  <button onClick={() => { setEditId(g.id); setEditName(g.name); setEditColor(g.color || PALETTE[0]); setShowEditColor(false); }}
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
        {isEditing && showEditColor && (
          <div style={{ paddingLeft: depth * 18 + 26, marginBottom: 10 }}>
            <ColorPicker value={editColor} onChange={setEditColor} palette={PALETTE} />
          </div>
        )}
        {childrenOf(groups, g.id).map(c => renderNode(c, depth + 1))}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <p style={{ flex: 1, fontSize: 12, color: 'var(--dim)', lineHeight: 1.5, margin: 0 }}>{t('systemManager.desc')}</p>
        <Btn variant={browse ? 'info' : 'ghost'} onClick={() => { setBrowse(b => !b); setBrowseId(null); }}>🗂 {t('systemManager.browse')}</Btn>
      </div>

      {browse && (() => {
        const folder = browseId ? groups.find(g => g.id === browseId) : null;
        const subFolders = childrenOf(groups, browseId);
        const folderMembers = browseId
          ? members.filter(m => (m.groupIds || []).includes(browseId) && !m.archived)
          : members.filter(m => (m.groupIds || []).length === 0 && !m.archived);
        return (
          <div style={{ marginBottom: 16, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              {browseId && (
                <button onClick={() => setBrowseId(folder?.parentId ?? null)} aria-label={t('common.back')} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 14, cursor: 'pointer' }}>←</button>
              )}
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{folder ? folder.name : t('systemManager.title')}</span>
            </div>
            {subFolders.map(g => (
              <button key={g.id} onClick={() => setBrowseId(g.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: 8, background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: 14 }}>{groupKind(g) === 'subsystem' ? '⊟' : '📁'}</span>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{g.name}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>›</span>
              </button>
            ))}
            {folderMembers.map(m => (
              <button key={m.id} onClick={() => onViewMember?.(m.id)} disabled={!onViewMember}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: 8, background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: onViewMember ? 'pointer' : 'default', textAlign: 'left' }}>
                <span style={{ width: 10, height: 10, borderRadius: 5, background: m.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{m.name}</span>
              </button>
            ))}
            {subFolders.length === 0 && folderMembers.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>{t('systemManager.emptyFolder')}</p>
            )}
          </div>
        );
      })()}

      {!browse && movingId && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: 8, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--accent)' }}>
          <span style={{ flex: 1, fontSize: 11, color: 'var(--dim)' }}>{t('memberGroups.movePrompt')}</span>
          <button onClick={() => moveNode(movingId!, null)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{t('memberGroups.toRoot')}</button>
          <button onClick={() => setMovingId(null)} style={{ background: 'none', border: 'none', color: 'var(--dim)', fontSize: 11, cursor: 'pointer' }}>{t('common.cancel')}</button>
        </div>
      )}

      {!browse && childrenOf(groups, null).map(g => renderNode(g, 0))}
      {!browse && groups.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', marginBottom: 10 }}>{t('memberGroups.none')}</p>}

      {!browse && (<>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 12 }}>
        <button title={t('memberGroups.changeColor')} onClick={() => setShowNewColor(v => !v)}
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
      {showNewColor && (
        <div style={{ marginTop: 10 }}>
          <ColorPicker value={newColor} onChange={setNewColor} palette={PALETTE} />
        </div>
      )}
      </>)}

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
