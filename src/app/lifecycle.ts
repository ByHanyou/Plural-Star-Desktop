import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/i18n';
import type { FrontState, Member } from '../utils';
import { NetworkManager } from '../network/NetworkManager';
import { singletShareFront } from '../network/frontShare';
import { config } from '../config';
import { log, errorMessage } from '../utils/log';
import { bootCloudServices } from '../cloud/cloudPlatform';
import { loadAll, reloadKeys } from '../store/boot';
import { startMedicalReminders } from '../services/medicalReminders';
import { startPlannerReminders } from '../services/plannerReminders';
import { startFriendAlerts } from '../services/friendAlerts';
import { checkForUpdate } from '../updateCheck';
import type { ViewId } from './views';

const SYNC_RELOAD_DELAY_MS = 400;

export const useUpdateCheck = (loaded: boolean): void => {
  const updateChecked = useRef(false);
  useEffect(() => {
    if (!loaded || updateChecked.current || config().skipUpdateCheck) return;
    updateChecked.current = true;
    checkForUpdate().catch(e => log.debug('update', e));
  }, [loaded]);
};

export const useStartup = (): string | null => {
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    loadAll().catch(e => {
      log.error('store', 'load failed:', e);
      setLoadError(errorMessage(e));
    });
  }, []);
  return loadError;
};

export const useBackgroundServices = (): void => {
  useEffect(() => startMedicalReminders(), []);
  useEffect(() => startPlannerReminders(), []);
  useEffect(() => startFriendAlerts(), []);
  useEffect(() => {
    NetworkManager.init()
      .catch(e => log.error('network', 'init failed:', e))
      .finally(() => bootCloudServices());
  }, []);
};

export const useSyncReload = (): void => {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const pending = new Set<string>();
    const unsub = NetworkManager.onSyncApplied(keys => {
      keys.forEach(k => pending.add(k));
      if (!timer) timer = setTimeout(() => { timer = null; const batch = [...pending]; pending.clear(); reloadKeys(batch).catch(e => log.error('store', 'reload failed:', e)); }, SYNC_RELOAD_DELAY_MS);
    });
    return () => { if (timer) clearTimeout(timer); unsub(); };
  }, []);
};

export const useFrontShare = (loaded: boolean, front: FrontState | null, members: Member[], selfId: string | undefined): void => {
  const membersRef = useRef(members);
  membersRef.current = members;
  const shareSig = useMemo(() => members.map(m => `${m.id}|${m.name}|${m.private ? 1 : 0}|${m.isFacet ? 1 : 0}|${m.isCustomFront ? 1 : 0}`).join('\n'), [members]);
  useEffect(() => {
    if (loaded) NetworkManager.updateMyFront(singletShareFront(front, selfId), membersRef.current).catch(e => log.warn('network', 'front share failed:', e));
  }, [loaded, front, shareSig, selfId]);
};

export const useViewFocus = (view: ViewId): { viewTitleRef: React.RefObject<HTMLSpanElement | null>; rememberTile: (e: React.SyntheticEvent) => void } => {
  const viewTitleRef = useRef<HTMLSpanElement>(null);
  const lastTileRef = useRef<string | null>(null);
  const prevViewRef = useRef<ViewId>(view);
  useEffect(() => {
    const prev = prevViewRef.current;
    prevViewRef.current = view;
    if (prev === view) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    if (view !== 'dashboard') { viewTitleRef.current?.focus(); return; }
    const id = lastTileRef.current;
    if (!id) return;
    const wrap = Array.from(document.querySelectorAll<HTMLElement>('[data-tile-id]')).find(el => el.dataset.tileId === id);
    wrap?.querySelector<HTMLElement>('[role="button"], button:not(.tile__grip)')?.focus();
  }, [view]);
  const rememberTile = (e: React.SyntheticEvent) => {
    const id = (e.target as HTMLElement).closest<HTMLElement>('[data-tile-id]')?.dataset.tileId;
    if (id) lastTileRef.current = id;
  };
  return { viewTitleRef, rememberTile };
};

export const useWindowTitle = (title: string): void => {
  useEffect(() => {
    document.title = title;
  }, [title]);
};

export const useShellLabels = (): void => {
  const { t } = useTranslation();
  useEffect(() => {
    window.electronAPI.shell.setLabels({
      trayOpen: t('tray.open', { app: 'Plural Star' }),
      trayQuit: t('tray.quit'),
      menuEdit: t('menu.edit'),
      jsonFiles: t('fileDialog.jsonFiles'),
      textFiles: t('fileDialog.textFiles'),
      allFiles: t('fileDialog.allFiles'),
      backup: t('fileDialog.backup'),
    });
  }, [t, i18n.language]);
};

export interface SyncConflictPrompt {
  peerId: string;
  deviceName: string;
}

export interface RoleMismatchPrompt {
  deviceName: string;
}

export const useSyncPrompts = () => {
  const [syncConflict, setSyncConflict] = useState<SyncConflictPrompt | null>(null);
  const [roleMismatch, setRoleMismatch] = useState<RoleMismatchPrompt | null>(null);
  useEffect(() => NetworkManager.onSyncConflict(c => setSyncConflict({ peerId: c.peerId, deviceName: c.deviceName })), []);
  useEffect(() => NetworkManager.onSyncRoleMismatch(c => setRoleMismatch({ deviceName: c.deviceName })), []);
  return { syncConflict, clearSyncConflict: () => setSyncConflict(null), roleMismatch, clearRoleMismatch: () => setRoleMismatch(null) };
};
