import { useTranslation } from 'react-i18next';
import { NoteboardEntry, fmtTime } from '../../utils';
import { Btn, EmptyState, SaveErrorDialog, linkButton, SrOnly } from '../../components/ui';
import { MemberAvatar } from '../../components/MemberAvatar';
import { MemberGroupSelect } from '../../components/MemberGroupSelect';
import { memberFacetPools } from '../../picker/memberPicker';
import { useAppStore } from '../../store/appStore';
import { saveData } from '../../store/actions';
import { useSaveGuard } from '../../hooks/useSaveGuard';
import { composeMail, inboxMessages, removeNote, toggleNotePinned } from '../../mailbox/mailbox';

export function Noteboard({ memberId, text, onText, authorId, onAuthor }: {
  memberId: string; text: string; onText: (v: string) => void; authorId: string | null; onAuthor: (id: string) => void;
}) {
  const { t } = useTranslation();
  const members = useAppStore(s => s.members);
  const allNotes = useAppStore(s => s.noteboards);
  const [saveError, run, clearSaveError] = useSaveGuard();
  const memberNotes = inboxMessages(allNotes, memberId);

  const saveNotes = (updated: NoteboardEntry[]) => run(() => saveData('noteboards', updated));

  const addNote = async () => {
    if (!text.trim() || !authorId) return;
    if (await saveNotes([...allNotes, ...composeMail([memberId], authorId, text.trim())])) onText('');
  };

  return (
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
                  <MemberAvatar member={author || { name: '?', color: 'var(--muted)' }} size={22} fontSize={9} decorative />
                  <span style={{ fontSize: 12, color: author?.color || 'var(--dim)', fontWeight: 500 }}>{author?.name || '?'}</span>
                  {note.pinned && <SrOnly>{t('noteboard.pinned')}</SrOnly>}
                  <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 'auto' }}>{fmtTime(note.timestamp)}</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{note.content}</p>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <button type="button" style={linkButton(note.pinned ? 'var(--accent)' : 'var(--dim)')}
                    onClick={() => void saveNotes(toggleNotePinned(allNotes, note.id))}>{note.pinned ? <><span aria-hidden>📌 </span>{t('noteboard.unpin')}</> : t('noteboard.pin')}</button>
                  <button type="button" style={linkButton('var(--danger)')}
                    onClick={() => void saveNotes(removeNote(allNotes, note.id))}>{t('noteboard.deleteNote')}</button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState padding={32}>{t('noteboard.noNotes')}</EmptyState>
      )}

      <div style={{ padding: 12, background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--dim)' }}>{t('noteboard.writingAs')}</span>
          <MemberGroupSelect label={t('noteboard.writingAs')} value={authorId || ''} onChange={onAuthor} pools={memberFacetPools(members, t)}
            style={{ background: 'var(--bg)', padding: '5px 10px' }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <textarea className="field__input field__input--multi" value={text} onChange={e => onText(e.target.value)}
            aria-label={t('noteboard.placeholder')} placeholder={t('noteboard.placeholder')} style={{ flex: 1, minHeight: 48, fontSize: 13 }}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void addNote(); }} />
          <Btn variant="solid" onClick={() => void addNote()}>{t('common.add')}</Btn>
        </div>
      </div>
      <SaveErrorDialog error={saveError} onClose={clearSaveError} />
    </div>
  );
}
