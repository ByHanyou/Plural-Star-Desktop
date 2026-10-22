import type React from 'react';
import { FrontTier, FrontTierKey, Member } from '../utils';
import type { ViewId } from './views';
import PlannerView from '../views/PlannerView';
import SettingsView from '../views/SettingsView';
import SystemProfileView from '../views/SystemProfileView';
import MembersView from '../views/MembersView';
import SystemMapView from '../views/SystemMapView';
import MedicalView from '../views/MedicalView';
import ImportExportView from '../views/ImportExportView';
import StatsView from '../views/StatsView';
import JournalView from '../views/JournalView';
import HistoryView from '../views/HistoryView';
import FrontView from '../views/FrontView';
import ChatView from '../views/ChatView';
import CustomFieldsView from '../views/CustomFieldsView';
import PollsView from '../views/PollsView';
import CreditsView from '../views/CreditsView';
import SystemManagerView from '../views/SystemManagerView';
import RetroHistoryView from '../views/RetroHistoryView';
import StatusView from '../views/StatusView';
import ProfileView from '../views/ProfileView';
import NetworkView from '../views/NetworkView';
import MailboxView from '../views/MailboxView';
import WhiteboardView from '../views/WhiteboardView';
import ColorsView from '../views/ColorsView';

export function ViewHost({ view, isSinglet, selfMember, selfId, statuses, memberFocus, mapFocus, onOpen, onOpenMember, onShowOnMap, onMemberFocusHandled, onQuickFront, onRemoveFromFront, onSaveStatus, onEnsureSelf }: {
  view: ViewId;
  isSinglet: boolean;
  selfMember: Member | undefined;
  selfId: string | undefined;
  statuses: Member[];
  memberFocus: string | null;
  mapFocus: string | null;
  onOpen: (view: ViewId) => void;
  onOpenMember: (id: string) => void;
  onShowOnMap: (id: string) => void;
  onMemberFocusHandled: () => void;
  onQuickFront: (memberId: string, tier: FrontTierKey) => void;
  onRemoveFromFront: (memberId: string) => void;
  onSaveStatus: (p: Partial<FrontTier>, cf: Partial<FrontTier>, cc: Partial<FrontTier>) => void;
  onEnsureSelf: () => Promise<Member>;
}): React.ReactNode {
  switch (view) {
    case 'settings': return <SettingsView onOpenProfile={() => onOpen('system-profile')} />;
    case 'system-profile': return isSinglet ? null : <SystemProfileView />;
    case 'members': return isSinglet ? (
      <ProfileView member={selfMember} statuses={statuses} onEnsureSelf={onEnsureSelf} />
    ) : (
      <MembersView
        focusMemberId={memberFocus} onFocusHandled={onMemberFocusHandled}
        onShowOnMap={onShowOnMap}
        onQuickFront={onQuickFront} onRemoveFromFront={onRemoveFromFront} />
    );
    case 'archive': return <MembersView archiveOnly />;
    case 'retro-history': return <RetroHistoryView onDone={() => onOpen('dashboard')} singlet={isSinglet} selfId={selfId} />;
    case 'import-export': return <ImportExportView />;
    case 'stats': return <StatsView singlet={isSinglet} selfId={selfId} />;
    case 'journal': return <JournalView />;
    case 'history': return <HistoryView singlet={isSinglet} selfId={selfId} />;
    case 'front': return isSinglet ? (
      <StatusView statuses={statuses} selfId={selfId} onSaveStatus={onSaveStatus} onEnsureSelf={onEnsureSelf} />
    ) : (
      <FrontView onOpenMember={onOpenMember} />
    );
    case 'system-manager': return <SystemManagerView onViewMember={onOpenMember} onQuickFront={onQuickFront} onRemoveFromFront={onRemoveFromFront} />;
    case 'system-map': return <SystemMapView focusMemberId={mapFocus} onViewMember={onOpenMember} />;
    case 'medical': return <MedicalView />;
    case 'planner': return <PlannerView />;
    case 'chat': return <ChatView />;
    case 'custom-fields': return <CustomFieldsView />;
    case 'polls': return <PollsView />;
    case 'credits': return <CreditsView />;
    case 'network': return <NetworkView />;
    case 'mailbox': return <MailboxView />;
    case 'whiteboard': return <WhiteboardView />;
    case 'colors': return <ColorsView />;
    default: return null;
  }
}
