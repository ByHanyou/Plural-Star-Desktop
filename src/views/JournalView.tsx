import { useState, useMemo, useEffect, useId } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { JournalEntry, JournalTemplate, uid, tagKey, uniqueTags, upsertById } from '../utils';
import { saveData } from '../store/actions';
import { memberFacetPools } from '../picker/memberPicker';
import { MemberGroupSelect } from '../components/MemberGroupSelect';
import { Btn, EmptyState, Modal, SaveErrorDialog, TabBar, clickable } from '../components/ui';
import { useAppStore } from '../store/appStore';
import { useSaveGuard } from '../hooks/useSaveGuard';
import { EntryCard, clampStyle, previewText } from './journal/EntryCard';
import { TagChips } from '../components/TagChips';
import { EntryModal } from './journal/EntryModal';
import { TemplateModal } from './journal/TemplateModal';

type TabId = 'entries' | 'templates';

const TABS: readonly TabId[] = ['entries', 'templates'];

const liveJournal = () => useAppStore.getState().journal;
const liveTemplates = () => useAppStore.getState().journalTemplates;

const newEntry = (tpl?: JournalTemplate): JournalEntry => ({
  id: uid(), title: tpl?.title || '', body: tpl?.body || '', authorIds: [], hashtags: tpl?.hashtags || [], timestamp: Date.now(),
});

const newTemplate = (): JournalTemplate => ({ id: uid(), name: '', title: '', body: '', hashtags: [], createdAt: Date.now() });

const filterStyle = (active: boolean) => ({
  background: 'var(--surface)', color: active ? 'var(--accent)' : 'var(--muted)',
  border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13,
});

function PasswordPrompt({ id, value, onChange, error, onSubmit, style }: {
  id: string; value: string; onChange: (v: string) => void; error: boolean; onSubmit: () => void; style?: CSSProperties;
}) {
  const { t } = useTranslation();
  return (
    <>
      <input className="field__input" type="password" value={value} aria-label={t('journal.password')} placeholder={t('journal.password')} autoFocus
        aria-invalid={error} aria-describedby={error ? id : undefined}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onSubmit(); }}
        style={{ width: '100%', ...style, ...(error ? { borderColor: 'var(--danger)' } : {}) }} />
      {error && <div role="alert" id={id} style={{ fontSize: 12, color: 'var(--danger)', marginTop: 8 }}>{t('journal.incorrectPassword')}</div>}
    </>
  );
}

export default function JournalView() {
  const { t } = useTranslation();
  const journal = useAppStore(s => s.journal);
  const templates = useAppStore(s => s.journalTemplates);
  const members = useAppStore(s => s.members);
  const journalPassword = useAppStore(s => s.system.journalPassword);
  const [tab, setTab] = useState<TabId>('entries');
  const [journalUnlocked, setJournalUnlocked] = useState(!journalPassword);
  const [globalPw, setGlobalPw] = useState('');
  const [globalPwError, setGlobalPwError] = useState(false);
  const [unlockedEntries, setUnlockedEntries] = useState<Set<string>>(new Set());
  const [entryPwFor, setEntryPwFor] = useState<JournalEntry | null>(null);
  const [entryPw, setEntryPw] = useState('');
  const [entryPwError, setEntryPwError] = useState(false);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [authorFilter, setAuthorFilter] = useState('');
  const [editing, setEditing] = useState<{ entry: JournalEntry; isNew: boolean } | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<{ template: JournalTemplate; isNew: boolean } | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [saveError, run, clearSaveError] = useSaveGuard();
  const jid = useId();

  useEffect(() => { if (!journalPassword) setJournalUnlocked(true); }, [journalPassword]);

  const allTags = useMemo(() => uniqueTags(journal.flatMap(e => e.hashtags || [])), [journal]);
  const tagFilterKey = tagFilter ? tagKey(tagFilter) : '';

  const sorted = useMemo(() => {
    const q = search.toLowerCase();
    return [...journal]
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.timestamp - a.timestamp)
      .filter(e => {
        if (q && !e.title.toLowerCase().includes(q) && !e.body.toLowerCase().includes(q)) return false;
        if (tagFilterKey && !(e.hashtags || []).some(tag => tagKey(tag) === tagFilterKey)) return false;
        return !authorFilter || (e.authorIds || []).includes(authorFilter);
      });
  }, [journal, search, tagFilterKey, authorFilter]);

  const saveJournal = (next: JournalEntry[]) => run(() => saveData('journal', next));
  const saveTemplates = (next: JournalTemplate[]) => run(() => saveData('journalTemplates', next));

  const isLocked = (e: JournalEntry) => !!e.password && !unlockedEntries.has(e.id);

  const openEntry = (e: JournalEntry) => {
    if (isLocked(e)) { setEntryPw(''); setEntryPwError(false); setEntryPwFor(e); return; }
    setEditing({ entry: e, isNew: false });
  };

  const confirmEntryPw = () => {
    if (!entryPwFor) return;
    if (entryPw !== entryPwFor.password) { setEntryPwError(true); return; }
    const e = entryPwFor;
    setUnlockedEntries(prev => new Set([...prev, e.id]));
    setEntryPwFor(null); setEntryPw(''); setEntryPwError(false);
    setEditing({ entry: e, isNew: false });
  };

  const unlockJournal = () => {
    if (globalPw === journalPassword) { setJournalUnlocked(true); setGlobalPw(''); setGlobalPwError(false); }
    else setGlobalPwError(true);
  };

  const startFromTemplate = (tpl: JournalTemplate) => {
    setShowTemplatePicker(false);
    setEditing({ entry: newEntry(tpl), isNew: true });
  };

  const saveEntry = async (entry: JournalEntry) => {
    if (await saveJournal(upsertById(liveJournal(), entry))) setEditing(null);
  };

  const deleteEntry = async (id: string) => {
    if (await saveJournal(liveJournal().filter(e => e.id !== id))) setEditing(null);
  };

  const saveTemplate = async (tpl: JournalTemplate) => {
    if (await saveTemplates(upsertById(liveTemplates(), tpl))) setEditingTemplate(null);
  };

  const deleteTemplate = async (id: string) => {
    if (await saveTemplates(liveTemplates().filter(x => x.id !== id))) setEditingTemplate(null);
  };

  if (!journalUnlocked) {
    return (
      <div style={{ maxWidth: 420, margin: '60px auto', textAlign: 'center' }}>
        <div aria-hidden style={{ fontSize: 40, color: 'var(--accent)', marginBottom: 12 }}>◉</div>
        <h2 style={{ fontSize: 20, fontWeight: 600, fontStyle: 'italic', color: 'var(--text)', marginBottom: 6 }}>{t('journal.locked')}</h2>
        <p style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 18 }}>{t('journal.enterPasswordToContinue')}</p>
        <PasswordPrompt id={`${jid}-gpw`} value={globalPw} onChange={v => { setGlobalPw(v); setGlobalPwError(false); }} error={globalPwError} onSubmit={unlockJournal} style={{ marginBottom: 6 }} />
        <Btn variant="solid" onClick={unlockJournal} style={{ width: '100%', marginTop: 8 }}>{t('journal.unlockJournal')}</Btn>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <TabBar tabs={TABS} value={tab} onChange={setTab} label={id => (id === 'entries' ? t('journal.entriesTab') : t('journal.templatesTab'))} />

      {tab === 'entries' && (<>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <input className="field__input" value={search} onChange={e => setSearch(e.target.value)}
            aria-label={t('common.searchEntries')} placeholder={t('common.searchEntries')} style={{ flex: 1, minWidth: 200 }} />
          <select style={filterStyle(!!tagFilter)} aria-label={t('common.filterByTag')} value={tagFilter} onChange={e => setTagFilter(e.target.value)}>
            <option value="">{t('journal.allTags')}</option>
            {allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
          </select>
          <MemberGroupSelect label={t('common.filterByAuthor')} value={authorFilter} onChange={setAuthorFilter} pools={memberFacetPools(members, t)}
            leading={<option value="">{t('common.allAuthors')}</option>} style={filterStyle(!!authorFilter)} />
          {templates.length > 0 && (
            <Btn variant="ghost" onClick={() => setShowTemplatePicker(true)}>{t('journal.fromTemplate')}</Btn>
          )}
          <Btn variant="solid" onClick={() => setEditing({ entry: newEntry(), isNew: true })}>{t('journal.newEntry')}</Btn>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sorted.map(entry => (
            <EntryCard key={entry.id} entry={entry} locked={isLocked(entry)} members={members} onOpen={() => openEntry(entry)}
              onTogglePin={() => void saveJournal(upsertById(liveJournal(), { ...entry, pinned: !entry.pinned }))} />
          ))}
        </div>

        {sorted.length === 0 && (
          <EmptyState>
            {search || tagFilter || authorFilter ? t('journal.noEntriesFilter') : t('journal.noEntries')}
          </EmptyState>
        )}
      </>)}

      {tab === 'templates' && (<>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, flex: 1, marginRight: 12 }}>
            {t('journal.templateHint')}
          </p>
          <Btn variant="solid" onClick={() => setEditingTemplate({ template: newTemplate(), isNew: true })}>{t('journal.newTemplate')}</Btn>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {templates.map(tpl => (
            <div key={tpl.id} className="tile" style={{ minHeight: 'auto', padding: 16, cursor: 'pointer' }}
              {...clickable(() => setEditingTemplate({ template: tpl, isNew: false }))}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{tpl.name}</div>
              {tpl.title && <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 4 }}>{tpl.title}</div>}
              {tpl.body && <p style={clampStyle}>{previewText(tpl.body)}</p>}
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                <TagChips tags={tpl.hashtags || []} />
              </div>
            </div>
          ))}
        </div>

        {templates.length === 0 && (
          <EmptyState>
            {t('journal.noTemplates')}
          </EmptyState>
        )}
      </>)}

      {editing && (
        <EntryModal key={editing.entry.id} entry={editing.entry} isNew={editing.isNew} onClose={() => setEditing(null)}
          onSave={e => void saveEntry(e)} onDelete={id => void deleteEntry(id)} />
      )}

      {editingTemplate && (
        <TemplateModal key={editingTemplate.template.id} template={editingTemplate.template} isNew={editingTemplate.isNew} onClose={() => setEditingTemplate(null)}
          onSave={tpl => void saveTemplate(tpl)} onDelete={id => void deleteTemplate(id)} />
      )}

      <Modal open={showTemplatePicker} title={t('journal.pickTemplate')} onClose={() => setShowTemplatePicker(false)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {templates.map(tpl => (
            <button key={tpl.id} type="button" onClick={() => startFromTemplate(tpl)} style={{
              padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)',
              color: 'var(--text)', textAlign: 'left', cursor: 'pointer',
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{tpl.name}</div>
              {tpl.title && <div style={{ fontSize: 12, color: 'var(--dim)' }}>{tpl.title}</div>}
            </button>
          ))}
        </div>
      </Modal>

      <Modal open={!!entryPwFor} title={t('journal.entryLocked')} onClose={() => setEntryPwFor(null)}
        footer={
          <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setEntryPwFor(null)}>{t('common.cancel')}</Btn>
            <Btn variant="solid" onClick={confirmEntryPw}>{t('journal.unlock')}</Btn>
          </div>
        }>
        <p style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 12 }}>{t('journal.unlockPasswordPrompt')}</p>
        <PasswordPrompt id={`${jid}-epw`} value={entryPw} onChange={v => { setEntryPw(v); setEntryPwError(false); }} error={entryPwError} onSubmit={confirmEntryPw} />
      </Modal>

      <SaveErrorDialog error={saveError} onClose={clearSaveError} />
    </div>
  );
}
