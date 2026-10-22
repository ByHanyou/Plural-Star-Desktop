import { useTranslation } from 'react-i18next';

export type ViewId = 'dashboard' | 'front' | 'members' | 'history' | 'journal' | 'chat' | 'stats' | 'import-export' | 'settings' | 'system-profile' | 'custom-fields' | 'polls' | 'credits' | 'system-manager' | 'system-map' | 'medical' | 'archive' | 'retro-history' | 'network' | 'mailbox' | 'whiteboard' | 'colors' | 'planner';

const TITLE_KEY: Record<string, string> = {
  'front': 'tabs.front',
  'members': 'tabs.fronters',
  'history': 'history.title',
  'journal': 'journal.title',
  'chat': 'hub.systemChat',
  'stats': 'hub.statistics',
  'import-export': 'hub.importExport',
  'settings': 'modal.systemSettings',
  'system-profile': 'systemProfile.title',
  'custom-fields': 'customFields.title',
  'polls': 'polls.title',
  'credits': 'hub.credits',
  'system-manager': 'systemManager.title',
  'system-map': 'systemMap.title',
  'planner': 'planner.title',
  'medical': 'medical.title',
  'archive': 'hub.archive',
  'retro-history': 'hub.retroHistory',
  'network': 'network.title',
  'mailbox': 'mailbox.title',
  'whiteboard': 'whiteboard.title',
  'colors': 'colors.title',
  'discord': 'hub.discord',
  'support': 'hub.supportPS',
};

const SINGLET_TITLE_KEY: Record<string, string> = {
  'front': 'tabs.status',
  'members': 'tabs.profile',
};

export const useViewTitle = (isSinglet: boolean): ((v: string) => string) => {
  const { t } = useTranslation();
  return (v: string): string => {
    const key = (isSinglet && SINGLET_TITLE_KEY[v]) || TITLE_KEY[v];
    return key ? t(key) : v;
  };
};
