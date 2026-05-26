import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Member, MemberGroup, MemberSortMode, CustomFieldDef, CustomFieldValue, NoteboardEntry, uid, getInitials, sortMembers, fmtTime, resizeBannerDataUrl } from '../utils';
import { PALETTE } from '../theme';
import { store, KEYS } from '../storage';
import { Btn, Field, Toggle, Section, ChipList, AddRow, ColorPicker, Modal, ConfirmDialog, Dropdown } from '../components/ui';

interface Props {
  members: Member[];
  groups: MemberGroup[];
  onUpdate: () => void;
}

export default function MembersView({ members, groups, onUpdate }: Props) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<Member | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<MemberSortMode>('alphabetical');

  const [f, setF] = useState<Member>({ id: '', name: '', pronouns: '', role: '', color: PALETTE[0], description: '' });
  const [tagInput, setTagInput] = useState('');
  const [fieldDefs, setFieldDefs] = useState<CustomFieldDef[]>([]);

  useEffect(() => {
    store.get<CustomFieldDef[]>(KEYS.customFieldDefs, []).then(defs => setFieldDefs(defs || []));
  }, []);

  type MemberTab = 'main' | 'fields' | 'noteboard';
  const [memberTab, setMemberTab] = useState<MemberTab>('main');

  const [allNotes, setAllNotes] = useState<NoteboardEntry[]>([]);
  const [noteText, setNoteText] = useState('');
  const [noteAuthorId, setNoteAuthorId] = useState<string | null>(null);

  useEffect(() => {
    store.get<NoteboardEntry[]>(KEYS.noteboards, []).then(n => setAllNotes(n || []));
  }, []);

  const memberNotes = allNotes
    .filter(n => n.memberId === f.id)
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.timestamp - a.timestamp;
    });

  const saveNotes = async (updated: NoteboardEntry[]) => {
    setAllNotes(updated);
    await store.set(KEYS.noteboards, updated);
  };

  const addNote = () => {
    if (!noteText.trim() || !noteAuthorId) return;
    const entry: NoteboardEntry = { id: uid(), memberId: f.id, authorId: noteAuthorId, content: noteText.trim(), timestamp: Date.now() };
    saveNotes([...allNotes, entry]);
    setNoteText('');
  };

  const deleteNote = (id: string) => saveNotes(allNotes.filter(n => n.id !== id));
  const togglePin = (id: string) => saveNotes(allNotes.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n));

  const active = members.filter(m => !m.archived);
  const archived = members.filter(m => m.archived);
  const sorted = sortMembers(showArchived ? archived : active, sortMode);
  const filtered = sorted.filter(m =>
    !search || m.name.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    const m: Member = { id: uid(), name: '', pronouns: '', role: '', color: PALETTE[Math.floor(Math.random() * PALETTE.length)], description: '', tags: [], groupIds: [], createdAt: Date.now() };
    setF(m); setIsNew(true); setEditing(m); setTagInput(''); setMemberTab('main'); setNoteText('');
    setNoteAuthorId(members.find(mm => !mm.archived)?.id || null);
  };

  const openEdit = (m: Member) => {
    setF({ ...m, tags: m.tags || [], groupIds: m.groupIds || [] });
    setIsNew(false); setEditing(m); setTagInput(''); setMemberTab('main'); setNoteText('');
    setNoteAuthorId(members.find(mm => !mm.archived)?.id || null);
  };

  const set = (k: keyof Member, v: any) => setF(x => ({ ...x, [k]: v }));

  const addTag = () => {
    const raw = tagInput.trim().replace(/^#/, '').toLowerCase();
    if (!raw) return;
    setF(x => {
      const cur = x.tags || [];
      if (cur.includes(`#${raw}`)) return x;
      return { ...x, tags: [...cur, `#${raw}`] };
    });
    setTagInput('');
  };

  const toggleGroup = (gid: string) => {
    setF(x => {
      const cur = x.groupIds || [];
      return { ...x, groupIds: cur.includes(gid) ? cur.filter(id => id !== gid) : [...cur, gid] };
    });
  };

  const saveMember = async () => {
    if (!f.name.trim()) return;
    const updated = isNew
      ? [...members, f]
      : members.map(m => m.id === f.id ? f : m);
    await store.set(KEYS.members, updated);
    setEditing(null);
    onUpdate();
  };

  const deleteMember = async (id: string) => {
    await store.set(KEYS.members, members.filter(m => m.id !== id));
    setConfirmDelete(null);
    setEditing(null);
    onUpdate();
  };

  const pickAvatar = async () => {
    const filePath = await window.electronAPI.dialog.openFile([
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
    ]);
    if (!filePath) return;
    const dataUrl = await window.electronAPI.file.readAsBase64(filePath);
    if (dataUrl) set('avatar', dataUrl);
  };

  const pickBanner = async () => {
    const filePath = await window.electronAPI.dialog.openFile([
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
    ]);
    if (!filePath) return;
    const dataUrl = await window.electronAPI.file.readAsBase64(filePath);
    if (!dataUrl) return;
    try {
      const resized = await resizeBannerDataUrl(dataUrl);
      set('banner', resized);
    } catch { set('banner', dataUrl); }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="field__input" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t('members.search')} style={{ flex: 1, minWidth: 140 }} />
        <Dropdown<MemberSortMode>
          value={sortMode}
          options={['alphabetical', 'reverse-alphabetical', 'age', 'color', 'role', 'manual']}
          onChange={setSortMode}
          renderOption={v => t(`memberSort.${v}`)}
        />
        <Btn variant={showArchived ? 'info' : 'ghost'} onClick={() => setShowArchived(!showArchived)}>
          {showArchived ? `${t('members.archived')} (${archived.length})` : `${t('members.active')} (${active.length})`}
        </Btn>
        <Btn variant="solid" onClick={openNew}>{t('members.add')}</Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
        {filtered.map(m => (
          <div key={m.id} className="tile" style={{ minHeight: 'auto', padding: 14, cursor: 'pointer' }}
            onClick={() => openEdit(m)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="tile__avatar" style={{
                width: 40, height: 40, fontSize: 14, overflow: 'hidden',
                ...(!m.avatar ? { backgroundColor: m.color } : {}),
              }}>
                {m.avatar ? <img src={m.avatar} style={{ width: 40, height: 40, borderRadius: 20, objectFit: 'cover' }} /> : getInitials(m.name)}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{m.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {[m.pronouns, m.role].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div style={{ width: 10, height: 10, borderRadius: 5, background: m.color, flexShrink: 0 }} />
            </div>
            {(m.tags || []).length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                {(m.tags || []).slice(0, 4).map(tag => (
                  <span key={tag} style={{ fontSize: 10, color: 'var(--info)', background: 'var(--info-bg)', padding: '1px 6px', borderRadius: 999 }}>
                    {tag}
                  </span>
                ))}
                {(m.tags || []).length > 4 && (
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>+{(m.tags || []).length - 4}</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>
          {search ? t('members.noMembers') : showArchived ? t('members.noArchived') : t('members.noMembers')}
        </div>
      )}

      <Modal open={!!editing} title={isNew ? t('modal.addMember') : t('modal.editMember')} onClose={() => setEditing(null)}
        footer={
          <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'space-between' }}>
            <div>
              {!isNew && (
                <Btn variant="danger" onClick={() => setConfirmDelete(f.id)}>{t('common.delete')}</Btn>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="ghost" onClick={() => setEditing(null)}>{t('common.cancel')}</Btn>
              <Btn variant="solid" onClick={saveMember}>{t('common.save')}</Btn>
            </div>
          </div>
        }>
        {!isNew && (
          <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
            {(['main', 'fields', 'noteboard'] as MemberTab[]).map(tab => (
              <button key={tab} style={{
                padding: '8px 16px', fontSize: 13, fontWeight: memberTab === tab ? 600 : 400, cursor: 'pointer',
                color: memberTab === tab ? 'var(--accent)' : 'var(--dim)', background: 'none', border: 'none',
                borderBottom: `2px solid ${memberTab === tab ? 'var(--accent)' : 'transparent'}`,
              }} onClick={() => setMemberTab(tab)}>
                {tab === 'main' ? t('modal.editMember')
                  : tab === 'fields' ? t('customFields.title')
                  : t('noteboard.title')}
              </button>
            ))}
          </div>
        )}

        {(memberTab === 'main' || isNew) && (<>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div className="tile__avatar" style={{
              width: 72, height: 72, borderRadius: 36, fontSize: 24, margin: '0 auto', cursor: 'pointer',
              border: `2px solid ${f.color}`, overflow: 'hidden',
              ...(!f.avatar ? { backgroundColor: f.color } : {}),
            }} onClick={pickAvatar}>
              {f.avatar ? <img src={f.avatar} style={{ width: 72, height: 72, borderRadius: 36, objectFit: 'cover' }} /> : getInitials(f.name || '?')}
            </div>
            <div style={{ marginTop: 6, display: 'flex', justifyContent: 'center', gap: 8 }}>
              <button style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={pickAvatar}>📷</button>
              {f.avatar && (
                <button style={{ fontSize: 11, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}
                  onClick={() => set('avatar', undefined)}>{t('modal.removePfp')}</button>
              )}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ width: '100%', aspectRatio: '3 / 1', borderRadius: 8, border: '1px dashed var(--border)', overflow: 'hidden', cursor: 'pointer',
              backgroundImage: f.banner ? `url(${f.banner})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center',
              backgroundColor: f.banner ? undefined : 'var(--surface)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--dim)', fontSize: 12,
            }} onClick={pickBanner}>
              {!f.banner && t('memberProfile.changeBanner')}
            </div>
            {f.banner && <button style={{ fontSize: 10, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4 }}
              onClick={() => set('banner', undefined)}>{t('memberProfile.removeBanner')}</button>}
          </div>

          <Field label={t('modal.name')} value={f.name} onChange={v => set('name', v)} placeholder={t('modal.headmateName')} />
          <Field label={t('modal.pronouns')} value={f.pronouns} onChange={v => set('pronouns', v)} placeholder={t('modal.pronounsPlaceholder')} />
          <Field label={t('modal.role')} value={f.role} onChange={v => set('role', v)} placeholder={t('modal.rolePlaceholder')} />

          <Section label={t('modal.color')} />
          <ColorPicker value={f.color} onChange={v => set('color', v)} palette={PALETTE} />

          {groups.length > 0 && (
            <>
              <Section label={t('memberGroups.title')} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
                {groups.map(g => {
                  const active = (f.groupIds || []).includes(g.id);
                  return (
                    <button key={g.id} className={`chip ${active ? '' : ''}`}
                      style={{
                        borderColor: active ? `${g.color || 'var(--accent)'}50` : 'var(--border)',
                        background: active ? `${g.color || 'var(--accent)'}20` : 'var(--surface)',
                        color: active ? (g.color || 'var(--accent)') : 'var(--dim)',
                      }}
                      onClick={() => toggleGroup(g.id)}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: g.color || 'var(--accent)', display: 'inline-block' }} />
                      {g.name}
                      {active && <span style={{ fontWeight: 700 }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <Section label={t('modal.memberTags')} />
          <ChipList items={f.tags || []} onRemove={tag => setF(x => ({ ...x, tags: (x.tags || []).filter(t => t !== tag) }))} />
          <AddRow value={tagInput} onChange={setTagInput} onAdd={addTag} placeholder={t('modal.memberTagPlaceholder')} />

          <Section label={t('modal.descriptionBio')} />
          <Field value={f.description} onChange={v => set('description', v)} placeholder={t('modal.descriptionPlaceholder')} multiline />

          {!isNew && (
            <Toggle label={t('modal.archiveMember')} description={t('modal.archiveDesc')}
              value={!!f.archived} onChange={v => set('archived', v)} />
          )}
        </>)}

        {memberTab === 'fields' && !isNew && (
          <div>
            {fieldDefs.length > 0 ? (
              fieldDefs.map(fd => {
                const cfv = (f.customFields || []).find(v => v.fieldId === fd.id);
                const val = cfv?.value ?? '';
                const setFieldVal = (newVal: string | number | boolean | null) => {
                  const existing = f.customFields || [];
                  const updated = existing.some(v => v.fieldId === fd.id)
                    ? existing.map(v => v.fieldId === fd.id ? { ...v, value: newVal } : v)
                    : [...existing, { fieldId: fd.id, value: newVal }];
                  set('customFields' as any, updated);
                };
                return (
                  <div key={fd.id} style={{ marginBottom: 14 }}>
                    {fd.type === 'toggle' ? (
                      <Toggle label={fd.name} value={!!val} onChange={v => setFieldVal(v)} />
                    ) : fd.type === 'number' ? (
                      <Field label={fd.name} value={String(val || '')} onChange={v => setFieldVal(v === '' ? null : Number(v))} placeholder="0" />
                    ) : fd.type === 'color' ? (
                      <div>
                        <label className="field__label">{fd.name}</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 6, background: String(val || '#333'), border: '1px solid var(--border)' }} />
                          <input className="field__input" type="color" value={String(val || '#333333')}
                            onChange={e => setFieldVal(e.target.value)} style={{ width: 60, padding: 2 }} />
                        </div>
                      </div>
                    ) : fd.type === 'date' || fd.type === 'timestamp' ? (
                      <div>
                        <label className="field__label">{fd.name}</label>
                        <input className="field__input" type={fd.type === 'timestamp' ? 'datetime-local' : 'date'}
                          value={String(val || '')} onChange={e => setFieldVal(e.target.value)} />
                      </div>
                    ) : fd.type === 'month' ? (
                      <div>
                        <label className="field__label">{fd.name}</label>
                        <input className="field__input" type="month" value={String(val || '')} onChange={e => setFieldVal(e.target.value)} />
                      </div>
                    ) : fd.type === 'year' ? (
                      <Field label={fd.name} value={String(val || '')} onChange={v => setFieldVal(v)} placeholder="YYYY" />
                    ) : fd.type === 'monthYear' ? (
                      <div>
                        <label className="field__label">{fd.name}</label>
                        <input className="field__input" type="month" value={String(val || '')} onChange={e => setFieldVal(e.target.value)} />
                      </div>
                    ) : fd.type === 'monthDay' ? (
                      <div>
                        <label className="field__label">{fd.name}</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <select className="field__input" style={{ flex: 1 }} value={String(val || '').split('-')[0] || ''}
                            onChange={e => setFieldVal(`${e.target.value}-${String(val || '').split('-')[1] || '01'}`)}>
                            <option value="">Month</option>
                            {Array.from({length: 12}, (_, i) => <option key={i+1} value={String(i+1).padStart(2,'0')}>{new Date(2000, i).toLocaleString('default', {month: 'long'})}</option>)}
                          </select>
                          <input className="field__input" type="number" min="1" max="31" style={{ width: 70 }}
                            value={String(val || '').split('-')[1] || ''}
                            onChange={e => setFieldVal(`${String(val || '').split('-')[0] || '01'}-${e.target.value}`)}
                            placeholder="Day" />
                        </div>
                      </div>
                    ) : fd.type === 'dateRange' ? (
                      <div>
                        <label className="field__label">{fd.name}</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input className="field__input" type="date" value={String(val || '').split('|')[0] || ''}
                            onChange={e => setFieldVal(`${e.target.value}|${String(val || '').split('|')[1] || ''}`)} style={{ flex: 1 }} />
                          <input className="field__input" type="date" value={String(val || '').split('|')[1] || ''}
                            onChange={e => setFieldVal(`${String(val || '').split('|')[0] || ''}|${e.target.value}`)} style={{ flex: 1 }} />
                        </div>
                      </div>
                    ) : (
                      <Field label={fd.name} value={String(val || '')} onChange={v => setFieldVal(v)}
                        placeholder={fd.name} multiline={fd.type === 'markdown'} />
                    )}
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)', fontSize: 13 }}>
                {t('customFields.noFieldsInfo')}
              </div>
            )}
          </div>
        )}

        {memberTab === 'noteboard' && !isNew && (
          <div>
            {memberNotes.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {memberNotes.map(note => {
                  const author = members.find(m => m.id === note.authorId);
                  return (
                    <div key={note.id} style={{
                      padding: 12, background: note.pinned ? 'var(--accent-bg)' : 'var(--card)',
                      border: `1px solid ${note.pinned ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 22, height: 22, borderRadius: 11, fontSize: 9, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: author?.color || 'var(--muted)', color: 'rgba(0,0,0,0.75)' }}>
                          {getInitials(author?.name || '?')}
                        </div>
                        <span style={{ fontSize: 12, color: author?.color || 'var(--dim)', fontWeight: 500 }}>{author?.name || '?'}</span>
                        <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 'auto' }}>{fmtTime(note.timestamp)}</span>
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{note.content}</p>
                      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                        <button style={{ background: 'none', border: 'none', fontSize: 11, color: note.pinned ? 'var(--accent)' : 'var(--dim)', cursor: 'pointer' }}
                          onClick={() => togglePin(note.id)}>{note.pinned ? `📌 ${t('noteboard.unpin')}` : t('noteboard.pin')}</button>
                        <button style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--danger)', cursor: 'pointer' }}
                          onClick={() => deleteNote(note.id)}>{t('noteboard.deleteNote')}</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)', fontSize: 13 }}>{t('noteboard.noNotes')}</div>
            )}

            <div style={{ padding: 12, background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--dim)' }}>{t('noteboard.writingAs')}</span>
                <select style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px', fontSize: 12 }}
                  value={noteAuthorId || ''} onChange={e => setNoteAuthorId(e.target.value)}>
                  {members.filter(m => !m.archived).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <textarea className="field__input field__input--multi" value={noteText} onChange={e => setNoteText(e.target.value)}
                  placeholder={t('noteboard.placeholder')} style={{ flex: 1, minHeight: 48, fontSize: 13 }}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addNote(); }} />
                <Btn variant="solid" onClick={addNote}>{t('common.add')}</Btn>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!confirmDelete}
        title={t('modal.confirmDelete')}
        message={t('modal.confirmDelete')}
        danger
        onConfirm={() => confirmDelete && deleteMember(confirmDelete)}
        onCancel={() => setConfirmDelete(null)} />
    </div>
  );
}
