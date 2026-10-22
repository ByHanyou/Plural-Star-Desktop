import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomFieldDef, CustomFieldType, CUSTOM_FIELD_TYPES, asCustomFieldType, customFieldTypeKey, moveInList, stripCustomField, uid, withSortOrder } from '../utils';
import { saveData, saveMembers } from '../store/actions';
import { useAppStore } from '../store/appStore';
import { Btn, ConfirmDialog, EmptyState, linkButton, SaveErrorDialog } from '../components/ui';
import { useSaveGuard } from '../hooks/useSaveGuard';

export default function CustomFieldsView() {
  const { t } = useTranslation();
  const fields = useAppStore(s => s.customFieldDefs);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<CustomFieldType>('text');
  const [newMarkdown, setNewMarkdown] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [saveError, run, clearSaveError] = useSaveGuard();

  const save = (updated: CustomFieldDef[]) => run(() => saveData('customFieldDefs', updated));

  const addField = async () => {
    if (!newName.trim()) return;
    const def: CustomFieldDef = { id: uid(), name: newName.trim(), type: newType, markdown: newMarkdown || undefined, sortOrder: fields.length };
    if (!(await save([...fields, def]))) return;
    setNewName(''); setNewType('text'); setNewMarkdown(false);
  };

  const deleteField = async (id: string) => {
    setConfirmDelete(null);
    if (!(await save(fields.filter(f => f.id !== id)))) return;
    const cleaned = stripCustomField(useAppStore.getState().members, id);
    if (cleaned) await run(() => saveMembers(cleaned));
  };

  const patchField = (id: string, patch: Partial<CustomFieldDef>) => save(fields.map(f => f.id === id ? { ...f, ...patch } : f));

  const renameField = async (id: string) => {
    if (editName.trim() && await patchField(id, { name: editName.trim() })) setEditId(null);
  };

  const moveField = (from: number, to: number) => void save(withSortOrder(moveInList(fields, from, to)));

  const typeLabel = (type: CustomFieldType) => t(customFieldTypeKey(type));

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
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
              <span aria-hidden style={{ fontSize: 16, color: 'var(--muted)', cursor: 'grab', userSelect: 'none' }}>⋮⋮</span>

              <div style={{ flex: 1 }}>
                {editId === fd.id ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input className="field__input" aria-label={t('customFields.fieldName')} value={editName} onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') void renameField(fd.id); }}
                      autoFocus style={{ flex: 1, fontSize: 13 }} />
                    <Btn aria-label={t('common.save')} onClick={() => void renameField(fd.id)}>✓</Btn>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{fd.name}</span>
                    <button aria-label={t('common.editNamed', { name: fd.name })} style={linkButton('var(--dim)', 12)}
                      onClick={() => { setEditId(fd.id); setEditName(fd.name); }}>✎</button>
                  </div>
                )}
                {fd.markdown && (
                  <span style={{ fontSize: 10, color: 'var(--info)', marginTop: 2, display: 'block' }}><span aria-hidden>☑</span> {t('customFields.markdownSupport')}</span>
                )}
              </div>

              <select aria-label={t('customFields.fieldTypeFor', { name: fd.name })} value={fd.type}
                onChange={e => void patchField(fd.id, { type: asCustomFieldType(e.target.value) })}
                style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--surface)', border: '1px solid var(--border)', padding: '3px 6px', borderRadius: 6, whiteSpace: 'nowrap' }}>
                {CUSTOM_FIELD_TYPES.map(t2 => (
                  <option key={t2} value={t2}>{typeLabel(t2)}</option>
                ))}
              </select>

              <button disabled={i === 0} onClick={() => moveField(i, i - 1)}
                aria-label={i === 0 ? t('common.moveUpNamed', { name: fd.name }) : t('customFields.moveUpNamed', { name: fd.name, above: fields[i - 1].name })}
                style={{ background: 'none', border: 'none', color: i === 0 ? 'var(--muted)' : 'var(--dim)', fontSize: 13, cursor: i === 0 ? 'default' : 'pointer', padding: '2px 4px' }}>▲</button>
              <button disabled={i === fields.length - 1} onClick={() => moveField(i, i + 1)}
                aria-label={i === fields.length - 1 ? t('common.moveDownNamed', { name: fd.name }) : t('customFields.moveDownNamed', { name: fd.name, below: fields[i + 1].name })}
                style={{ background: 'none', border: 'none', color: i === fields.length - 1 ? 'var(--muted)' : 'var(--dim)', fontSize: 13, cursor: i === fields.length - 1 ? 'default' : 'pointer', padding: '2px 4px' }}>▼</button>

              <button aria-label={t('common.deleteNamed', { name: fd.name })} style={{ ...linkButton('var(--danger)', 16), padding: '4px' }}
                onClick={() => setConfirmDelete(fd.id)}>🗑</button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState>
          {t('customFields.noFields')}
        </EmptyState>
      )}

      <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label className="field__label">{t('customFields.fieldName')}</label>
            <input className="field__input" value={newName} onChange={e => setNewName(e.target.value)}
              aria-label={t('customFields.fieldName')} placeholder={t('customFields.fieldName')}
              onKeyDown={e => { if (e.key === 'Enter') void addField(); }} />
          </div>
          <div style={{ minWidth: 140 }}>
            <label className="field__label">{t('customFields.fieldType')}</label>
            <select aria-label={t('customFields.fieldType')} style={{
              width: '100%', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '9px 10px', fontSize: 13,
            }} value={newType} onChange={e => setNewType(asCustomFieldType(e.target.value))}>
              {CUSTOM_FIELD_TYPES.map(t2 => (
                <option key={t2} value={t2}>{typeLabel(t2)}</option>
              ))}
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '9px 0' }}>
            <input type="checkbox" checked={newMarkdown} onChange={e => setNewMarkdown(e.target.checked)} />
            <span style={{ fontSize: 12, color: 'var(--dim)' }}>{t('customFields.markdownLabel')}</span>
          </label>
          <Btn variant="solid" disabled={!newName.trim()} onClick={() => void addField()}>{t('customFields.addField')}</Btn>
        </div>
      </div>

      <ConfirmDialog open={!!confirmDelete}
        title={t('customFields.deleteField')}
        message={t('customFields.deleteFieldMsg')}
        danger
        onConfirm={() => { if (confirmDelete) void deleteField(confirmDelete); }}
        onCancel={() => setConfirmDelete(null)} />
      <SaveErrorDialog error={saveError} onClose={clearSaveError} />
    </div>
  );
}
