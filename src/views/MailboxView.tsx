import { useState, useMemo, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Btn, Dropdown, Modal, ConfirmDialog, SrOnly, SaveErrorDialog, clickable } from '../components/ui';
import { NoteboardEntry, fmtTime, getInitials, nameCompare, isRosterMember, isFacetMember } from '../utils';
import { saveData, saveMember } from '../store/actions';
import { useAppStore } from '../store/appStore';
import { useSaveGuard } from '../hooks/useSaveGuard';
import { ALL_RECIPIENTS, composeMail, inboxMessages, inboxSummaries, mailRecipients, markInboxRead, removeNote } from '../mailbox/mailbox';

const EMPTY_MSG = { fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '32px 0' } as const;
const PW_INPUT = { display: 'block', width: '100%', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, fontSize: 13 } as const;

export default function MailboxView() {
  const { t } = useTranslation();
  const members = useAppStore(s => s.members);
  const notes = useAppStore(s => s.noteboards);
  const [openId, setOpenId] = useState<string | null>(null);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [pwFor, setPwFor] = useState<string | null>(null);
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState(false);
  const [lockManage, setLockManage] = useState(false);
  const [lockInput, setLockInput] = useState('');
  const [confirmUnlockRemove, setConfirmUnlockRemove] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState<string>('');
  const [composeFrom, setComposeFrom] = useState<string>('');
  const [composeBody, setComposeBody] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<NoteboardEntry | null>(null);

  const activeMembers = useMemo(
    () => members.filter(m => isRosterMember(m) && !m.archived).sort((a, b) => nameCompare(a.name, b.name)),
    [members],
  );
  const activeFacets = useMemo(
    () => members.filter(m => isFacetMember(m) && !m.archived).sort((a, b) => nameCompare(a.name, b.name)),
    [members],
  );
  const byId = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);
  const nameOf = (id: string) => byId.get(id)?.name || '?';
  const isLockedBox = (id: string) => !!byId.get(id)?.mailboxPassword;
  const [saveError, run, clearSaveError] = useSaveGuard();
  const save = (updated: NoteboardEntry[]) => run(() => saveData('noteboards', updated));

  const reallyOpen = (memberId: string) => {
    setOpenId(memberId);
    const updated = markInboxRead(notes, memberId);
    if (updated) void save(updated);
  };

  const closePw = () => {
    setPwFor(null);
    setPwInput('');
    setPwError(false);
  };

  const openMailbox = (memberId: string) => {
    if (isLockedBox(memberId) && !unlockedIds.has(memberId)) {
      setPwInput('');
      setPwError(false);
      setPwFor(memberId);
      return;
    }
    reallyOpen(memberId);
  };

  const submitUnlock = () => {
    if (!pwFor) return;
    if (pwInput === (byId.get(pwFor)?.mailboxPassword || '')) {
      setUnlockedIds(prev => new Set(prev).add(pwFor));
      reallyOpen(pwFor);
      closePw();
    } else {
      setPwError(true);
    }
  };

  const setMailboxPassword = (memberId: string, password?: string): Promise<boolean> => {
    const owner = byId.get(memberId);
    return owner ? run(() => saveMember({ ...owner, mailboxPassword: password })) : Promise.resolve(false);
  };

  const closeLock = () => {
    setLockManage(false);
    setLockInput('');
  };

  const submitLock = async () => {
    if (!openId) return;
    const next = lockInput.trim();
    if (!next && isLockedBox(openId)) {
      setConfirmUnlockRemove(true);
      return;
    }
    if (next) {
      if (!(await setMailboxPassword(openId, next))) return;
      setUnlockedIds(prev => new Set(prev).add(openId));
    }
    closeLock();
  };

  const sendMessage = async () => {
    if (!composeTo || !composeFrom || !composeBody.trim()) return;
    const targets = mailRecipients(composeTo, composeFrom, activeMembers);
    if (targets.length === 0) return;
    if (!(await save([...composeMail(targets, composeFrom, composeBody.trim()), ...notes]))) return;
    setShowCompose(false);
    setComposeBody('');
  };

  const openCompose = (to: string, from: string) => {
    setComposeTo(to);
    setComposeFrom(from);
    setComposeBody('');
    setShowCompose(true);
  };

  const startReply = (msg: NoteboardEntry) => openCompose(msg.authorId, msg.memberId);

  const mailboxes = useMemo(() => inboxSummaries(notes)
    .flatMap(s => {
      const owner = byId.get(s.id);
      return owner && !owner.deleted ? [{ ...s, name: owner.name || '?', locked: !!owner.mailboxPassword }] : [];
    })
    .sort((a, b) => b.unread - a.unread || b.latest - a.latest), [notes, byId]);

  const openMessages = useMemo(() => (openId ? inboxMessages(notes, openId) : []), [notes, openId]);

  const memberOptions = [...activeMembers.map(m => m.id), ...activeFacets.map(m => m.id)];
  const recipientOptions = activeMembers.length > 0 ? [ALL_RECIPIENTS, ...memberOptions] : memberOptions;
  const renderMemberOption = (id: string) => nameOf(id);
  const renderRecipientOption = (id: string) =>
    id === ALL_RECIPIENTS
      ? t('mailbox.allOthersCount', { count: activeMembers.filter(m => m.id !== composeFrom).length })
      : nameOf(id);
  const pwErrorId = useId();

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', paddingBottom: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <Btn onClick={() => openCompose(activeMembers[0]?.id || '', activeMembers[1]?.id || activeMembers[0]?.id || '')}>
          {t('mailbox.compose')}
        </Btn>
      </div>

      {openId === null ? (
        mailboxes.length === 0 ? (
          <p style={EMPTY_MSG}>{t('mailbox.empty')}</p>
        ) : (
          mailboxes.map(mb => (
            <div key={mb.id} {...clickable(() => openMailbox(mb.id))}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8, cursor: 'pointer', background: 'var(--card)' }}>
              <div style={{ width: 34, height: 34, borderRadius: 17, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--accent)', flexShrink: 0 }} aria-hidden>
                {getInitials(mb.name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {mb.name}{mb.locked ? <><span aria-hidden> 🔒</span><SrOnly>{t('mailbox.lockedLabel')}</SrOnly></> : ''}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t('mailbox.messageCount', { count: mb.count })}</div>
              </div>
              {mb.unread > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--bg)', background: 'var(--accent)', borderRadius: 999, padding: '3px 9px' }}>
                  {t('mailbox.unreadCount', { count: mb.unread })}
                </span>
              )}
            </div>
          ))
        )
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Btn variant="ghost" aria-label={t('common.back')} onClick={() => setOpenId(null)}>←</Btn>
            <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text)', flex: 1 }}>{t('mailbox.inboxOf', { name: nameOf(openId) })}</h3>
            <Btn variant="ghost" aria-label={isLockedBox(openId) ? t('mailbox.lockButtonLocked') : t('mailbox.lockButtonUnlocked')} aria-haspopup="dialog" onClick={() => { setLockInput(''); setLockManage(true); }}>
              {isLockedBox(openId) ? '🔒' : '🔓'}
            </Btn>
          </div>
          {openMessages.length === 0 ? (
            <p style={EMPTY_MSG}>{t('mailbox.emptyInbox')}</p>
          ) : (
            openMessages.map(msg => (
              <div key={msg.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', marginBottom: 8, background: 'var(--card)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                  {msg.pinned && <><span aria-hidden>📌</span><SrOnly>{t('noteboard.pinned')}</SrOnly></>}
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{t('mailbox.fromName', { name: nameOf(msg.authorId) })}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>{fmtTime(msg.timestamp)}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                  <Btn variant="ghost" onClick={() => startReply(msg)}>{t('mailbox.replyFrom', { name: nameOf(msg.authorId) })}</Btn>
                  <button
                    className="btn btn--danger"
                    aria-label={t('mailbox.deleteFrom', { name: nameOf(msg.authorId) })}
                    onClick={() => setDeleteTarget(msg)}>
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </>
      )}

      <Modal
        open={showCompose}
        title={t('mailbox.compose')}
        onClose={() => setShowCompose(false)}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setShowCompose(false)}>{t('common.cancel')}</Btn>
            <Btn onClick={() => void sendMessage()} disabled={!composeTo || !composeFrom || !composeBody.trim()}>{t('mailbox.send')}</Btn>
          </div>
        }>
        <Dropdown value={composeTo} options={recipientOptions} onChange={setComposeTo} label={t('mailbox.to')} renderOption={renderRecipientOption} />
        <Dropdown value={composeFrom} options={memberOptions} onChange={setComposeFrom} label={t('mailbox.from')} renderOption={renderMemberOption} />
        <label style={{ display: 'block', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '10px 0 4px' }}>
          {t('mailbox.title')}
          <textarea
            value={composeBody}
            onChange={e => setComposeBody(e.target.value)}
            aria-label={t('mailbox.messagePlaceholder')} placeholder={t('mailbox.messagePlaceholder')}
            rows={5}
            style={{ display: 'block', width: '100%', marginTop: 6, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
          />
        </label>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title={t('mailbox.deleteTitle')}
        message={t('mailbox.deleteMsg')}
        danger
        onConfirm={() => { if (deleteTarget) void save(removeNote(notes, deleteTarget.id)); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />

      <Modal
        open={!!pwFor}
        title={t('mailbox.unlockTitle', { name: nameOf(pwFor || '') })}
        onClose={closePw}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={closePw}>{t('common.cancel')}</Btn>
            <Btn onClick={submitUnlock}>{t('journal.unlock')}</Btn>
          </div>
        }>
        <p style={{ fontSize: 13, color: 'var(--dim)', marginTop: 0 }}>{t('mailbox.lockedPrompt')}</p>
        <input
          type="password"
          value={pwInput}
          onChange={e => { setPwInput(e.target.value); setPwError(false); }}
          onKeyDown={e => { if (e.key === 'Enter') submitUnlock(); }}
          placeholder={t('journal.password')}
          aria-label={t('journal.password')}
          aria-invalid={pwError} aria-describedby={pwError ? pwErrorId : undefined}
          style={pwError ? { ...PW_INPUT, borderColor: 'var(--danger)' } : PW_INPUT}
        />
        {pwError && <p role="alert" id={pwErrorId} style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 0 }}>{t('journal.incorrectPassword')}</p>}
      </Modal>

      <Modal
        open={lockManage}
        title={t('mailbox.lockTitle')}
        onClose={closeLock}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={closeLock}>{t('common.cancel')}</Btn>
            <Btn onClick={() => void submitLock()}>{t('common.save')}</Btn>
          </div>
        }>
        <p style={{ fontSize: 13, color: 'var(--dim)', marginTop: 0 }}>{t('mailbox.lockHint')}</p>
        <input
          type="password"
          value={lockInput}
          onChange={e => setLockInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void submitLock(); }}
          placeholder={t('journal.password')}
          aria-label={t('journal.password')}
          style={PW_INPUT}
        />
      </Modal>

      <ConfirmDialog
        open={confirmUnlockRemove}
        title={t('mailbox.lockTitle')}
        message={t('mailbox.removeLockMsg')}
        danger
        onConfirm={() => {
          setConfirmUnlockRemove(false);
          if (openId) void setMailboxPassword(openId, undefined).then(ok => { if (ok) closeLock(); });
        }}
        onCancel={() => setConfirmUnlockRemove(false)}
      />
      <SaveErrorDialog error={saveError} onClose={clearSaveError} />
    </div>
  );
}
