import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatMessage, uid, toggleReaction } from '../utils';
import { mirrorThumbDataUrl } from '../utils/image';
import { pickBrowserFile } from '../utils/filePick';
import { ConfirmDialog, EmptyState, SaveErrorDialog } from '../components/ui';
import { useSaveGuard } from '../hooks/useSaveGuard';
import { useAppStore } from '../store/appStore';
import { MessageRow } from './chat/MessageRow';
import { Composer } from './chat/Composer';
import { ChannelSidebar } from './chat/ChannelSidebar';
import { SpeakerPicker } from './chat/SpeakerPicker';
import { ChannelDialogs } from './chat/ChannelDialogs';
import type { ChannelDialog } from './chat/ChannelDialogs';
import { setChannelArchived } from './chat/channels';
import { useChannelMessages } from './chat/useChannelMessages';

const readImageContent = async (file: File): Promise<string> => {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsDataURL(file);
  });
  const keepRaw = (file.type === 'image/gif' || file.type === 'image/png') && file.size <= 2 * 1024 * 1024;
  return keepRaw ? dataUrl : (await mirrorThumbDataUrl(dataUrl, 1280, 0.8)) || dataUrl;
};

export default function ChatView() {
  const { t } = useTranslation();
  const members = useAppStore(s => s.members);
  const channels = useAppStore(s => s.channels);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(channels.find(c => !c.archived)?.id || null);
  const [activeMemberId, setActiveMemberId] = useState<string | null>(members.find(m => !m.archived && !m.deleted && !m.isCustomFront)?.id || null);
  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [showEmojiFor, setShowEmojiFor] = useState<string | null>(null);
  const [confirmDeleteMsg, setConfirmDeleteMsg] = useState<ChatMessage | null>(null);
  const [dialog, setDialog] = useState<ChannelDialog | null>(null);
  const msgEndRef = useRef<HTMLDivElement>(null);
  const { messages, loadedChannelId, update } = useChannelMessages(activeChannelId);
  const [saveError, run, clearSaveError] = useSaveGuard();

  const activeChannel = channels.find(c => c.id === activeChannelId);
  const activeMember = members.find(m => m.id === activeMemberId);
  const getMember = (id: string) => members.find(m => m.id === id);
  const firstOpenChannelId = (except?: string) => channels.find(c => !c.archived && c.id !== except)?.id || null;

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || !activeChannelId || !activeMemberId) return;
    const msg: ChatMessage = {
      id: uid(), channelId: activeChannelId, authorId: activeMemberId,
      type: replyTo ? 'reply' : 'text', content, replyToId: replyTo?.id, timestamp: Date.now(),
    };
    if (!(await run(() => update(current => [...current, msg])))) return;
    setInput('');
    setReplyTo(null);
  };

  const startEditMessage = (msg: ChatMessage) => {
    if (msg.type !== 'text' && msg.type !== 'reply') return;
    setEditingMessageId(msg.id);
    setInput(msg.content);
    setReplyTo(null);
  };

  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setInput('');
  };

  const switchChannel = (id: string | null) => {
    if (id !== activeChannelId) {
      if (editingMessageId) cancelEditMessage();
      setReplyTo(null);
      setShowEmojiFor(null);
    }
    setActiveChannelId(id);
  };

  useEffect(() => {
    if (activeChannelId && !channels.some(c => c.id === activeChannelId)) switchChannel(firstOpenChannelId());
  });

  const saveEditedMessage = async () => {
    if (!editingMessageId) return;
    const content = input.trim();
    if (content && !(await run(() => update(current => current.map(m => (m.id === editingMessageId ? { ...m, content } : m)))))) return;
    cancelEditMessage();
  };

  const deleteMessage = async (msg: ChatMessage) => {
    setConfirmDeleteMsg(null);
    if (!(await run(() => update(current => current.filter(m => m.id !== msg.id))))) return;
    if (editingMessageId === msg.id) cancelEditMessage();
    if (replyTo?.id === msg.id) setReplyTo(null);
    if (showEmojiFor === msg.id) setShowEmojiFor(null);
  };

  const postImage = (file: File) => {
    if (!activeChannelId || !activeMemberId) return;
    void run(async () => {
      const content = await readImageContent(file);
      const msg: ChatMessage = { id: uid(), channelId: activeChannelId, authorId: activeMemberId, type: 'image', content, timestamp: Date.now() };
      await update(current => [...current, msg]);
    });
  };

  const pickImage = () => {
    if (!activeChannelId || !activeMemberId) return;
    pickBrowserFile('image/*', postImage);
  };

  const react = async (msgId: string, emoji: string) => {
    if (!activeMemberId) return;
    await run(() => update(current => current.map(m => (m.id === msgId ? toggleReaction(m, emoji, activeMemberId) : m))));
    setShowEmojiFor(null);
  };

  const toggleArchived = async () => {
    if (!activeChannel) return;
    if (!(await run(() => setChannelArchived(activeChannel.id, !activeChannel.archived)))) return;
    if (!activeChannel.archived) switchChannel(firstOpenChannelId(activeChannel.id));
  };

  return (
    <div style={{ display: 'flex', height: '100%', gap: 0 }}>
      <ChannelSidebar activeChannelId={activeChannelId} onSelect={switchChannel}
        onEditChannel={channel => setDialog({ kind: 'editChannel', channel })}
        onNewChannel={() => setDialog({ kind: 'newChannel' })} onNewCategory={() => setDialog({ kind: 'newCategory' })}
        onEditCategory={category => setDialog({ kind: 'editCategory', category })}
        onDeleteCategory={category => setDialog({ kind: 'deleteCategory', category })}>
        <SpeakerPicker speaker={activeMember} onChange={setActiveMemberId} />
      </ChannelSidebar>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {activeChannel && (
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}># {activeChannel.name}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="btn btn--ghost" style={{ padding: '3px 8px', fontSize: 11 }}
                onClick={() => setDialog({ kind: 'editChannel', channel: activeChannel })}>
                {t('common.edit')}
              </button>
              <button type="button" className="btn btn--ghost" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => void toggleArchived()}>
                {activeChannel.archived ? t('chat.unarchive') : t('chat.archiveChannel')}
              </button>
            </div>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          <div key={(activeChannelId && loadedChannelId) || 'none'} role="log" aria-live="polite" aria-label={t('chat.messagesIn', { name: activeChannel?.name || '' })}>
            {!activeChannelId ? (
              <EmptyState>{t('common.selectChannel')}</EmptyState>
            ) : messages.length === 0 ? (
              <EmptyState>{t('chat.noMessages')}</EmptyState>
            ) : (
              messages.map(msg => {
                const replyMsg = msg.replyToId ? messages.find(m => m.id === msg.replyToId) : undefined;
                return (
                  <MessageRow key={msg.id} msg={msg} author={getMember(msg.authorId)} replyMsg={replyMsg}
                    replyAuthor={replyMsg ? getMember(replyMsg.authorId) : undefined} members={members} activeMemberId={activeMemberId}
                    editing={editingMessageId === msg.id} emojiOpen={showEmojiFor === msg.id}
                    onReply={() => setReplyTo(msg)} onEdit={() => startEditMessage(msg)}
                    onToggleEmoji={() => setShowEmojiFor(showEmojiFor === msg.id ? null : msg.id)}
                    onDelete={() => setConfirmDeleteMsg(msg)} onReact={emoji => void react(msg.id, emoji)} />
                );
              })
            )}
          </div>
          <div ref={msgEndRef} />
        </div>

        {activeChannel && !activeChannel.archived && (
          <Composer channelName={activeChannel.name} input={input} setInput={setInput}
            replyAuthor={replyTo ? getMember(replyTo.authorId) : undefined} replying={!!replyTo} editing={!!editingMessageId}
            canAttach={!!activeMemberId} onCancelReply={() => setReplyTo(null)} onCancelEdit={cancelEditMessage}
            onSubmit={() => { void (editingMessageId ? saveEditedMessage() : sendMessage()); }}
            onAttach={pickImage} onPasteImage={postImage} />
        )}
      </div>

      <ChannelDialogs dialog={dialog} onChange={setDialog} onCreated={channel => switchChannel(channel.id)} />

      <ConfirmDialog open={!!confirmDeleteMsg} title={t('chat.deleteMsg')} message={t('chat.deleteMsgConfirm')} danger
        onConfirm={() => { if (confirmDeleteMsg) void deleteMessage(confirmDeleteMsg); }}
        onCancel={() => setConfirmDeleteMsg(null)} />
      <SaveErrorDialog error={saveError} onClose={clearSaveError} />
    </div>
  );
}
