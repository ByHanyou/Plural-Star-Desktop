import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { JournalEntry, fmtTime, membersByIds, toggleId } from '../../utils';
import { Btn, EditFooter, Field, Section, Modal, ConfirmDialog } from '../../components/ui';
import { MemberSelect } from '../../components/MemberSelect';
import { memberFacetPools } from '../../picker/memberPicker';
import { MarkdownText } from '../../components/MarkdownText';
import { TagEditor } from '../../components/TagEditor';
import { useAppStore } from '../../store/appStore';
import { MemberPill } from '../../components/MemberChip';

export function EntryModal({ entry, isNew, onClose, onSave, onDelete }: {
  entry: JournalEntry;
  isNew: boolean;
  onClose: () => void;
  onSave: (entry: JournalEntry) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const members = useAppStore(s => s.members);
  const [viewMode, setViewMode] = useState(!isNew);
  const [title, setTitle] = useState(entry.title);
  const [body, setBody] = useState(entry.body);
  const [hashtags, setHashtags] = useState<string[]>(entry.hashtags || []);
  const [authorIds, setAuthorIds] = useState<string[]>(entry.authorIds || []);
  const [password, setPassword] = useState(entry.password || '');
  const [authorSearch, setAuthorSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = () => {
    if (!title.trim()) return;
    onSave({ ...entry, title: title.trim(), body, authorIds, hashtags, password: password || undefined });
  };

  return (
    <>
      <Modal open title={viewMode ? t('modal.viewEntry') : isNew ? t('modal.newEntry') : t('modal.editEntry')} onClose={onClose}
        footer={viewMode ? (
          <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'flex-end' }}>
            <Btn variant="solid" onClick={() => setViewMode(false)}>{t('common.edit')}</Btn>
          </div>
        ) : (
          <EditFooter onDelete={isNew ? undefined : () => setConfirmDelete(true)} onCancel={onClose} onSave={save} saveDisabled={!title.trim()} />
        )}>
        {viewMode ? (<>
          <div style={{ fontSize: 20, fontWeight: 600, fontStyle: 'italic', color: 'var(--text)', marginBottom: 4 }}>
            {title || t('common.untitled')}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 14 }}>{fmtTime(entry.timestamp)}</div>
          {body && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 14 }}>
              <MarkdownText text={body} members={members} />
            </div>
          )}
          {hashtags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {hashtags.map(tag => (
                <span key={tag} style={{ fontSize: 12, color: 'var(--info)', background: 'var(--info-bg)', padding: '4px 9px', borderRadius: 999, border: '1px solid var(--border)' }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
          {authorIds.length > 0 && (<>
            <Section label={t('modal.authors')} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {membersByIds(authorIds, id => members.find(x => x.id === id)).map(m => <MemberPill key={m.id} member={m} />)}
            </div>
          </>)}
        </>) : (<>
          <Field label={t('modal.entryTitle')} value={title} onChange={setTitle} placeholder={t('modal.entryTitlePlaceholder')} />
          <Field label={t('modal.body')} value={body} onChange={setBody} placeholder={t('modal.writeHere')} multiline pictureTools />
          <Field label={t('modal.entryPassword')} value={password} onChange={setPassword} placeholder={t('modal.entryPasswordPlaceholder')} type="password" />
          <Section label={t('modal.authors')} />
          <MemberSelect pools={memberFacetPools(members, t)} selected={authorIds} onPick={m => setAuthorIds(ids => toggleId(ids, m.id))} multi variant="chips" maxResults={24}
            search={authorSearch} onSearch={setAuthorSearch} searchLabel={t('members.search')} clearOnPick={false} />
          <Section label={t('modal.tags')} />
          <TagEditor tags={hashtags} onChange={setHashtags} placeholder={t('modal.topic')} />
        </>)}
      </Modal>
      <ConfirmDialog open={confirmDelete} title={t('journal.deleteEntry')} message={t('journal.areYouSure')}
        danger onConfirm={() => { setConfirmDelete(false); onDelete(entry.id); }} onCancel={() => setConfirmDelete(false)} />
    </>
  );
}
