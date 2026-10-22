import { useCallback, useEffect, useRef, useState } from 'react';
import { NetworkManager } from '../../network/NetworkManager';
import { MirrorCacheEntry, MirrorMember } from '../../network/types';
import { mirrorMembersOf, mirrorGroupsOf } from '../../network/mirror/payload';
import type { MirrorServedFeature } from '../../network/mirror/build';
import { log, logError } from '../../utils/log';
import type { MirrorGroupsView } from './shared';

const MIRROR_WAIT_MS = 12000;

export const groupsPayload = (entry: MirrorCacheEntry | null): MirrorGroupsView | null => {
  const d = entry && !entry.none ? mirrorGroupsOf(entry.data) : null;
  if (!d) return null;
  const membership = d.membership && typeof d.membership === 'object' ? d.membership : {};
  return {
    groups: Array.isArray(d.groups) ? d.groups : [],
    membership: new Map(Object.entries(membership).map(([gid, list]) => [gid, Array.isArray(list) ? list : []])),
  };
};

export function useMirrorFeed(open: boolean, peerId: string, feature: MirrorServedFeature, online: boolean) {
  const [entry, setEntry] = useState<MirrorCacheEntry | null>(null);
  const [memberCache, setMemberCache] = useState<MirrorMember[]>([]);
  const [groupCache, setGroupCache] = useState<MirrorGroupsView | null>(null);
  const [loading, setLoading] = useState(false);
  const onlineRef = useRef(online);
  const loadingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const needsMembers = feature === 'history';

  const request = useCallback(() => {
    if (!online) return;
    setLoading(true);
    if (loadingTimer.current) clearTimeout(loadingTimer.current);
    loadingTimer.current = setTimeout(() => { loadingTimer.current = null; setLoading(false); }, MIRROR_WAIT_MS);
    NetworkManager.requestMirror(peerId, feature).catch(e => log.debug('mirror', e));
    if (feature === 'members') NetworkManager.requestMirror(peerId, 'groups').catch(e => log.debug('mirror', e));
    if (needsMembers) NetworkManager.requestMirror(peerId, 'members').catch(e => log.debug('mirror', e));
  }, [peerId, feature, online, needsMembers]);

  useEffect(() => () => { if (loadingTimer.current) clearTimeout(loadingTimer.current); }, []);

  useEffect(() => {
    if (!open) return;
    setEntry(null);
    setMemberCache([]);
    setGroupCache(null);
    const loadEntry = () => NetworkManager.loadMirror(peerId, feature).then(setEntry).catch(e => logError('mirror', e));
    const loadMembers = () => NetworkManager.loadMirror(peerId, 'members').then(e => setMemberCache(mirrorMembersOf(e?.data))).catch(e => logError('mirror', e));
    const loadGroups = () => NetworkManager.loadMirror(peerId, 'groups').then(e => setGroupCache(groupsPayload(e))).catch(e => logError('mirror', e));
    void loadEntry();
    if (needsMembers) void loadMembers();
    if (feature === 'members') void loadGroups();
    const unsub = NetworkManager.onMirrorUpdated((pid, feat) => {
      if (pid !== peerId) return;
      if (feat === feature) {
        setLoading(false);
        void loadEntry();
      } else if (feat === 'groups' && feature === 'members') {
        void loadGroups();
      } else if (feat === 'members' && needsMembers) {
        void loadMembers();
      }
    });
    onlineRef.current = online;
    const unsubNet = NetworkManager.subscribe(s => {
      const isOnline = s.onlinePeers.includes(peerId);
      const was = onlineRef.current;
      onlineRef.current = isOnline;
      if (isOnline && !was) request();
    });
    request();
    return () => {
      unsub();
      unsubNet();
    };
  }, [open, peerId, feature, request, needsMembers]);

  return { entry, memberCache, groupCache, loading, request };
}
