import React, { useState, useEffect, useMemo, useId } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Member, Relationship, RelationshipTypeDef, uid,
  allRelationshipTypes, relationshipDegrees,
  DEFAULT_REL_COLOR, getInitials, relTypeLabel, relationshipRoleOfOther, relationshipHops,
  findDuplicateRelationship, upsertRelationshipType, removeRelationshipType, isRosterMember, isFacetMember, membersByIds,
} from '../utils';
import { saveData } from '../store/actions';
import { Btn, ConfirmDialog, clickable, linkButton, SrOnly, SaveErrorDialog } from '../components/ui';
import { AddToMapModal } from './systemMap/AddToMapModal';
import { RelationshipEditor, RelationshipDraft } from './systemMap/RelationshipEditor';
import { TypesModal, TypeDraftModal, TypeDraft, newTypeDraft, typeDraftOf } from './systemMap/RelationshipTypes';
import { useAppStore } from '../store/appStore';
import { initialOn } from '../theme';
import { useSaveGuard } from '../hooks/useSaveGuard';
import { useMapLayout } from './systemMap/useMapLayout';

interface Props {
  onViewMember?: (id: string) => void;
  focusMemberId?: string | null;
}

const usePersistedFlag = (key: string, defaultOn: boolean): [boolean, () => void] => {
  const [on, setOn] = useState(() => {
    const stored = localStorage.getItem(key);
    return stored === null ? defaultOn : stored === '1';
  });
  const toggle = () => {
    const next = !on;
    setOn(next);
    localStorage.setItem(key, next ? '1' : '0');
  };
  return [on, toggle];
};

const flagButton = (on: boolean, toggle: () => void, label: React.ReactNode) => (
  <button className={on ? 'btn btn--solid' : 'btn btn--ghost'} aria-pressed={on} onClick={toggle}>{label}</button>
);

export default function SystemMapView({ onViewMember, focusMemberId }: Props) {
  const { t } = useTranslation();
  const members = useAppStore(s => s.members);
  const memberById = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);

  const relationships = useAppStore(s => s.relationships);
  const customTypes = useAppStore(s => s.relationshipTypes);
  const mapIds = useAppStore(s => s.systemMapMembers);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveError, run, clearSaveError] = useSaveGuard();
  const mapId = useId();
  const [focusedNode, setFocusedNode] = useState<string | null>(null);

  const [showAddMember, setShowAddMember] = useState(false);
  const [showTypes, setShowTypes] = useState(false);
  const [showArchived, toggleShowArchived] = usePersistedFlag('ps.mapShowArchived', false);
  const [showFacets, toggleShowFacets] = usePersistedFlag('ps.mapShowFacets', true);
  const [colorAll, toggleColorAll] = usePersistedFlag('ps.mapColorThreads', false);
  const [lockPositions, toggleLockPositions] = usePersistedFlag('ps.mapLockPositions', false);
  const [relEditor, setRelEditor] = useState<RelationshipDraft | null>(null);
  const [relDup, setRelDup] = useState(false);
  useEffect(() => { setRelDup(false); }, [relEditor]);
  const [typeDraft, setTypeDraft] = useState<TypeDraft | null>(null);
  const [confirmDelRel, setConfirmDelRel] = useState<string | null>(null);
  const [confirmDelType, setConfirmDelType] = useState<RelationshipTypeDef | null>(null);

  const types = useMemo(() => allRelationshipTypes(customTypes), [customTypes]);
  const typeById = useMemo(() => new Map(types.map(ty => [ty.id, ty])), [types]);

  useEffect(() => {
    if (!focusMemberId) return;
    const prev = useAppStore.getState().systemMapMembers;
    if (!prev.includes(focusMemberId)) void run(() => saveData('systemMapMembers', [...prev, focusMemberId]));
    setSelectedId(focusMemberId);
  }, [focusMemberId, run]);

  const saveRelationships = (next: Relationship[]) => run(() => saveData('relationships', next));
  const saveCustomTypes = (next: RelationshipTypeDef[]) => run(() => saveData('relationshipTypes', next));
  const saveMapIds = (next: string[]) => run(() => saveData('systemMapMembers', next));

  const mapMembers = useMemo(() => membersByIds(mapIds, memberById).filter(m => (isRosterMember(m) || isFacetMember(m)) && (showArchived || !m.archived) && (showFacets || !m.isFacet)), [mapIds, memberById, showArchived, showFacets]);
  const mapIdSet = useMemo(() => new Set(mapIds), [mapIds]);
  const visibleIdSet = useMemo(() => new Set(mapMembers.map(m => m.id)), [mapMembers]);
  const { svgRef, pos, extX, extY, lastDragMovedRef, onNodePointerDown, onNodePointerMove, onNodePointerUp, nudgeNode } = useMapLayout(mapMembers, lockPositions, run);
  const mapRels = useMemo(() => relationships.filter(r => visibleIdSet.has(r.fromId) && visibleIdSet.has(r.toId)), [relationships, visibleIdSet]);

  const typeLabel = (td: RelationshipTypeDef): string => relTypeLabel(td, t);

  const dist = useMemo(() => relationshipHops(selectedId, mapRels), [selectedId, mapRels]);

  const nodeLabel = (mem: Member, hops: number | undefined): string => {
    const base = mem.archived ? t('systemMap.nodeArchived', { name: mem.name }) : mem.name;
    return selectedId && hops !== undefined && hops > 0 ? t('systemMap.nodeHops', { name: base, count: hops }) : base;
  };

  const degrees = useMemo(() => relationshipDegrees(mapMembers.map(m => m.id), mapRels), [mapMembers, mapRels]);

  const addRelationship = async () => {
    if (!relEditor) return;
    const { from, toIds, typeId, note } = relEditor;
    const targets = [...new Set(toIds)].filter(id => id && id !== from);
    if (!from || targets.length === 0) { setRelEditor(null); return; }
    const td = typeById.get(typeId);
    const fresh = targets.filter(to => !findDuplicateRelationship(relationships, td, typeId, from, to));
    if (fresh.length === 0) { setRelDup(true); return; }
    const nowTs = Date.now();
    const entries: Relationship[] = fresh.map(to => ({ id: uid(), fromId: from, toId: to, typeId, note: note || undefined, createdAt: nowTs }));
    if (!(await saveRelationships([...relationships, ...entries]))) return;
    const mapAdds = [from, ...fresh].filter(id => !mapIdSet.has(id));
    if (mapAdds.length > 0 && !(await saveMapIds([...mapIds, ...mapAdds]))) return;
    setRelEditor(null);
  };

  const saveTypeDraft = async () => {
    if (typeDraft && typeDraft.name.trim()) {
      const fields = { name: typeDraft.name.trim(), inverseName: typeDraft.inverseName || undefined, directional: typeDraft.directional, color: typeDraft.color };
      if (!(await saveCustomTypes(upsertRelationshipType(customTypes, typeDraft.id, fields)))) return;
    }
    setTypeDraft(null);
  };

  const performDeleteType = async (ty: RelationshipTypeDef) => {
    if (!(await saveCustomTypes(removeRelationshipType(customTypes, ty)))) return;
    if (relationships.some(r => r.typeId === ty.id)) await saveRelationships(relationships.filter(r => r.typeId !== ty.id));
  };

  const off = members.filter(m => !mapIdSet.has(m.id) && isRosterMember(m) && (showArchived || !m.archived));
  const offFacets = members.filter(m => !mapIdSet.has(m.id) && isFacetMember(m) && (showArchived || !m.archived));
  const selected = selectedId ? memberById.get(selectedId) : null;
  const selRels = selectedId
    ? mapRels.filter(r => (r.fromId === selectedId || r.toId === selectedId) && pos.has(r.fromId === selectedId ? r.toId : r.fromId))
    : [];

  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 18, fontFamily: 'var(--font-display)', color: 'var(--text)', margin: 0 }}>{t('systemMap.title')}</h2>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('systemMap.relationships', { count: mapRels.length })}</span>
        <div style={{ flex: 1 }} />
        <Btn variant="solid" disabled={off.length === 0 && offFacets.length === 0} onClick={() => setShowAddMember(true)}>{t('systemMap.addMember')}</Btn>
        <Btn variant="ghost" onClick={() => setRelEditor({ from: selectedId || mapIds[0] || '', toIds: [], typeId: types[0]?.id || 'friend', note: '' })}>{t('systemMap.addRelationship')}</Btn>
        <Btn variant="ghost" onClick={() => setShowTypes(true)}>{t('systemMap.manageTypes')}</Btn>
        {flagButton(showArchived, toggleShowArchived, t('members.archived'))}
        {flagButton(showFacets, toggleShowFacets, t('members.facets'))}
        {flagButton(colorAll, toggleColorAll, t('systemMap.showColors'))}
        {flagButton(lockPositions, toggleLockPositions, <><span aria-hidden>{lockPositions ? '🔒 ' : '🔓 '}</span>{t('systemMap.lockPositions')}</>)}
      </div>

      {mapMembers.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 12 }}>
          {t('systemMap.emptyMap')}
        </div>
      ) : (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <svg ref={svgRef} role="group" aria-label={t('systemMap.title')} viewBox={`${-extX} ${-extY} ${extX * 2} ${extY * 2}`} style={{ width: '100%', display: 'block' }} onClick={() => { if (lastDragMovedRef.current) { lastDragMovedRef.current = false; return; } setSelectedId(null); }}>
            {mapRels.map(r => {
              const a = pos.get(r.fromId), b = pos.get(r.toId);
              if (!a || !b) return null;
              const da = dist?.get(r.fromId);
              const db = dist?.get(r.toId);
              const active = da !== undefined && db !== undefined && Math.abs(da - db) === 1;
              const ty = typeById.get(r.typeId);
              const color = (selectedId ? active : false) || colorAll ? (ty?.color || DEFAULT_REL_COLOR) : DEFAULT_REL_COLOR;
              const opacity = !selectedId ? 0.5 : active ? 0.95 : 0.12;
              return <line key={r.id} aria-hidden x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={active ? 3 : 2} opacity={opacity} />;
            })}
            {mapMembers.map(mem => {
              const p = pos.get(mem.id);
              if (!p) return null;
              const d = dist?.get(mem.id);
              const dim = selectedId && d === undefined && mem.id !== selectedId;
              const isSel = mem.id === selectedId;
              return (
                <g key={mem.id} style={{ cursor: 'pointer' }} opacity={dim ? 0.3 : mem.archived ? 0.55 : 1}
                  role="button" tabIndex={0} aria-label={nodeLabel(mem, d)} aria-pressed={isSel}
                  aria-describedby={lockPositions ? undefined : `${mapId}-movehint`}
                  onFocus={e => { if (e.currentTarget.matches(':focus-visible')) setFocusedNode(mem.id); }}
                  onBlur={() => setFocusedNode(f => (f === mem.id ? null : f))}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(isSel ? null : mem.id); } else nudgeNode(e, mem.id, p); }}
                  onPointerDown={onNodePointerDown(mem.id, p)}
                  onPointerMove={onNodePointerMove}
                  onPointerUp={onNodePointerUp}
                  onClick={e => { e.stopPropagation(); if (lastDragMovedRef.current) { lastDragMovedRef.current = false; return; } setSelectedId(isSel ? null : mem.id); }}>
                  <circle cx={p.x} cy={p.y} r={isSel ? 26 : 22} fill={mem.color || 'var(--accent)'}
                    stroke={isSel ? '#fff' : 'rgba(255,255,255,0.25)'} strokeWidth={isSel ? 3 : 1.5} />
                  {focusedNode === mem.id && (
                    <circle cx={p.x} cy={p.y} r={(isSel ? 26 : 22) + 5} fill="none" stroke="var(--accent)" strokeWidth={2} />
                  )}
                  <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill={initialOn(mem.color)}>{getInitials(mem.name)}</text>
                  <text x={p.x} y={p.y + 40} textAnchor="middle" fontSize={11} fill="var(--text)">{mem.name}</text>
                  {selectedId && d !== undefined && d > 0 && (
                    <text x={p.x + 20} y={p.y - 18} textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--accent)">{d}</text>
                  )}
                </g>
              );
            })}
          </svg>
          <SrOnly id={`${mapId}-movehint`}>{t('systemMap.moveHint')}</SrOnly>
        </div>
      )}

      {selected && (
        <div style={{ marginTop: 12, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            {onViewMember && <Btn variant="ghost" onClick={() => onViewMember(selected.id)}>{t('systemMap.viewProfile')}</Btn>}
            <Btn variant="ghost" onClick={() => { void saveMapIds(mapIds.filter(id => id !== selected.id)); setSelectedId(null); }}>{t('systemMap.removeFromMap')}</Btn>
            <Btn variant="ghost" onClick={() => setSelectedId(null)}>{t('common.close')}</Btn>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ width: 12, height: 12, borderRadius: 6, background: selected.color, flexShrink: 0 }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{selected.name}</span>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{t('systemMap.connectionsCount', { count: degrees[selected.id] || 0 })}</span>
          </div>
          {selRels.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>{t('systemMap.noneForMember')}</p>
          ) : selRels.map(r => {
            const otherId = r.fromId === selected.id ? r.toId : r.fromId;
            const other = memberById.get(otherId);
            const ty = typeById.get(r.typeId);
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderTop: '1px solid var(--border)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: ty?.color || DEFAULT_REL_COLOR }} />
                <span style={{ fontSize: 12, color: 'var(--dim)', minWidth: 70 }}>{relationshipRoleOfOther(ty, r, selected.id, t)}</span>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', cursor: onViewMember ? 'pointer' : 'default' }}
                  {...(onViewMember ? clickable(() => onViewMember(otherId), other?.name) : {})}>{other?.name || '?'}</span>
                <button onClick={() => setConfirmDelRel(r.id)} aria-label={t('systemMap.deleteRelationshipWith', { name: other?.name || '?' })} style={linkButton('var(--danger)', 12)}>✕</button>
              </div>
            );
          })}
        </div>
      )}

      <AddToMapModal open={showAddMember} members={off} facets={offFacets} onClose={() => setShowAddMember(false)}
        onAdd={id => { void saveMapIds([...mapIds, id]); setShowAddMember(false); }} />

      <RelationshipEditor draft={relEditor} onChange={setRelEditor} onSave={() => void addRelationship()} onClose={() => setRelEditor(null)}
        fromIds={[...mapIds, ...off.map(m => m.id), ...offFacets.map(m => m.id)]}
        toMembers={[...membersByIds(mapIds, memberById), ...off]} toFacets={offFacets}
        memberById={memberById} types={types} duplicate={relDup} />

      <TypesModal open={showTypes} types={types} onClose={() => setShowTypes(false)} onNew={() => setTypeDraft(newTypeDraft())}
        onEdit={ty => setTypeDraft(typeDraftOf(ty, typeLabel(ty)))} onDelete={setConfirmDelType} />

      <TypeDraftModal draft={typeDraft} onChange={setTypeDraft} onSave={() => void saveTypeDraft()} onClose={() => setTypeDraft(null)} />

      <ConfirmDialog open={!!confirmDelRel} title={t('systemMap.deleteRelationship')} message={t('systemMap.deleteRelationshipMsg')}
        danger onConfirm={() => { if (confirmDelRel) void saveRelationships(relationships.filter(r => r.id !== confirmDelRel)); setConfirmDelRel(null); }}
        onCancel={() => setConfirmDelRel(null)} />

      <ConfirmDialog open={!!confirmDelType} title={t('systemMap.deleteType')} message={t('systemMap.deleteTypeMsg')}
        danger onConfirm={() => { if (confirmDelType) void performDeleteType(confirmDelType); setConfirmDelType(null); }}
        onCancel={() => setConfirmDelType(null)} />
      <SaveErrorDialog error={saveError} onClose={clearSaveError} />
    </div>
  );
}
