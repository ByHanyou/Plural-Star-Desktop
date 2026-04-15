import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomFieldDef, CustomFieldType, uid } from '../utils';
import { store, KEYS } from '../storage';
import { Btn, Section, Field, Modal, ConfirmDialog } from '../components/ui';

interface Props {
  onUpdate: () => void;
}

const FIELD_TYPES: CustomFieldType[] = [
  'text', 'markdown', 'color', 'date', 'month', 'year', 'monthYear',
  'timestamp', 'monthDay', 'dateRange', 'number', 'toggle',
];

export default function CustomFieldsView({ onUpdate }: Props) {
  const { t } = useTranslation();
  const [fields, setFields] = useState<CustomFieldDef[]>([]);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<CustomFieldType>('text');
  const [newMarkdown, setNewMarkdown] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  useEffect(() => {
    store.get<CustomFieldDef[]>(KEYS.customFieldDefs, []).then(defs => setFields(defs || []));
  }, []);

  const save = async (updated: CustomFieldDef[]) => {
    setFields(updated);
    await store.set(KEYS.customFieldDefs, updated);
    onUpdate();
  };

  const addField = () => {
    if (!newName.trim()) return;
    const def: CustomFieldDef = { id: uid(), name: newName.trim(), type: newType, markdown: newMarkdown || undefined, sortOrder: fields.length };
    save([...fields, def]);
    setNewName(''); setNewType('text'); setNewMarkdown(false);
  };

  const deleteField = (id: string) => {
    save(fields.filter(f => f.id !== id));
    setConfirmDelete(null);
  };

  const renameField = (id: string) => {
    if (!editName.trim()) return;
    save(fields.map(f => f.id === id ? { ...f, name: editName.trim() } : f));
    setEditId(null);
  };

  const moveField = (from: number, to: number) => {
    const updated = [...fields];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    save(updated.map((f, i) => ({ ...f, sortOrder: i })));
  };

  const typeLabel = (type: CustomFieldType) => {
    return t(`customFields.type${type.charAt(0).toUpperCase() + type.slice(1)}` as any);
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      {/* Existing fields */}
      {fields.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 20 }}>
          {fields.map((fd, i) => (
            <div key={fd.id}
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragOver={e => { e.preventDefault(); }}
              onDrop={() => { if (dragIdx !== null && dragIdx !== i) moveField(dragIdx, i); setDragIdx(null); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                background: dragIdx === i ? 'var(--accent-bg)' : 'var(--card)',
                border: '1px solid var(--border)', borderRadius: 8, cursor: 'grab',
              }}>
              {/* Drag handle */}
              <span style={{ fontSize: 16, color: 'var(--muted)', cursor: 'grab', userSelect: 'none' }}>⋮⋮</span>

              {/* Name (editable) */}
              <div style={{ flex: 1 }}>
                {editId === fd.id ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input className="field__input" value={editName} onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') renameField(fd.id); }}
                      autoFocus style={{ flex: 1, fontSize: 13 }} />
                    <Btn onClick={() => renameField(fd.id)}>✓</Btn>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{fd.name}</span>
                    <button style={{ background: 'none', border: 'none', color: 'var(--dim)', fontSize: 12, cursor: 'pointer' }}
                      onClick={() => { setEditId(fd.id); setEditName(fd.name); }}>✎</button>
                  </div>
                )}
                {fd.markdown && (
                  <span style={{ fontSize: 10, color: 'var(--info)', marginTop: 2, display: 'block' }}>☑ Markdown support</span>
                )}
              </div>

              {/* Type badge */}
              <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--surface)', padding: '3px 10px', borderRadius: 6, whiteSpace: 'nowrap' }}>
                {typeLabel(fd.type)}
              </span>

              {/* Delete */}
              <button style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 16, cursor: 'pointer', padding: '4px' }}
                onClick={() => setConfirmDelete(fd.id)}>🗑</button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>
          {t('customFields.noFields')}
        </div>
      )}

      {/* Add new field */}
      <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label className="field__label">{t('customFields.fieldName')}</label>
            <input className="field__input" value={newName} onChange={e => setNewName(e.target.value)}
              placeholder={t('customFields.fieldName')}
              onKeyDown={e => { if (e.key === 'Enter') addField(); }} />
          </div>
          <div style={{ minWidth: 140 }}>
            <label className="field__label">{t('customFields.fieldType')}</label>
            <select style={{
              width: '100%', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '9px 10px', fontSize: 13,
            }} value={newType} onChange={e => setNewType(e.target.value as CustomFieldType)}>
              {FIELD_TYPES.map(t2 => (
                <option key={t2} value={t2}>{typeLabel(t2)}</option>
              ))}
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '9px 0' }}>
            <input type="checkbox" checked={newMarkdown} onChange={e => setNewMarkdown(e.target.checked)} />
            <span style={{ fontSize: 12, color: 'var(--dim)' }}>Markdown</span>
          </label>
          <Btn variant="solid" onClick={addField}>{t('customFields.addField')}</Btn>
        </div>
      </div>

      <ConfirmDialog open={!!confirmDelete}
        title={t('customFields.deleteField')}
        message={t('customFields.deleteFieldMsg')}
        danger
        onConfirm={() => confirmDelete && deleteField(confirmDelete)}
        onCancel={() => setConfirmDelete(null)} />
    </div>
  );
}
