import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { MirrorServedFeature } from '../../network/mirror/build';
import type { MirrorGroup } from '../../network/types';

export const mutedText: CSSProperties = { fontSize: 12, color: 'var(--muted)' };

export const rowDivider: CSSProperties = { borderTop: '1px solid var(--border)', padding: '10px 0' };

export type MirrorGroupsView = { groups: MirrorGroup[]; membership: ReadonlyMap<string, { id: string; name: string }[]> };

export function Nothing() {
  const { t } = useTranslation();
  return <p style={mutedText}>{t('network.mirrorNothing')}</p>;
}

export const MIRROR_FEATURE_KEY: Record<MirrorServedFeature, string> = {
  systemProfile: 'systemProfile.title',
  members: 'tabs.members',
  groups: 'memberGroups.title',
  history: 'tabs.history',
  journal: 'tabs.journal',
  whiteboard: 'whiteboard.title',
  planner: 'planner.title',
};

export const MIRROR_MENU: MirrorServedFeature[] = ['systemProfile', 'members', 'groups', 'history', 'journal', 'whiteboard', 'planner'];
