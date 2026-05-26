import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Member, JournalEntry, JournalTemplate, uid, fmtDate } from '../utils';
import { store, KEYS } from '../storage';
import { Btn, Field, Section, Modal, ConfirmDialog } from '../components/ui';

interface Props {
  journal: JournalEntry[];
  members: Member[];
  onUpdate: () => void;
}

type TabId = 'entries' | 'templates';

export default function JournalView({ journal, members, onUpdate }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabId>('entries');
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [authorFilter, setAuthorFilter] = useState('');
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [authorIds, setAuthorIds] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [authorSearch, setAuthorSearch] = useState('');

  const [templates, setTemplates] = useState<JournalTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<JournalTemplate | null>(null);
  const [isNewTemplate, setIsNewTemplate] = useState(false);
  const [confirmDeleteTemplate, setConfirmDeleteTemplate] = useState<string | null>(null);
  const [tplName, setTplName] = useState('');
  const [tplTitle, setTplTitle] = useState('');
  const [tplBody, setTplBody] = useState('');
  const [tplTags, setTplTags] = useState<string[]>([]);
  const [tplTagInput, setTplTagInput] = useState('');
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  useEffect(() => {
    store.get<JournalTemplate[]>(KEYS.journalTemplates, []).then(tpls => setTemplates(tpls || []));
  }, []);

  const getMember = (id: string) => members.find(m => m.id === id);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    journal.forEach(e => e.hashtags?.forEach(t => set.add(t)));
    return [...set].sort();
  }, [journal]);

  const sorted = useMemo(() => {
    return [...journal]
      .sort((a, b) => b.timestamp - a.timestamp)
      .filter(e => {
        if (search && !e.title.toLowerCase().includes(search.toLowerCase()) && !e.body.toLowerCase().includes(search.toLowerCase())) return false;
        if (tagFilter && !(e.hashtags || []).includes(tagFilter)) return false;
        if (authorFilter && !(e.authorIds || []).includes(authorFilter)) return false;
        return true;
      });
  }, [journal, search, tagFilter, authorFilter]);

  const openNew = () => {
    setTitle(''); setBody(''); setHashtags([]); setAuthorIds([]); setTagInput('');
    setIsNew(true); setEditing({ id: uid(), title: '', body: '', authorIds: [], hashtags: [], timestamp: Date.now() });
  };

  const openNewFromTemplate = (tpl: JournalTemplate) => {
    setTitle(tpl.title);
    setBody(tpl.body);
    setHashtags(tpl.hashtags || []);
    setAuthorIds([]);
    setTagInput('');
    setIsNew(true);
    setEditing({ id: uid(), title: tpl.title, body: tpl.body, authorIds: [], hashtags: tpl.hashtags || [], timestamp: Date.now() });
    setShowTemplatePicker(false);
  };

  const openEdit = (e: JournalEntry) => {
    setTitle(e.title); setBody(e.body); setHashtags(e.hashtags || []); setAuthorIds(e.authorIds || []); setTagInput('');
    setIsNew(false); setEditing(e);
  };

  const addTag = () => {
    const raw = tagInput.trim().replace(/^#/, '').toLowerCase();
    if (raw && !hashtags.includes(`#${raw}`)) setHashtags([...hashtags, `#${raw}`]);
    setTagInput('');
  };

  const toggleAuthor = (id: string) => {
    setAuthorIds(authorIds.includes(id) ? authorIds.filter(a => a !== id) : [...authorIds, id]);
  };

  const saveEntry = async () => {
    if (!title.trim()) return;
    const entry: JournalEntry = {
      id: editing?.id || uid(),
      title: title.trim(),
      body,
      authorIds,
      hashtags,
      timestamp: editing?.timestamp || Date.now(),
      password: editing?.password,
    };
    const updated = isNew
      ? [...journal, entry]
      : journal.map(e => e.id === entry.id ? entry : e);
    await store.set(KEYS.journal, updated);
    setEditing(null);
    onUpdate();
  };

  const deleteEntry = async (id: string) => {
    await store.set(KEYS.journal, journal.filter(e => e.id !== id));
    setConfirmDelete(null);
    setEditing(null);
    onUpdate();
  };

  const openNewTemplate = () => {
    setTplName(''); setTplTitle(''); setTplBody(''); setTplTags([]); setTplTagInput('');
    setIsNewTemplate(true);
    setEditingTemplate({ id: uid(), name: '', title: '', body: '', hashtags: [], createdAt: Date.now() });
  };

  const openEditTemplate = (tpl: JournalTemplate) => {
    setTplName(tpl.name); setTplTitle(tpl.title); setTplBody(tpl.body); setTplTags(tpl.hashtags || []); setTplTagInput('');
    setIsNewTemplate(false);
    setEditingTemplate(tpl);
  };

  const addTplTag = () => {
    const raw = tplTagInput.trim().replace(/^#/, '').toLowerCase();
    if (raw && !tplTags.includes(`#${raw}`)) setTplTags([...tplTags, `#${raw}`]);
    setTplTagInput('');
  };

  const saveTemplate = async () => {
    if (!tplName.trim()) return;
    const tpl: JournalTemplate = {
      id: editingTemplate?.id || uid(),
      name: tplName.trim(),
      title: tplTitle,
      body: tplBody,
      hashtags: tplTags,
      createdAt: editingTemplate?.createdAt || Date.now(),
    };
    const updated = isNewTemplate
      ? [...templates, tpl]
      : templates.map(x => x.id === tpl.id ? tpl : x);
    setTemplates(updated);
    await store.set(KEYS.journalTemplates, updated);
    setEditingTemplate(null);
  };

  const deleteTemplate = async (id: string) => {
    const updated = templates.filter(x => x.id !== id);
    setTemplates(updated);
    await store.set(KEYS.journalTemplates, updated);
    setConfirmDeleteTemplate(null);
    setEditingTemplate(null);
  };

  const filteredAuthors = members.filter(m => !m.archived && (!authorSearch || m.name.toLowerCase().includes(authorSearch.toLowerCase())));

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        {(['entries', 'templates'] as TabId[]).map(id => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: '10px 20px', fontSize: 13, fontWeight: tab === id ? 600 : 400, cursor: 'pointer',
            color: tab === id ? 'var(--accent)' : 'var(--dim)', background: 'none', border: 'none',
            borderBottom: `2px solid ${tab === id ? 'var(--accent)' : 'transparent'}`,
          }}>
            {id === 'entries' ? t('journal.entriesTab', { defaultValue: 'Entries' }) : t('journal.templatesTab', { defaultValue: 'Templates' })}
          </button>
        ))}
      </div>

      {tab === 'entries' && (<>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <input className="field__input" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search entries..." style={{ flex: 1, minWidth: 200 }} />

          <select style={{
            background: 'var(--surface)', color: tagFilter ? 'var(--accent)' : 'var(--muted)',
            border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13,
          }} value={tagFilter} onChange={e => setTagFilter(e.target.value)}>
            <option value="">All tags</option>
            {allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
          </select>

          <select style={{
            background: 'var(--surface)', color: authorFilter ? 'var(--accent)' : 'var(--muted)',
            border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13,
          }} value={authorFilter} onChange={e => setAuthorFilter(e.target.value)}>
            <option value="">All authors</option>
            {members.filter(m => !m.archived).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>

          {templates.length > 0 && (
            <Btn variant="ghost" onClick={() => setShowTemplatePicker(true)}>{t('journal.fromTemplate', { defaultValue: 'From template…' })}</Btn>
          )}
          <Btn variant="solid" onClick={openNew}>+ New Entry</Btn>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sorted.map(entry => (
            <div key={entry.id} className="tile" style={{ minHeight: 'auto', padding: 16, cursor: 'pointer' }}
              onClick={() => openEdit(entry)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{entry.title}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', marginLeft: 12 }}>
                  {fmtDate(entry.timestamp)}
                </span>
              </div>
              {entry.body && (
                <p style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.5, marginBottom: 6,
                  overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {entry.body.replace(/<[^>]+>/g, '').slice(0, 200)}
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {(entry.authorIds || []).map(id => {
                  const m = getMember(id);
                  return m ? (
                    <span key={id} style={{ fontSize: 11, color: m.color }}>{m.name}</span>
                  ) : null;
                })}
                {(entry.hashtags || []).map(tag => (
                  <span key={tag} style={{ fontSize: 10, color: 'var(--info)', background: 'var(--info-bg)', padding: '1px 6px', borderRadius: 999 }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {sorted.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>
            {search || tagFilter || authorFilter ? t('journal.noEntriesFilter') : t('journal.noEntries')}
          </div>
        )}
      </>)}

      {tab === 'templates' && (<>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, flex: 1, marginRight: 12 }}>
            {t('journal.templateHint', { defaultValue: 'Pre-fill from a saved template?' })}
          </p>
          <Btn variant="solid" onClick={openNewTemplate}>{t('journal.newTemplate', { defaultValue: '+ New Template' })}</Btn>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {templates.map(tpl => (
            <div key={tpl.id} className="tile" style={{ minHeight: 'auto', padding: 16, cursor: 'pointer' }}
              onClick={() => openEditTemplate(tpl)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{tpl.name}</span>
              </div>
              {tpl.title && (
                <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 4 }}>
                  {tpl.title}
                </div>
              )}
              {tpl.body && (
                <p style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.5, marginBottom: 6,
                  overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {tpl.body.replace(/<[^>]+>/g, '').slice(0, 200)}
                </p>
              )}
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                {(tpl.hashtags || []).map(tag => (
                  <span key={tag} style={{ fontSize: 10, color: 'var(--info)', background: 'var(--info-bg)', padding: '1px 6px', borderRadius: 999 }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {templates.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>
            {t('journal.noTemplates', { defaultValue: 'No templates yet. Create one to pre-fill new entries.' })}
          </div>
        )}
      </>)}

      <Modal open={!!editing} title={isNew ? t('modal.newEntry') : t('modal.editEntry')} onClose={() => setEditing(null)}
        footer={
          <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'space-between' }}>
            <div>{!isNew && <Btn variant="danger" onClick={() => setConfirmDelete(editing?.id || '')}>{t('common.delete')}</Btn>}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="ghost" onClick={() => setEditing(null)}>{t('common.cancel')}</Btn>
              <Btn variant="solid" onClick={saveEntry}>{t('common.save')}</Btn>
            </div>
          </div>
        }>
        <Field label={t('modal.entryTitle')} value={title} onChange={setTitle} placeholder={t('modal.entryTitlePlaceholder')} />

        <Field label={t('modal.body')} value={body} onChange={setBody} placeholder={t('modal.writeHere')} multiline />

        <Section label={t('modal.authors')} />
        <input className="field__input" value={authorSearch} onChange={e => setAuthorSearch(e.target.value)}
          placeholder={t('members.search')} style={{ marginBottom: 8 }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {filteredAuthors.slice(0, 12).map(m => {
            const active = authorIds.includes(m.id);
            return (
              <button key={m.id} className="chip" style={{
                borderColor: active ? `${m.color}60` : 'var(--border)',
                background: active ? `${m.color}20` : 'var(--surface)',
              }} onClick={() => toggleAuthor(m.id)}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.color, display: 'inline-block' }} />
                <span style={{ color: active ? m.color : 'var(--dim)' }}>{m.name}</span>
                {active && <span style={{ fontWeight: 700, color: m.color }}>✓</span>}
              </button>
            );
          })}
        </div>

        <Section label={t('modal.tags')} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {hashtags.map(tag => (
            <button key={tag} className="chip" style={{ borderColor: 'var(--info)40', background: 'var(--info-bg)' }}
              onClick={() => setHashtags(hashtags.filter(t => t !== tag))}>
              <span style={{ color: 'var(--info)' }}>{tag}</span>
              <span className="chip__x">✕</span>
            </button>
          ))}
        </div>
        <div className="add-row">
          <input className="field__input" value={tagInput} onChange={e => setTagInput(e.target.value)}
            placeholder={t('modal.topic')} onKeyDown={e => { if (e.key === 'Enter') addTag(); }} />
          <Btn onClick={addTag}>{t('common.add')}</Btn>
        </div>
      </Modal>

      <Modal open={!!editingTemplate} title={isNewTemplate ? t('journal.newTemplate', { defaultValue: 'New Template' }) : t('journal.editTemplate', { defaultValue: 'Edit Template' })} onClose={() => setEditingTemplate(null)}
        footer={
          <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'space-between' }}>
            <div>{!isNewTemplate && <Btn variant="danger" onClick={() => setConfirmDeleteTemplate(editingTemplate?.id || '')}>{t('common.delete')}</Btn>}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="ghost" onClick={() => setEditingTemplate(null)}>{t('common.cancel')}</Btn>
              <Btn variant="solid" onClick={saveTemplate}>{t('common.save')}</Btn>
            </div>
          </div>
        }>
        <Field label={t('journal.templateName', { defaultValue: 'Template Name *' })} value={tplName} onChange={setTplName} placeholder={t('journal.templateNamePlaceholder', { defaultValue: 'e.g. Morning Pages' })} />
        <Field label={t('journal.templateTitle', { defaultValue: 'Entry Title (preset)' })} value={tplTitle} onChange={setTplTitle} placeholder={t('modal.entryTitlePlaceholder')} />
        <Field label={t('journal.templateBody', { defaultValue: 'Entry Body (preset)' })} value={tplBody} onChange={setTplBody} placeholder={t('modal.writeHere')} multiline />
        <Section label={t('modal.tags')} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {tplTags.map(tag => (
            <button key={tag} className="chip" style={{ borderColor: 'var(--info)40', background: 'var(--info-bg)' }}
              onClick={() => setTplTags(tplTags.filter(t => t !== tag))}>
              <span style={{ color: 'var(--info)' }}>{tag}</span>
              <span className="chip__x">✕</span>
            </button>
          ))}
        </div>
        <div className="add-row">
          <input className="field__input" value={tplTagInput} onChange={e => setTplTagInput(e.target.value)}
            placeholder={t('modal.topic')} onKeyDown={e => { if (e.key === 'Enter') addTplTag(); }} />
          <Btn onClick={addTplTag}>{t('common.add')}</Btn>
        </div>
      </Modal>

      <Modal open={showTemplatePicker} title={t('journal.pickTemplate', { defaultValue: 'Pick a template' })} onClose={() => setShowTemplatePicker(false)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {templates.map(tpl => (
            <button key={tpl.id} onClick={() => openNewFromTemplate(tpl)} style={{
              padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)',
              color: 'var(--text)', textAlign: 'left', cursor: 'pointer',
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{tpl.name}</div>
              {tpl.title && <div style={{ fontSize: 12, color: 'var(--dim)' }}>{tpl.title}</div>}
            </button>
          ))}
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmDelete} title={t('journal.deleteEntry')} message={t('journal.areYouSure')}
        danger onConfirm={() => confirmDelete && deleteEntry(confirmDelete)} onCancel={() => setConfirmDelete(null)} />

      <ConfirmDialog open={!!confirmDeleteTemplate} title={t('journal.editTemplate', { defaultValue: 'Delete Template' })} message={t('journal.areYouSure')}
        danger onConfirm={() => confirmDeleteTemplate && deleteTemplate(confirmDeleteTemplate)} onCancel={() => setConfirmDeleteTemplate(null)} />
    </div>
  );
}
