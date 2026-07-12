import { logError } from '../log';

const ORDER_KEY = 'ps.dashboardOrder';

// The canonical dashboard order. Every tile id the app knows about must appear here.
export const DEFAULT_TILE_ORDER: string[] = [
  'front',
  'system-manager',
  'system-map',
  'medical',
  'network',
  'members',
  'history',
  'retro-history',
  'journal',
  'chat',
  'mailbox',
  'whiteboard',
  'stats',
  'import-export',
  'custom-fields',
  'polls',
  'archive',
  'credits',
  'discord',
  'support',
  'settings',
];

// Keep the user's saved order, drop ids we no longer ship, and APPEND any tile that
// did not exist when their order was saved — otherwise a newly added tile would be
// invisible to every existing user.
export const mergeTileOrder = (saved: string[]): string[] => {
  const known = new Set(DEFAULT_TILE_ORDER);
  const kept = saved.filter(id => known.has(id));
  const added = DEFAULT_TILE_ORDER.filter(id => !kept.includes(id));
  return [...kept, ...added];
};

export const loadTileOrder = (): string[] => {
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    if (!raw) return DEFAULT_TILE_ORDER;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_TILE_ORDER;
    return mergeTileOrder(parsed.filter((x: unknown): x is string => typeof x === 'string'));
  } catch (e) {
    logError('dashboard', e);
    return DEFAULT_TILE_ORDER;
  }
};

export const saveTileOrder = (order: string[]) => {
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(order));
  } catch (e) {
    logError('dashboard', e);
  }
};

export const resetTileOrder = () => {
  try {
    localStorage.removeItem(ORDER_KEY);
  } catch (e) {
    logError('dashboard', e);
  }
};
