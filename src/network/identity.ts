import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from './bytes';
import { store } from '../storage';
import { peerIdFromEd25519PublicKey } from './peerid';

export const IDENTITY_STORAGE_KEY = 'ps:networkIdentity';

const DEVICE_SUB_ID_KEY = 'ps.deviceSubId';

let cachedSubId: string | null = null;

export const getDeviceSubId = async (): Promise<string> => {
  if (cachedSubId) return cachedSubId;
  const existing = await store.get<string>(DEVICE_SUB_ID_KEY, '');
  if (existing) {
    cachedSubId = existing;
    return existing;
  }
  const fresh = encodeBase64(nacl.randomBytes(8)).replace(/[^A-Za-z0-9]/g, '').slice(0, 10);
  cachedSubId = fresh;
  await store.set(DEVICE_SUB_ID_KEY, fresh);
  return fresh;
};

export interface Identity {
  peerId: string;
  edPublicKey: Uint8Array;
  edSecretKey: Uint8Array;
  boxPublicKey: Uint8Array;
  boxSecretKey: Uint8Array;
}

interface StoredIdentity {
  v: number;
  edSecretKey: string;
  boxSecretKey: string;
}

const fromStored = (s: StoredIdentity): Identity => {
  const edSecretKey = decodeBase64(s.edSecretKey);
  const boxSecretKey = decodeBase64(s.boxSecretKey);
  const edPair = nacl.sign.keyPair.fromSecretKey(edSecretKey);
  const boxPair = nacl.box.keyPair.fromSecretKey(boxSecretKey);
  return {
    peerId: peerIdFromEd25519PublicKey(edPair.publicKey),
    edPublicKey: edPair.publicKey,
    edSecretKey: edPair.secretKey,
    boxPublicKey: boxPair.publicKey,
    boxSecretKey: boxPair.secretKey,
  };
};

const toStored = (id: Identity): StoredIdentity => ({
  v: 1,
  edSecretKey: encodeBase64(id.edSecretKey),
  boxSecretKey: encodeBase64(id.boxSecretKey),
});

let cached: Identity | null = null;

export const loadOrCreateIdentity = async (): Promise<Identity> => {
  if (cached) return cached;
  const stored = await store.get<StoredIdentity>(IDENTITY_STORAGE_KEY, null);
  if (stored && stored.edSecretKey && stored.boxSecretKey) {
    try {
      cached = fromStored(stored);
      return cached;
    } catch (e) {
      console.error('[NETWORK] stored identity unreadable, regenerating:', e);
      await store.set(IDENTITY_STORAGE_KEY + '.unreadable', stored).catch(() => {});
    }
  }
  const edPair = nacl.sign.keyPair();
  const boxPair = nacl.box.keyPair();
  const id: Identity = {
    peerId: peerIdFromEd25519PublicKey(edPair.publicKey),
    edPublicKey: edPair.publicKey,
    edSecretKey: edPair.secretKey,
    boxPublicKey: boxPair.publicKey,
    boxSecretKey: boxPair.secretKey,
  };
  await store.set(IDENTITY_STORAGE_KEY, toStored(id));
  cached = id;
  return id;
};

export const resetIdentityCache = (): void => {
  cached = null;
};

export interface FriendIdentity {
  peerId: string;
  edPublicKey: Uint8Array;
  boxPublicKey: Uint8Array;
}
