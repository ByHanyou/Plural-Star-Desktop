import { useTranslation } from 'react-i18next';
import { ChatMessage, Member, fmtTime, truncateRunes } from '../../utils';
import { Interp, linkButton, slots } from '../../components/ui';
import { MarkdownText } from '../../components/MarkdownText';
import { MemberAvatar } from '../../components/MemberAvatar';
import { CLOUD_MEDIA_MARK } from '../../cloud/cloudKeys';

export const EMOJI_QUICK = ['👍', '❤️', '😂', '😢', '😮', '🎉', '✨', '🔥'];

const UNKNOWN_AUTHOR = { name: '?', color: '#888888' };

export function MessageRow({ msg, author, replyMsg, replyAuthor, members, activeMemberId, editing, emojiOpen, onReply, onEdit, onToggleEmoji, onDelete, onReact }: {
  msg: ChatMessage;
  author?: Member;
  replyMsg?: ChatMessage;
  replyAuthor?: Member;
  members: Member[];
  activeMemberId: string | null;
  editing: boolean;
  emojiOpen: boolean;
  onReply: () => void;
  onEdit: () => void;
  onToggleEmoji: () => void;
  onDelete: () => void;
  onReact: (emoji: string) => void;
}) {
  const { t } = useTranslation();
  const authorName = author?.name || t('common.unknown');
  const editable = msg.type === 'text' || msg.type === 'reply';
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
      <MemberAvatar member={author || UNKNOWN_AUTHOR} size={32} fontSize={12} decorative
        style={{ flexShrink: 0, marginTop: 2, ...(author ? {} : { backgroundColor: 'var(--muted)' }) }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: author?.color || 'var(--text)' }}>{authorName}</span>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>{fmtTime(msg.timestamp)}</span>
        </div>

        {replyMsg && (
          <div style={{ fontSize: 11, color: 'var(--muted)', borderLeft: `2px solid ${replyAuthor?.color || 'var(--border)'}`, paddingLeft: 8, marginBottom: 4, marginTop: 2 }}>
            <Interp text={t('chat.replyQuote', slots('name', 'text'))} nodes={{
              name: <span style={{ color: replyAuthor?.color || 'var(--dim)' }}>{replyAuthor?.name}</span>,
              text: replyMsg.type === 'text' ? truncateRunes(replyMsg.content, 80, '...') : <span role="img" aria-label={t('chat.attachment')}>📎</span>,
            }} />
          </div>
        )}

        {msg.type === 'image' ? (
          msg.content && msg.content !== CLOUD_MEDIA_MARK
            ? <img src={msg.content} alt={t('chat.imageFrom', { name: authorName })} style={{ maxWidth: 300, maxHeight: 300, borderRadius: 8, marginTop: 4 }} />
            : <p style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', margin: '4px 0 0' }}>{t('markdown.imageUnavailable')}</p>
        ) : (
          <MarkdownText text={msg.content} members={members} />
        )}

        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
            {Object.entries(msg.reactions).map(([emoji, userIds]) => {
              const mine = !!activeMemberId && userIds.includes(activeMemberId);
              return (
                <button key={emoji} aria-label={t('chat.reactionCount', { emoji, count: userIds.length })} aria-pressed={mine} style={{
                  padding: '2px 6px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
                  background: mine ? 'var(--accent-bg)' : 'var(--surface)',
                  border: `1px solid ${mine ? 'var(--accent)' : 'var(--border)'}`,
                }} onClick={() => onReact(emoji)}>
                  {emoji} {userIds.length}
                </button>
              );
            })}
          </div>
        )}

        <div className="chat-msg__actions">
          <button style={linkButton('var(--dim)')} onClick={onReply}><span aria-hidden>↩ </span>{t('chat.reply')}</button>
          {editable && (
            <button style={linkButton(editing ? 'var(--accent)' : 'var(--dim)')} onClick={onEdit}><span aria-hidden>✎ </span>{t('common.edit')}</button>
          )}
          <button aria-label={t('chat.addReaction')} style={linkButton('var(--dim)')} onClick={onToggleEmoji}>😊</button>
          <button aria-label={t('chat.deleteMsg')} style={linkButton('var(--danger)')} onClick={onDelete}><span aria-hidden>✕ </span>{t('common.delete')}</button>
        </div>

        {emojiOpen && (
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            {EMOJI_QUICK.map(e => (
              <button key={e} type="button" aria-label={e} style={{ fontSize: 16, background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                onClick={() => onReact(e)}>{e}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
