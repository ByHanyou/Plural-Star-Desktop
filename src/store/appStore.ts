import { create } from 'zustand';
import { SystemInfo, Member, MemberGroup, FrontState, HistoryEntry, JournalEntry, ChatChannel, AppSettings } from '../utils';
import { CustomPalette, ThemeColors, deriveTheme, DARK_PALETTE } from '../theme';

export interface AppState {
  system: SystemInfo;
  members: Member[];
  groups: MemberGroup[];
  front: FrontState | null;
  history: HistoryEntry[];
  journal: JournalEntry[];
  channels: ChatChannel[];
  settings: AppSettings;
  palettes: CustomPalette[];
  theme: ThemeColors;
  loaded: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  locations: [],
  customMoods: [],
  lightMode: false,
  gpsEnabled: false,
  filesEnabled: true,
  language: 'en',
  notificationsEnabled: true,
  activePaletteId: '__dark__',
  textScale: 1.0,
  useDyslexicFont: false,
};

const INITIAL_STATE: AppState = {
  system: { name: '', description: '' },
  members: [],
  groups: [],
  front: null,
  history: [],
  journal: [],
  channels: [],
  settings: DEFAULT_SETTINGS,
  palettes: [],
  theme: deriveTheme(DARK_PALETTE.bg, DARK_PALETTE.accent, DARK_PALETTE.text, DARK_PALETTE.mid),
  loaded: false,
};

type Store = {
  state: AppState;
  setState: (u: AppState | ((prev: AppState) => AppState)) => void;
};

export const useAppStore = create<Store>()(set => ({
  state: INITIAL_STATE,
  setState: u => set(s => ({ state: typeof u === 'function' ? (u as (prev: AppState) => AppState)(s.state) : u })),
}));
