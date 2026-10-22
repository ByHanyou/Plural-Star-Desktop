import { useEffect, useState } from 'react';
import { store } from '../../storage';
import { logError } from '../../utils/log';
import { NetworkManager } from '../../network/NetworkManager';
import { PRIVACY_BUCKETS_KEY } from '../../network/types';
import { Bucket, normalizeBuckets } from '../../network/buckets';

export const usePrivacyBuckets = (): [Bucket[], (next: Bucket[]) => Promise<void>] => {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  useEffect(() => {
    const load = () => {
      store.get<unknown>(PRIVACY_BUCKETS_KEY, []).then(saved => setBuckets(normalizeBuckets(saved))).catch(e => logError('network', e));
    };
    load();
    return NetworkManager.onSyncApplied(load);
  }, []);
  const saveBuckets = async (next: Bucket[]) => {
    await store.set(PRIVACY_BUCKETS_KEY, next);
    setBuckets(next);
    NetworkManager.refreshAllMirrors();
  };
  return [buckets, saveBuckets];
};
