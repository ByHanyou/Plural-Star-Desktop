import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Btn, Dropdown, Modal, ConfirmDialog } from '../components/ui';
import { NoteboardEntry, Member, uid, fmtTime, getInitials } from '../utils';
import { store, KEYS } from '../storage';
import { NetworkManager } from '../network/NetworkManager';

interface Props { members: Member[]; }

export default function MailboxView({ members }: Props) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState<NoteboardEntry[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState<string>('');
  const [composeFrom, setComposeFrom] = useState<string>('');
  const [composeBody, setComposeBody] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<NoteboardEntry | null>(null);

  const activeMembers = useMemo(
    () => members.filter(m => !m.isCustomFront && !m.deleted).sort((a, b) => a.name.localeCompare(b.name)),
    [members],
  );
  const nameOf = (id: string) => members.find(m => m.id === id)?.name || '?';

  useEffect(() => { store.get<NoteboardEntry[]>(KEYS.noteboards, []).then(n => setNotes(n || [])); }, []);

  const save = async (updated: NoteboardEntry[]) => {
    setNotes(updated);
    await store.set(KEYS.noteboards, updated);
    NetworkManager.notifyDataChanged();
  };

  const openMailbox = (memberId: string) => {
    setOpenId(memberId);
    let changed = false;
    const updated = notes.map(n => {
      if (n.memberId === memberId && n.read !== true) { changed = true; return { ...n, read: true }; }
      return n;
    });
    if (changed) save(updated);
  };

  const sendMessage = async () => {
    if (!composeTo || !composeFrom || !composeBody.trim()) return;
    const entry: NoteboardEntry = {
      id: uid(),
      memberId: composeTo,
      authorId: composeFrom,
      content: composeBody.trim(),
      timestamp: Date.now(),
      read: false,
    };
    await save([entry, ...notes]);
    setShowCompose(false);
    setComposeBody('');
  };

  const startReply = (msg: NoteboardEntry) => {
    setComposeTo(msg.authorId);
    setComposeFrom(msg.memberId);
    setComposeBody('');
    setShowCompose(true);
  };

  const mailboxes = useMemo(() => {
    const byMember = new Map<string, { count: number; unread: number; latest: number }>();
    notes.forEach(n => {
      const cur = byMember.get(n.memberId) || { count: 0, unread: 0, latest: 0 };
      cur.count += 1;
      if (!n.read) cur.unread += 1;
      cur.latest = Math.max(cur.latest, n.timestamp);
      byMember.set(n.memberId, cur);
    });
    return [...byMember.entries()]
      .map(([id, v]) => ({ id, name: nameOf(id), ...v }))
      .sort((a, b) => b.unread - a.unread || b.latest - a.latest);
  }, [notes, members]);

  const openMessages = useMemo(
    () => openId
      ? notes.filter(n => n.memberId === openId).sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.timestamp - a.timestamp)
      : [],
    [notes, openId],
  );

  const memberOptions = activeMembers.map(m => m.id);
  const renderMemberOption = (id: string) => nameOf(id);

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', paddingBottom: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <Btn onClick={() => { setComposeTo(activeMembers[0]?.id || ''); setComposeFrom(activeMembers[1]?.id || activeMembers[0]?.id || ''); setComposeBody(''); setShowCompose(true); }}>
          {t('mailbox.compose')}
        </Btn>
      </div>

      {openId === null ? (
        mailboxes.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '32px 0' }}>{t('mailbox.empty')}</p>
        ) : (
          mailboxes.map(mb => (
            <div key={mb.id} role="button" tabIndex={0}
              onClick={() => openMailbox(mb.id)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openMailbox(mb.id); } }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8, cursor: 'pointer', background: 'var(--card)' }}>
              <div style={{ width: 34, height: 34, borderRadius: 17, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--accent)', flexShrink: 0 }} aria-hidden>
                {getInitials(mb.name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mb.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t('mailbox.messageCount', { count: mb.count })}</div>
              </div>
              {mb.unread > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: 'var(--accent)', borderRadius: 999, padding: '3px 9px' }}>
                  {t('mailbox.unreadCount', { count: mb.unread })}
                </span>
              )}
            </div>
          ))
        )
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Btn variant="ghost" onClick={() => setOpenId(null)}>←</Btn>
            <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text)' }}>{t('mailbox.inboxOf', { name: nameOf(openId) })}</h3>
          </div>
          {openMessages.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '32px 0' }}>{t('mailbox.emptyInbox')}</p>
          ) : (
            openMessages.map(msg => (
              <div key={msg.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', marginBottom: 8, background: 'var(--card)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                  {msg.pinned && <span aria-hidden>📌</span>}
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{t('mailbox.from')}: {nameOf(msg.authorId)}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>{fmtTime(msg.timestamp)}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                  <Btn variant="ghost" onClick={() => startReply(msg)}>{t('mailbox.replyFrom', { name: nameOf(msg.authorId) })}</Btn>
                  <button
                    className="btn btn--danger"
                    aria-label={`${t('mailbox.deleteTitle')} — ${nameOf(msg.authorId)}`}
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
            <Btn onClick={sendMessage} disabled={!composeTo || !composeFrom || !composeBody.trim()}>{t('mailbox.send')}</Btn>
          </div>
        }>
        <Dropdown value={composeTo} options={memberOptions} onChange={setComposeTo} label={t('mailbox.to')} renderOption={renderMemberOption} />
        <Dropdown value={composeFrom} options={memberOptions} onChange={setComposeFrom} label={t('mailbox.from')} renderOption={renderMemberOption} />
        <label style={{ display: 'block', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '10px 0 4px' }}>
          {t('mailbox.title')}
          <textarea
            value={composeBody}
            onChange={e => setComposeBody(e.target.value)}
            placeholder={t('mailbox.messagePlaceholder')}
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
        onConfirm={() => { const m = deleteTarget!; setDeleteTarget(null); save(notes.filter(n => n.id !== m.id)); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
