import { useState } from 'react';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { DndContext, closestCenter } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ChatChannel, ChatCategory, sortChatCategories, chatChannelsIn } from '../../utils';
import { useAppStore } from '../../store/appStore';
import { SaveErrorDialog, clickable, linkButton, useDndA11y } from '../../components/ui';
import { useSaveGuard } from '../../hooks/useSaveGuard';
import SortableCard, { ReorderLockButton, useSortSensors } from '../../components/SortableCard';
import { reorderChat, updateCategory } from './channels';

const caps: React.CSSProperties = { textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 };

export function ChannelSidebar({ activeChannelId, onSelect, onEditChannel, onNewChannel, onNewCategory, onEditCategory, onDeleteCategory, children }: {
  activeChannelId: string | null;
  onSelect: (id: string) => void;
  onEditChannel: (channel: ChatChannel) => void;
  onNewChannel: () => void;
  onNewCategory: () => void;
  onEditCategory: (category: ChatCategory) => void;
  onDeleteCategory: (category: ChatCategory) => void;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [saveError, run, clearSaveError] = useSaveGuard();
  const channels = useAppStore(s => s.channels);
  const categories = useAppStore(s => s.chatCategories);
  const [reorderLocked, setReorderLocked] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const sensors = useSortSensors();
  const dndA11y = useDndA11y(id => channels.find(c => c.id === id)?.name || categories.find(c => c.id === id)?.name || '');
  const openChannels = channels.filter(c => !c.archived);
  const archivedChannels = channels.filter(c => c.archived);
  const sortedCategories = sortChatCategories(categories);
  const uncategorized = chatChannelsIn(openChannels, null, categories);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) void run(() => reorderChat(String(active.id), String(over.id)));
  };

  const channelRow = (ch: ChatChannel) => {
    const active = activeChannelId === ch.id;
    return (
      <SortableCard key={ch.id} id={ch.id} label={ch.name} disabled={reorderLocked}>
        <div style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', cursor: 'pointer',
          background: active ? 'var(--accent-bg)' : 'transparent',
          borderLeft: `3px solid ${active ? 'var(--accent)' : 'transparent'}`,
        }} aria-current={active ? 'true' : undefined} {...clickable(() => onSelect(ch.id), ch.name)}
          onContextMenu={e => { e.preventDefault(); onEditChannel(ch); }}>
          <span style={{ color: active ? 'var(--accent)' : 'var(--dim)', fontSize: 13, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            # {ch.name}
          </span>
        </div>
      </SortableCard>
    );
  };

  const categoryBlock = (cat: ChatCategory) => {
    const list = chatChannelsIn(openChannels, cat.id, categories);
    return (
      <SortableCard key={cat.id} id={cat.id} label={cat.name} disabled={reorderLocked}>
        <div style={{ flex: 1, minWidth: 0, borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '2px 8px 2px 12px' }}>
            <button type="button" onClick={() => void run(() => updateCategory(cat.id, { collapsed: !cat.collapsed }))} aria-expanded={!cat.collapsed}
              aria-label={t('chat.categoryWithCount', { name: cat.name, count: list.length })}
              style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', textAlign: 'left' }}>
              <span aria-hidden style={{ fontSize: 9, color: 'var(--dim)' }}>{cat.collapsed ? '▶' : '▼'}</span>
              <span style={{ ...caps, flex: 1, minWidth: 0, fontSize: 10, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</span>
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>{list.length}</span>
            </button>
            <button type="button" aria-label={t('common.editNamed', { name: cat.name })} title={t('common.edit')}
              style={{ ...linkButton('var(--dim)'), padding: 2 }} onClick={() => onEditCategory(cat)}>✎</button>
            <button type="button" aria-label={t('common.deleteNamed', { name: cat.name })} title={t('common.delete')}
              style={{ ...linkButton('var(--danger)'), padding: 2 }} onClick={() => onDeleteCategory(cat)}>✕</button>
          </div>
          {!cat.collapsed && (
            <>
              <SortableContext items={list.map(c => c.id)} strategy={verticalListSortingStrategy}>
                {list.map(channelRow)}
              </SortableContext>
              {list.length === 0 && (
                <div style={{ padding: '4px 12px 8px', fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>{t('chat.categoryEmpty')}</div>
              )}
            </>
          )}
        </div>
      </SortableCard>
    );
  };

  return (
    <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--surface)' }}>
      <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ ...caps, fontSize: 11, color: 'var(--dim)' }}>{t('chat.channels')}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <ReorderLockButton locked={reorderLocked} onToggle={() => setReorderLocked(v => !v)} fontSize={13} padding={2} />
            <button type="button" aria-label={t('chat.newCategory')} title={t('chat.newCategory')}
              style={{ ...linkButton('var(--dim)', 13), padding: 2 }} onClick={onNewCategory}>🗂</button>
            <button type="button" aria-label={t('chat.newChannel')} title={t('chat.newChannel')}
              style={{ ...linkButton('var(--accent)', 16), padding: 2 }} onClick={onNewChannel}>+</button>
          </div>
        </div>
      </div>

      <div className="chan-list" style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} accessibility={dndA11y}>
          {sortedCategories.length > 0 && uncategorized.length > 0 && (
            <div style={{ ...caps, padding: '6px 12px 2px', fontSize: 10, color: 'var(--muted)' }}>{t('chat.uncategorized')}</div>
          )}
          <SortableContext items={uncategorized.map(c => c.id)} strategy={verticalListSortingStrategy}>
            {uncategorized.map(channelRow)}
          </SortableContext>
          <SortableContext items={sortedCategories.map(c => c.id)} strategy={verticalListSortingStrategy}>
            {sortedCategories.map(categoryBlock)}
          </SortableContext>
        </DndContext>

        {archivedChannels.length > 0 && (
          <>
            <button type="button" style={{
              display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none',
              color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, cursor: 'pointer', textAlign: 'left',
            }} aria-expanded={showArchived} onClick={() => setShowArchived(v => !v)}>
              {t('members.archivedCount', { count: archivedChannels.length })} <span aria-hidden>{showArchived ? '▲' : '▼'}</span>
            </button>
            {showArchived && archivedChannels.map(ch => (
              <div key={ch.id} style={{ padding: '6px 12px', cursor: 'pointer', opacity: 0.5 }}
                aria-current={activeChannelId === ch.id ? 'true' : undefined} {...clickable(() => onSelect(ch.id), ch.name)}>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}># {ch.name}</span>
              </div>
            ))}
          </>
        )}
      </div>

      <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>{children}</div>
      <SaveErrorDialog error={saveError} onClose={clearSaveError} />
    </div>
  );
}
