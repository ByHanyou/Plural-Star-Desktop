import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Member, Relationship, RelationshipTypeDef, uid,
  allRelationshipTypes, relationshipDegrees,
  DEFAULT_REL_COLOR, RELATIONSHIP_COLOR_CHOICES, getInitials,
} from '../utils';
import { store, KEYS } from '../storage';
import { Btn, Modal, ConfirmDialog, ColorPicker, Dropdown, clickable } from '../components/ui';
import { PALETTE } from '../theme';

interface Props {
  members: Member[];
  onViewMember?: (id: string) => void;
  focusMemberId?: string | null;
}

type TypeDraft = { id: string; name: string; inverseName: string; directional: boolean; color: string; preset: boolean };

export default function SystemMapView({ members, onViewMember, focusMemberId }: Props) {
  const { t } = useTranslation();
  const memberById = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);

  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [customTypes, setCustomTypes] = useState<RelationshipTypeDef[]>([]);
  const [mapIds, setMapIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [showAddMember, setShowAddMember] = useState(false);
  const [showTypes, setShowTypes] = useState(false);
  const [relEditor, setRelEditor] = useState<{ from: string; to: string; typeId: string; note: string } | null>(null);
  const [typeDraft, setTypeDraft] = useState<TypeDraft | null>(null);
  const [confirmDelRel, setConfirmDelRel] = useState<string | null>(null);

  const types = useMemo(() => allRelationshipTypes(customTypes), [customTypes]);
  const typeById = useMemo(() => new Map(types.map(ty => [ty.id, ty])), [types]);

  useEffect(() => {
    (async () => {
      const [rels, savedTypes, savedMapIds] = await Promise.all([
        store.get<Relationship[]>(KEYS.relationships, []),
        store.get<RelationshipTypeDef[]>(KEYS.relationshipTypes, []),
        store.get<string[]>(KEYS.systemMapMembers),
      ]);
      setCustomTypes(savedTypes || []);
      const all = rels || [];
      const ids = new Set(members.map(m => m.id));
      const valid = all.filter(r => ids.has(r.fromId) && ids.has(r.toId));
      setRelationships(valid);
      if (valid.length !== all.length) await store.set(KEYS.relationships, valid);
      if (savedMapIds && savedMapIds.length) {
        setMapIds(savedMapIds.filter(id => ids.has(id)));
      } else {
        const seeded = [...new Set(valid.flatMap(r => [r.fromId, r.toId]))];
        setMapIds(seeded);
        if (seeded.length) await store.set(KEYS.systemMapMembers, seeded);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (focusMemberId) { setMapIds(prev => prev.includes(focusMemberId) ? prev : [...prev, focusMemberId]); setSelectedId(focusMemberId); } }, [focusMemberId]);

  const saveRelationships = async (next: Relationship[]) => { setRelationships(next); await store.set(KEYS.relationships, next); };
  const saveCustomTypes = async (next: RelationshipTypeDef[]) => { setCustomTypes(next); await store.set(KEYS.relationshipTypes, next); };
  const saveMapIds = async (next: string[]) => { setMapIds(next); await store.set(KEYS.systemMapMembers, next); };

  const mapMembers = useMemo(() => mapIds.map(id => memberById.get(id)).filter(Boolean) as Member[], [mapIds, memberById]);
  const mapIdSet = useMemo(() => new Set(mapIds), [mapIds]);
  const mapRels = useMemo(() => relationships.filter(r => mapIdSet.has(r.fromId) && mapIdSet.has(r.toId)), [relationships, mapIdSet]);

  const typeLabel = (td: RelationshipTypeDef): string => (td.preset && !td.overridden) ? t(`relType.${td.id}`, { defaultValue: td.name }) : td.name;

  // BFS distances from selected member over the map's relationship graph
  const dist = useMemo(() => {
    if (!selectedId) return null;
    const adj = new Map<string, string[]>();
    for (const r of mapRels) {
      if (!adj.has(r.fromId)) adj.set(r.fromId, []);
      if (!adj.has(r.toId)) adj.set(r.toId, []);
      adj.get(r.fromId)!.push(r.toId);
      adj.get(r.toId)!.push(r.fromId);
    }
    const d = new Map<string, number>([[selectedId, 0]]);
    let frontier = [selectedId];
    for (let hop = 1; hop <= 3 && frontier.length; hop++) {
      const next: string[] = [];
      for (const id of frontier) for (const nb of (adj.get(id) || [])) {
        if (!d.has(nb)) { d.set(nb, hop); next.push(nb); }
      }
      frontier = next;
    }
    return d;
  }, [selectedId, mapRels]);

  // ----- layout -----
  const W = 900, H = 560, cx = W / 2, cy = H / 2;
  const n = mapMembers.length;
  const radius = n <= 1 ? 0 : Math.min(W, H) / 2 - 80;
  const pos = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    mapMembers.forEach((mem, i) => {
      if (n === 1) { m.set(mem.id, { x: cx, y: cy }); return; }
      const a = (2 * Math.PI * i) / n - Math.PI / 2;
      m.set(mem.id, { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
    });
    return m;
  }, [mapMembers, n, radius]);

  const degrees = useMemo(() => relationshipDegrees(mapMembers.map(m => m.id), mapRels), [mapMembers, mapRels]);

  const addRelationship = () => {
    if (!relEditor) return;
    const { from, to, typeId, note } = relEditor;
    if (!from || !to || from === to) { setRelEditor(null); return; }
    const dup = relationships.find(r => r.typeId === typeId && ((r.fromId === from && r.toId === to) || (r.fromId === to && r.toId === from)));
    if (dup) { setRelEditor(null); return; }
    const entry: Relationship = { id: uid(), fromId: from, toId: to, typeId, note: note || undefined, createdAt: Date.now() };
    saveRelationships([...relationships, entry]);
    setRelEditor(null);
  };

  const saveTypeDraft = () => {
    if (!typeDraft || !typeDraft.name.trim()) { setTypeDraft(null); return; }
    if (typeDraft.preset) {
      const others = customTypes.filter(ct => ct.id !== typeDraft.id);
      saveCustomTypes([...others, { id: typeDraft.id, name: typeDraft.name.trim(), inverseName: typeDraft.inverseName || undefined, directional: typeDraft.directional, color: typeDraft.color, preset: true }]);
    } else {
      const existing = customTypes.find(ct => ct.id === typeDraft.id);
      const entry: RelationshipTypeDef = { id: typeDraft.id, name: typeDraft.name.trim(), inverseName: typeDraft.inverseName || undefined, directional: typeDraft.directional, color: typeDraft.color };
      saveCustomTypes(existing ? customTypes.map(ct => ct.id === entry.id ? entry : ct) : [...customTypes, entry]);
    }
    setTypeDraft(null);
  };

  const deleteCustomType = (id: string) => {
    saveCustomTypes(customTypes.filter(ct => ct.id !== id));
    if (relationships.some(r => r.typeId === id)) saveRelationships(relationships.filter(r => r.typeId !== id));
  };

  const off = members.filter(m => !mapIdSet.has(m.id) && !m.archived);
  const selected = selectedId ? memberById.get(selectedId) : null;
  const selRels = selectedId ? mapRels.filter(r => r.fromId === selectedId || r.toId === selectedId) : [];

  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 18, fontFamily: 'var(--font-display)', color: 'var(--text)', margin: 0 }}>{t('systemMap.title')}</h2>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{relationships.length === 1 ? t('systemMap.relationshipOne') : t('systemMap.relationships', { count: relationships.length })}</span>
        <div style={{ flex: 1 }} />
        <Btn variant="solid" onClick={() => setShowAddMember(true)}>{t('systemMap.addMember')}</Btn>
        <Btn variant="ghost" onClick={() => setRelEditor({ from: selectedId || mapIds[0] || '', to: '', typeId: types[0]?.id || 'friend', note: '' })}>{t('systemMap.addRelationship')}</Btn>
        <Btn variant="ghost" onClick={() => setShowTypes(true)}>{t('systemMap.manageTypes')}</Btn>
      </div>

      {n === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 12 }}>
          {t('systemMap.emptyMap')}
        </div>
      ) : (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }} onClick={() => setSelectedId(null)}>
            {mapRels.map(r => {
              const a = pos.get(r.fromId), b = pos.get(r.toId);
              if (!a || !b) return null;
              const active = dist ? (dist.has(r.fromId) && dist.has(r.toId)) : false;
              const ty = typeById.get(r.typeId);
              const color = (!selectedId || active) && selectedId ? (ty?.color || DEFAULT_REL_COLOR) : DEFAULT_REL_COLOR;
              const opacity = !selectedId ? 0.5 : active ? 0.95 : 0.12;
              return <line key={r.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={active ? 3 : 2} opacity={opacity} />;
            })}
            {mapMembers.map(mem => {
              const p = pos.get(mem.id)!;
              const d = dist?.get(mem.id);
              const dim = selectedId && d === undefined && mem.id !== selectedId;
              const isSel = mem.id === selectedId;
              return (
                <g key={mem.id} style={{ cursor: 'pointer' }} opacity={dim ? 0.3 : 1}
                  role="button" tabIndex={0} aria-label={mem.name} aria-pressed={isSel}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(isSel ? null : mem.id); } }}
                  onClick={e => { e.stopPropagation(); setSelectedId(isSel ? null : mem.id); }}>
                  <circle cx={p.x} cy={p.y} r={isSel ? 26 : 22} fill={mem.color || 'var(--accent)'}
                    stroke={isSel ? '#fff' : 'rgba(255,255,255,0.25)'} strokeWidth={isSel ? 3 : 1.5} />
                  <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill="#0a0508">{getInitials(mem.name)}</text>
                  <text x={p.x} y={p.y + 40} textAnchor="middle" fontSize={11} fill="var(--text)">{mem.name}</text>
                  {selectedId && d !== undefined && d > 0 && (
                    <text x={p.x + 20} y={p.y - 18} textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--accent)">{d}</text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {selected && (
        <div style={{ marginTop: 12, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            {onViewMember && <Btn variant="ghost" onClick={() => onViewMember(selected.id)}>{t('systemMap.viewProfile')}</Btn>}
            <Btn variant="ghost" onClick={() => { saveMapIds(mapIds.filter(id => id !== selected.id)); setSelectedId(null); }}>{t('systemMap.removeFromMap')}</Btn>
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
                <span style={{ fontSize: 12, color: 'var(--dim)', minWidth: 70 }}>{ty ? typeLabel(ty) : '?'}</span>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', cursor: onViewMember ? 'pointer' : 'default' }}
                  {...(onViewMember ? clickable(() => onViewMember(otherId), other?.name) : {})}>{other?.name || '?'}</span>
                <button onClick={() => setConfirmDelRel(r.id)} aria-label={t('systemMap.deleteRelationship')} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 12 }}>✕</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add member to map */}
      <Modal open={showAddMember} title={t('systemMap.addMember')} onClose={() => setShowAddMember(false)}>
        {off.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: 13 }}>{t('systemMap.allOnMap')}</p> :
          off.map(m => (
            <button key={m.id} onClick={() => { saveMapIds([...mapIds, m.id]); setShowAddMember(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: 8, background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ width: 10, height: 10, borderRadius: 5, background: m.color }} />
              <span style={{ fontSize: 13, color: 'var(--text)' }}>{m.name}</span>
            </button>
          ))}
      </Modal>

      {/* Relationship editor */}
      <Modal open={!!relEditor} title={t('systemMap.addRelationship')} onClose={() => setRelEditor(null)}
        footer={<Btn variant="solid" onClick={addRelationship}>{t('common.save')}</Btn>}>
        {relEditor && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="field__label">{t('systemMap.from')}</label>
              <Dropdown<string> value={relEditor.from} options={mapIds} onChange={v => setRelEditor({ ...relEditor, from: v })} renderOption={id => memberById.get(id)?.name || '?'} />
            </div>
            <div>
              <label className="field__label">{t('systemMap.to')}</label>
              <Dropdown<string> value={relEditor.to} options={mapIds.filter(id => id !== relEditor.from)} onChange={v => setRelEditor({ ...relEditor, to: v })} renderOption={id => memberById.get(id)?.name || '?'} />
            </div>
            <div>
              <label className="field__label">{t('systemMap.type')}</label>
              <Dropdown<string> value={relEditor.typeId} options={types.map(ty => ty.id)} onChange={v => setRelEditor({ ...relEditor, typeId: v })} renderOption={id => { const ty = typeById.get(id); return ty ? typeLabel(ty) : id; }} />
            </div>
          </div>
        )}
      </Modal>

      {/* Manage types */}
      <Modal open={showTypes} title={t('systemMap.manageTypes')} onClose={() => setShowTypes(false)}
        footer={<Btn variant="ghost" onClick={() => setTypeDraft({ id: uid(), name: '', inverseName: '', directional: false, color: RELATIONSHIP_COLOR_CHOICES[0], preset: false })}>{t('systemMap.newType')}</Btn>}>
        {types.map(ty => (
          <div key={ty.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ width: 12, height: 12, borderRadius: 6, background: ty.color || DEFAULT_REL_COLOR }} />
            <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{typeLabel(ty)}{ty.preset ? ` · ${t('systemMap.preset')}` : ''}</span>
            <button onClick={() => setTypeDraft({ id: ty.id, name: typeLabel(ty), inverseName: ty.inverseName || '', directional: !!ty.directional, color: ty.color || RELATIONSHIP_COLOR_CHOICES[0], preset: !!ty.preset })}
              style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>{t('common.edit')}</button>
            {!ty.preset && <button onClick={() => deleteCustomType(ty.id)} aria-label={`${t('common.delete')} ${typeLabel(ty)}`} style={{ fontSize: 12, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>}
          </div>
        ))}
      </Modal>

      {/* Type draft editor */}
      <Modal open={!!typeDraft} title={typeDraft?.preset ? t('systemMap.editType') : t('systemMap.newType')} onClose={() => setTypeDraft(null)}
        footer={<Btn variant="solid" onClick={saveTypeDraft}>{t('common.save')}</Btn>}>
        {typeDraft && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="field__label">{t('systemMap.typeName')}</label>
              <input className="field__input" aria-label={t('systemMap.typeName')} value={typeDraft.name} onChange={e => setTypeDraft({ ...typeDraft, name: e.target.value })} />
            </div>
            <ColorPicker value={typeDraft.color} onChange={v => setTypeDraft({ ...typeDraft, color: v })} palette={[...RELATIONSHIP_COLOR_CHOICES, ...PALETTE]} />
            {typeDraft.preset && <p style={{ fontSize: 11, color: 'var(--muted)' }}>{t('systemMap.presetEditNote')}</p>}
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!confirmDelRel} title={t('systemMap.deleteRelationship')} message={t('systemMap.deleteRelationshipMsg')}
        danger onConfirm={() => { if (confirmDelRel) saveRelationships(relationships.filter(r => r.id !== confirmDelRel)); setConfirmDelRel(null); }}
        onCancel={() => setConfirmDelRel(null)} />
    </div>
  );
}
