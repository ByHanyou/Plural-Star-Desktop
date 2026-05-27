import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from './i18n/i18n';
import { store, KEYS } from './storage';
import { deriveTheme, applyThemeToDOM, applyTextScale, DARK_PALETTE, BUILTIN_PALETTES, CustomPalette, ThemeColors } from './theme';
import {
  Member, FrontState, HistoryEntry, JournalEntry, ChatChannel, ChatMessage,
  AppSettings, SystemInfo, MemberGroup, migrateFrontState, isFrontEmpty,
  fmtDur, getInitials, DEFAULT_CHANNELS,
} from './utils';
import { changeLanguage } from './i18n/i18n';

import FrontTile from './tiles/FrontTile';
import MembersTile from './tiles/MembersTile';
import HistoryTile from './tiles/HistoryTile';
import JournalTile from './tiles/JournalTile';
import ChatTile from './tiles/ChatTile';
import StatsTile from './tiles/StatsTile';
import ImportExportTile from './tiles/ImportExportTile';
import SettingsTile from './tiles/SettingsTile';
import CustomFieldsTile from './tiles/CustomFieldsTile';
import PollsTile from './tiles/PollsTile';
import CreditsTile from './tiles/CreditsTile';
import SupportTile from './tiles/SupportTile';
import DiscordTile from './tiles/DiscordTile';

import SettingsView from './views/SettingsView';
import MembersView from './views/MembersView';
import ImportExportView from './views/ImportExportView';
import StatsView from './views/StatsView';
import JournalView from './views/JournalView';
import HistoryView from './views/HistoryView';
import FrontView from './views/FrontView';
import ChatView from './views/ChatView';
import CustomFieldsView from './views/CustomFieldsView';
import PollsView from './views/PollsView';
import CreditsView from './views/CreditsView';

type ViewId = 'dashboard' | 'front' | 'members' | 'history' | 'journal' | 'chat' | 'stats' | 'import-export' | 'settings' | 'custom-fields' | 'polls' | 'credits';

interface AppState {
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

const DEFAULT_SETTINGS: AppSettings = {
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

const applyDyslexicFont = (on: boolean) => {
  if (on) document.documentElement.classList.remove('no-dyslexic');
  else document.documentElement.classList.add('no-dyslexic');
};

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (typeof console !== 'undefined' && console.error) {
      console.error('AppErrorBoundary caught:', error, info?.componentStack);
    }
  }
  reset = () => this.setState({ error: null });
  render() {
    if (!this.state.error) return this.props.children;
    const err = this.state.error as Error;
    const msg = err?.message || String(err);
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#0a0a0a', color: '#fff', textAlign: 'center', fontFamily: 'var(--font-body)' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12, fontFamily: 'var(--font-display)' }}>
          {i18n.t('errorBoundary.title', { defaultValue: 'Something went wrong' })}
        </h1>
        <p style={{ fontSize: 14, color: '#bbb', marginBottom: 16, maxWidth: 480 }}>
          {i18n.t('errorBoundary.body', { defaultValue: 'The app hit an unexpected error. Try again, or restart if it persists.' })}
        </p>
        <p style={{ fontSize: 12, color: '#666', marginBottom: 24, maxWidth: 480, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'pre-wrap' }}>
          {msg}
        </p>
        <button onClick={this.reset} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#3a7bd5', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          {i18n.t('errorBoundary.retry', { defaultValue: 'Try again' })}
        </button>
      </div>
    );
  }
}

function AppInner() {
  const { t } = useTranslation();
  const [view, setView] = useState<ViewId>('dashboard');
  const [state, setState] = useState<AppState>({
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
  });

  const loadData = useCallback(async () => {
    const [system, members, groups, frontRaw, history, journal, channels, settings, palettes] = await Promise.all([
      store.get<SystemInfo>(KEYS.system, { name: '', description: '' }),
      store.get<Member[]>(KEYS.members, []),
      store.get<MemberGroup[]>(KEYS.groups, []),
      store.get<FrontState>(KEYS.front, null),
      store.get<HistoryEntry[]>(KEYS.history, []),
      store.get<JournalEntry[]>(KEYS.journal, []),
      store.get<ChatChannel[]>(KEYS.chatChannels, []),
      store.get<AppSettings>(KEYS.settings, DEFAULT_SETTINGS),
      store.get<CustomPalette[]>(KEYS.palettes, []),
    ]);

    const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };
    const front = migrateFrontState(frontRaw);
    const allPalettes = [...BUILTIN_PALETTES, ...(palettes || [])];
    const activePalette = allPalettes.find(p => p.id === mergedSettings.activePaletteId) || DARK_PALETTE;
    const theme = deriveTheme(activePalette.bg, activePalette.accent, activePalette.text, activePalette.mid);
    applyThemeToDOM(theme);
    applyTextScale(mergedSettings.textScale);
    applyDyslexicFont(mergedSettings.useDyslexicFont !== false);
    changeLanguage(mergedSettings.language);

    setState({
      system: system || { name: '', description: '' },
      members: members || [],
      groups: groups || [],
      front,
      history: history || [],
      journal: journal || [],
      channels: channels || [],
      settings: mergedSettings,
      palettes: palettes || [],
      theme,
      loaded: true,
    });
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const systemName = state.system.name || 'Plural Star';

  if (!state.loaded) {
    return (
      <div className="app-shell">
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)', fontSize: 18 }}>
            Loading...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="titlebar">
        <span className="titlebar__title">
          {view === 'dashboard' ? systemName : `${systemName} — ${view.charAt(0).toUpperCase() + view.slice(1).replace('-', '/')}`}
        </span>
        <div className="titlebar__controls">
          <button className="titlebar__btn titlebar__btn--minimize" onClick={() => window.electronAPI.window.minimize()} />
          <button className="titlebar__btn titlebar__btn--maximize" onClick={() => window.electronAPI.window.maximize()} />
          <button className="titlebar__btn titlebar__btn--close" onClick={() => window.electronAPI.window.close()} />
        </div>
      </div>

      {view === 'dashboard' ? (
        <div className="dashboard">
          <div className="tile-grid">
            <FrontTile
              front={state.front}
              members={state.members}
              onClick={() => setView('front')}
            />
            <MembersTile
              members={state.members}
              onClick={() => setView('members')}
            />
            <HistoryTile
              history={state.history}
              members={state.members}
              onClick={() => setView('history')}
            />
            <JournalTile
              journal={state.journal}
              members={state.members}
              onClick={() => setView('journal')}
            />
            <ChatTile
              channels={state.channels}
              members={state.members}
              onClick={() => setView('chat')}
            />
            <StatsTile
              history={state.history}
              members={state.members}
              onClick={() => setView('stats')}
            />
            <ImportExportTile
              onClick={() => setView('import-export')}
            />
            <CustomFieldsTile
              onClick={() => setView('custom-fields')}
            />
            <PollsTile
              onClick={() => setView('polls')}
            />
            <CreditsTile
              onClick={() => setView('credits')}
            />
            <DiscordTile
              onClick={() => window.open('https://discord.gg/FFQw33cu8m', '_blank')}
            />
            <SupportTile
              onClick={() => window.open('https://www.buymeacoffee.com/PluralStar', '_blank')}
            />
            <SettingsTile
              settings={state.settings}
              onClick={() => setView('settings')}
            />
          </div>
        </div>
      ) : (
        <div className="full-view">
          <div className="full-view__header">
            <button className="full-view__back" onClick={() => setView('dashboard')}>
              {t('hub.dashboard')}
            </button>
            <span className="full-view__title">
              {view === 'front' ? t('tabs.front')
                : view === 'members' ? t('members.title')
                : view === 'history' ? t('history.title')
                : view === 'journal' ? t('journal.title')
                : view === 'chat' ? t('hub.systemChat')
                : view === 'stats' ? t('hub.statistics')
                : view === 'import-export' ? t('hub.importExport')
                : view === 'settings' ? t('modal.systemSettings')
                : view === 'custom-fields' ? t('customFields.title')
                : view === 'polls' ? t('polls.title')
                : view === 'credits' ? t('hub.credits', { defaultValue: 'Credits' })
                : view}
            </span>
          </div>
          <div className="full-view__content">
            {view === 'settings' && (
              <SettingsView system={state.system} settings={state.settings} palettes={state.palettes} onUpdate={loadData} />
            )}
            {view === 'members' && (
              <MembersView members={state.members} groups={state.groups} onUpdate={loadData} />
            )}
            {view === 'import-export' && (
              <ImportExportView system={state.system} members={state.members} history={state.history}
                journal={state.journal} settings={state.settings} channels={state.channels}
                palettes={state.palettes} onUpdate={loadData} />
            )}
            {view === 'stats' && (
              <StatsView history={state.history} members={state.members} channels={state.channels} />
            )}
            {view === 'journal' && (
              <JournalView journal={state.journal} members={state.members} onUpdate={loadData} />
            )}
            {view === 'history' && (
              <HistoryView history={state.history} members={state.members} onUpdate={loadData} />
            )}
            {view === 'front' && (
              <FrontView front={state.front} members={state.members} groups={state.groups}
                history={state.history} settings={state.settings} onUpdate={loadData} />
            )}
            {view === 'chat' && (
              <ChatView members={state.members} channels={state.channels} onUpdate={loadData} />
            )}
            {view === 'custom-fields' && (
              <CustomFieldsView onUpdate={loadData} />
            )}
            {view === 'polls' && (
              <PollsView members={state.members} onUpdate={loadData} />
            )}
            {view === 'credits' && (
              <CreditsView />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppInner />
    </AppErrorBoundary>
  );
}
