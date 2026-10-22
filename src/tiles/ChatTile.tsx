import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatMessage, truncateRunes } from '../utils';
import { store, chatMsgKey } from '../storage';
import { useAppStore } from '../store/appStore';
import { Tile } from '../components/Tile';
import { logError } from '../utils/log';

interface Props { onClick: () => void; }

type LastMessage = { msg: ChatMessage; channel: string };

export default function ChatTile({ onClick }: Props) {
  const { t } = useTranslation();
  const channels = useAppStore(s => s.channels);
  const members = useAppStore(s => s.members);
  const [lastMsg, setLastMsg] = useState<LastMessage | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      let latest: LastMessage | null = null;
      for (const ch of channels.filter(c => !c.archived)) {
        const msgs = await store.get<ChatMessage[]>(chatMsgKey(ch.id), []);
        const last = msgs?.[msgs.length - 1];
        if (last && (!latest || last.timestamp > latest.msg.timestamp)) latest = { msg: last, channel: ch.name };
      }
      if (alive) setLastMsg(latest);
    })().catch(e => logError('chat', e));
    return () => { alive = false; };
  }, [channels]);
  const activeCount = channels.filter(c => !c.archived).length;
  const author = lastMsg ? members.find(m => m.id === lastMsg.msg.authorId) : undefined;
  return (
    <Tile glyph="⌨" title={t('hub.systemChat')} onClick={onClick}>
      {!lastMsg ? <span className="tile__empty">{t('chat.noMessages')}</span> : (<>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>#{lastMsg.channel}</span>
        <div className="tile__chat-author">{author?.name || t('common.unknown')}</div>
        <div className="tile__chat-msg">{lastMsg.msg.type === 'text' ? truncateRunes(lastMsg.msg.content, 120, '...') : <span role="img" aria-label={t('chat.attachment')}>📎</span>}</div>
      </>)}
      <div style={{ marginTop: 'auto', paddingTop: 8, fontSize: 11, color: 'var(--muted)' }}>{t('chat.channelCount', { count: activeCount })}</div>
    </Tile>
  );
}
