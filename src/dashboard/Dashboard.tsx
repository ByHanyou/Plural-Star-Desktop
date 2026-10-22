import type React from 'react';
import { useState } from 'react';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { Member, DISCORD_URL, SUPPORT_URL } from '../utils';
import { useDndA11y } from '../components/ui';
import SortableCard, { useSortSensors } from '../components/SortableCard';
import type { ViewId } from '../app/views';
import { loadTileOrder, saveTileOrder } from './tileOrder';

import FrontTile from '../tiles/FrontTile';
import MembersTile from '../tiles/MembersTile';
import HistoryTile from '../tiles/HistoryTile';
import JournalTile from '../tiles/JournalTile';
import ChatTile from '../tiles/ChatTile';
import StatsTile from '../tiles/StatsTile';
import ImportExportTile from '../tiles/ImportExportTile';
import SettingsTile from '../tiles/SettingsTile';
import CustomFieldsTile from '../tiles/CustomFieldsTile';
import PollsTile from '../tiles/PollsTile';
import CreditsTile from '../tiles/CreditsTile';
import SupportTile from '../tiles/SupportTile';
import DiscordTile from '../tiles/DiscordTile';
import SystemManagerTile from '../tiles/SystemManagerTile';
import SystemMapTile from '../tiles/SystemMapTile';
import MedicalTile from '../tiles/MedicalTile';
import PlannerTile from '../tiles/PlannerTile';
import ArchiveTile from '../tiles/ArchiveTile';
import RetroHistoryTile from '../tiles/RetroHistoryTile';
import StatusTile from '../tiles/StatusTile';
import ProfileTile from '../tiles/ProfileTile';
import NetworkTile from '../tiles/NetworkTile';
import MailboxTile from '../tiles/MailboxTile';
import WhiteboardTile from '../tiles/WhiteboardTile';
import ColorsTile from '../tiles/ColorsTile';

export function Dashboard({ isSinglet, selfMember, selfId, statuses, viewTitle, onOpen, onOpenMap, onUpdateFront, onUpdateStatus, onRemember }: {
  isSinglet: boolean;
  selfMember: Member | undefined;
  selfId: string | undefined;
  statuses: Member[];
  viewTitle: (id: string) => string;
  onOpen: (view: ViewId) => void;
  onOpenMap: () => void;
  onUpdateFront: () => void;
  onUpdateStatus: () => void;
  onRemember: (e: React.SyntheticEvent) => void;
}) {
  const [tileOrder, setTileOrder] = useState<string[]>(() => loadTileOrder());
  const sensors = useSortSensors(6);
  const handleTileDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = tileOrder.indexOf(String(active.id));
    const to = tileOrder.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const next = arrayMove(tileOrder, from, to);
    setTileOrder(next);
    saveTileOrder(next);
  };
  const tileDndA11y = useDndA11y(id => viewTitle(String(id)));
  const goTo = (v: ViewId) => () => onOpen(v);

  const tileNodes: Record<string, React.ReactNode> = {
    'front': isSinglet ? (
      <StatusTile selfId={selfId} onClick={goTo('front')} onUpdateStatus={onUpdateStatus} />
    ) : (
      <FrontTile onClick={goTo('front')} onUpdateFront={onUpdateFront} />
    ),
    'system-manager': !isSinglet ? <SystemManagerTile onClick={goTo('system-manager')} /> : null,
    'system-map': !isSinglet ? <SystemMapTile onClick={onOpenMap} /> : null,
    'planner': <PlannerTile onClick={goTo('planner')} />,
    'medical': <MedicalTile onClick={goTo('medical')} />,
    'network': <NetworkTile onClick={goTo('network')} />,
    'members': isSinglet ? (
      <ProfileTile member={selfMember} statuses={statuses} onClick={goTo('members')} />
    ) : (
      <MembersTile onClick={goTo('members')} />
    ),
    'history': <HistoryTile onClick={goTo('history')} />,
    'retro-history': <RetroHistoryTile onClick={goTo('retro-history')} />,
    'journal': <JournalTile onClick={goTo('journal')} />,
    'chat': !isSinglet ? <ChatTile onClick={goTo('chat')} /> : null,
    'mailbox': !isSinglet ? <MailboxTile onClick={goTo('mailbox')} /> : null,
    'whiteboard': <WhiteboardTile onClick={goTo('whiteboard')} />,
    'colors': <ColorsTile onClick={goTo('colors')} />,
    'stats': <StatsTile onClick={goTo('stats')} />,
    'import-export': <ImportExportTile onClick={goTo('import-export')} />,
    'custom-fields': !isSinglet ? <CustomFieldsTile onClick={goTo('custom-fields')} /> : null,
    'polls': !isSinglet ? <PollsTile onClick={goTo('polls')} /> : null,
    'archive': !isSinglet ? <ArchiveTile onClick={goTo('archive')} /> : null,
    'credits': <CreditsTile onClick={goTo('credits')} />,
    'discord': <DiscordTile onClick={() => window.open(DISCORD_URL, '_blank')} />,
    'support': <SupportTile onClick={() => window.open(SUPPORT_URL, '_blank')} />,
    'settings': <SettingsTile onClick={goTo('settings')} />,
  };
  const visibleTileIds = tileOrder.filter(id => tileNodes[id] != null);

  return (
    <div className="dashboard" onFocus={onRemember} onClickCapture={onRemember}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTileDragEnd} accessibility={tileDndA11y}>
        <SortableContext items={visibleTileIds} strategy={rectSortingStrategy}>
          <div className="tile-grid">
            {visibleTileIds.map(id => (
              <SortableCard key={id} id={id} label={viewTitle(id)} tile>{tileNodes[id]}</SortableCard>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
