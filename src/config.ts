import {CloudLimits, DEFAULT_CLOUD_LIMITS} from './cloud/cloudTypes';
import {isRecord} from './utils/collections';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export const LOG_LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'];

export interface SyncConfig {
  debounceMs: number;
  minIntervalMs: number;
  paceMs: number;
  chunkIdleMs: number;
  snapshotMemoMs: number;
  pendingMediaMax: number;
  cloneIdleTimeoutMs: number;
  mediaHashCacheChars: number;
}

export interface MirrorConfig {
  debounceMs: number;
  thumbTimeoutMs: number;
  friendTimeoutMs: number;
  sentPersistMs: number;
  mediaAskTtlMs: number;
  gifAskTtlMs: number;
  gifAskKeepMs: number;
  gifBuffersPerPeer: number;
  mediaAskDelayMs: number;
  mediaBatchMs: number;
}

export interface ConnectionConfig {
  linkProbeTimeoutMs: number;
  resumeMinGapMs: number;
  linkFreshMs: number;
  pendingLinkWatchMs: number;
  reconnectBaseMs: number;
  reconnectMaxMs: number;
  fetchTimeoutMs: number;
  notFriendsGapMs: number;
}

export interface RemindersConfig {
  kickDelayMs: number;
  tickMs: number;
}

export interface GatewayConfig {
  timeoutMs: number;
  pullMinGapMs: number;
  retryBaseMs: number;
  retryMaxMs: number;
}

export interface AppConfig {
  relayUrl: string;
  gatewayUrl: string;
  logLevel: LogLevel;
  verboseNetwork: boolean;
  skipUpdateCheck: boolean;
  sync: SyncConfig;
  mirror: MirrorConfig;
  connection: ConnectionConfig;
  gateway: GatewayConfig;
  reminders: RemindersConfig;
  cloud: CloudLimits;
}

export type ConfigOverrides = {
  [K in keyof AppConfig]?: AppConfig[K] extends object ? Partial<AppConfig[K]> : AppConfig[K];
};

export const CONFIG_OVERRIDES_KEY = 'psdev:config';

const DEV = !!import.meta.env.DEV;

export const DEFAULT_CONFIG: AppConfig = {
  relayUrl: '',
  gatewayUrl: '',
  logLevel: DEV ? 'debug' : 'info',
  verboseNetwork: false,
  skipUpdateCheck: false,
  sync: {
    debounceMs: 8000,
    minIntervalMs: 8000,
    paceMs: 300,
    chunkIdleMs: 10 * 60 * 1000,
    snapshotMemoMs: 15000,
    pendingMediaMax: 300,
    cloneIdleTimeoutMs: 5 * 60 * 1000,
    mediaHashCacheChars: 24 * 1024 * 1024,
  },
  mirror: {
    debounceMs: 10000,
    thumbTimeoutMs: 30 * 1000,
    friendTimeoutMs: 10 * 60 * 1000,
    sentPersistMs: 2000,
    mediaAskTtlMs: 10 * 60 * 1000,
    gifAskTtlMs: 3 * 60 * 1000,
    gifAskKeepMs: 60 * 60 * 1000,
    gifBuffersPerPeer: 2,
    mediaAskDelayMs: 1500,
    mediaBatchMs: 400,
  },
  connection: {
    linkProbeTimeoutMs: 12000,
    resumeMinGapMs: 20000,
    linkFreshMs: 10000,
    pendingLinkWatchMs: 60 * 60 * 1000,
    reconnectBaseMs: 1000,
    reconnectMaxMs: 30000,
    fetchTimeoutMs: 15000,
    notFriendsGapMs: 60 * 60 * 1000,
  },
  gateway: {
    timeoutMs: 10000,
    pullMinGapMs: 15000,
    retryBaseMs: 5000,
    retryMaxMs: 5 * 60 * 1000,
  },
  reminders: {
    kickDelayMs: 4000,
    tickMs: 30000,
  },
  cloud: {...DEFAULT_CLOUD_LIMITS},
};

const envText = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

const envFlag = (v: unknown): boolean | undefined => (v === 'true' || v === '1' ? true : v === 'false' || v === '0' ? false : undefined);

const envLevel = (v: unknown): LogLevel | undefined => {
  const s = envText(v);
  return LOG_LEVELS.find(l => l === s);
};

const ENV_OVERRIDES: ConfigOverrides = {
  relayUrl: envText(import.meta.env.VITE_RELAY_URL),
  gatewayUrl: envText(import.meta.env.VITE_GATEWAY_URL),
  logLevel: envLevel(import.meta.env.VITE_LOG_LEVEL),
  verboseNetwork: envFlag(import.meta.env.VITE_VERBOSE_NETWORK),
  skipUpdateCheck: envFlag(import.meta.env.VITE_SKIP_UPDATE_CHECK),
};

const isPositiveInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;

const httpUrl = (v: unknown, fallback: string): string => {
  if (typeof v !== 'string') return fallback;
  const s = v.trim();
  return s === '' || /^https?:\/\//i.test(s) ? s : fallback;
};

const flag = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

const level = (v: unknown, fallback: LogLevel): LogLevel => LOG_LEVELS.find(l => l === v) ?? fallback;

const someNumbers = (base: object, over: unknown): Record<string, number> | undefined => {
  if (!isRecord(over)) return undefined;
  const picked = Object.keys(base).flatMap((k): [string, number][] => {
    const v = over[k];
    return isPositiveInt(v) ? [[k, v]] : [];
  });
  return picked.length ? Object.fromEntries(picked) : undefined;
};

const numbers = <T extends object>(base: T, over: unknown): T => ({...base, ...someNumbers(base, over)});

const merge = (base: AppConfig, over: unknown): AppConfig => {
  if (!isRecord(over)) return base;
  return {
    relayUrl: httpUrl(over.relayUrl, base.relayUrl),
    gatewayUrl: httpUrl(over.gatewayUrl, base.gatewayUrl),
    logLevel: level(over.logLevel, base.logLevel),
    verboseNetwork: flag(over.verboseNetwork, base.verboseNetwork),
    skipUpdateCheck: flag(over.skipUpdateCheck, base.skipUpdateCheck),
    sync: numbers(base.sync, over.sync),
    mirror: numbers(base.mirror, over.mirror),
    connection: numbers(base.connection, over.connection),
    gateway: numbers(base.gateway, over.gateway),
    reminders: numbers(base.reminders, over.reminders),
    cloud: numbers(base.cloud, over.cloud),
  };
};

export const parseConfigOverrides = (v: unknown): ConfigOverrides => {
  if (!isRecord(v)) return {};
  const out: ConfigOverrides = {};
  if (typeof v.relayUrl === 'string') out.relayUrl = v.relayUrl;
  if (typeof v.gatewayUrl === 'string') out.gatewayUrl = v.gatewayUrl;
  const logLevel = LOG_LEVELS.find(l => l === v.logLevel);
  if (logLevel) out.logLevel = logLevel;
  if (typeof v.verboseNetwork === 'boolean') out.verboseNetwork = v.verboseNetwork;
  if (typeof v.skipUpdateCheck === 'boolean') out.skipUpdateCheck = v.skipUpdateCheck;
  const sync = someNumbers(DEFAULT_CONFIG.sync, v.sync);
  if (sync) out.sync = sync;
  const mirror = someNumbers(DEFAULT_CONFIG.mirror, v.mirror);
  if (mirror) out.mirror = mirror;
  const connection = someNumbers(DEFAULT_CONFIG.connection, v.connection);
  if (connection) out.connection = connection;
  const gateway = someNumbers(DEFAULT_CONFIG.gateway, v.gateway);
  if (gateway) out.gateway = gateway;
  const reminders = someNumbers(DEFAULT_CONFIG.reminders, v.reminders);
  if (reminders) out.reminders = reminders;
  const cloud = someNumbers(DEFAULT_CONFIG.cloud, v.cloud);
  if (cloud) out.cloud = cloud;
  return out;
};

let overrides: ConfigOverrides = {};
let current: AppConfig = merge(DEFAULT_CONFIG, ENV_OVERRIDES);
const listeners = new Set<() => void>();

const rebuild = (): void => {
  current = merge(merge(DEFAULT_CONFIG, ENV_OVERRIDES), overrides);
  listeners.forEach(fn => {
    try {
      fn();
    } catch {}
  });
};

export const config = (): AppConfig => current;

export const configOverrides = (): ConfigOverrides => overrides;

export const onConfigChange = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export const loadConfigOverrides = async (): Promise<void> => {
  if (!DEV) return;
  try {
    const raw: unknown = await window.electronAPI.store.get(CONFIG_OVERRIDES_KEY);
    const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    overrides = parseConfigOverrides(parsed);
  } catch {
    overrides = {};
  }
  rebuild();
};

export const saveConfigOverrides = async (next: ConfigOverrides): Promise<void> => {
  if (!DEV) return;
  overrides = next;
  rebuild();
  if (Object.keys(next).length) await window.electronAPI.store.set(CONFIG_OVERRIDES_KEY, next);
  else await window.electronAPI.store.remove(CONFIG_OVERRIDES_KEY);
};
