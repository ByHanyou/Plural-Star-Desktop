import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from './i18n/i18n';
import { store, KEYS } from './storage';
import { deriveTheme, applyThemeToDOM, applyTextScale, applyFontChoice, DARK_PALETTE, BUILTIN_PALETTES, CustomPalette, ThemeColors } from './theme';
import {
  Member, FrontState, HistoryEntry, JournalEntry, ChatChannel, ChatMessage,
  AppSettings, SystemInfo, MemberGroup, migrateFrontState, isFrontEmpty,
  fmtDur, getInitials, DEFAULT_CHANNELS, DEFAULT_MOODS, makeDefaultCustomFronts,
  uid, singletStatuses,
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
import SystemManagerTile from './tiles/SystemManagerTile';
import SystemMapTile from './tiles/SystemMapTile';
import MedicalTile from './tiles/MedicalTile';
import ArchiveTile from './tiles/ArchiveTile';
import RetroHistoryTile from './tiles/RetroHistoryTile';
import StatusTile from './tiles/StatusTile';
import ProfileTile from './tiles/ProfileTile';

import SettingsView from './views/SettingsView';
import MembersView from './views/MembersView';
import SystemMapView from './views/SystemMapView';
import MedicalView from './views/MedicalView';
import { startMedicalReminders } from './services/medicalReminders';
import ImportExportView from './views/ImportExportView';
import StatsView from './views/StatsView';
import JournalView from './views/JournalView';
import HistoryView from './views/HistoryView';
import FrontView, { SetFrontModal, applyFrontUpdate } from './views/FrontView';
import ChatView from './views/ChatView';
import CustomFieldsView from './views/CustomFieldsView';
import PollsView from './views/PollsView';
import CreditsView from './views/CreditsView';
import SystemManagerView from './views/SystemManagerView';
import RetroHistoryView from './views/RetroHistoryView';
import StatusView, { SetStatusModal } from './views/StatusView';
import ProfileView from './views/ProfileView';

type ViewId = 'dashboard' | 'front' | 'members' | 'history' | 'journal' | 'chat' | 'stats' | 'import-export' | 'settings' | 'custom-fields' | 'polls' | 'credits' | 'system-manager' | 'system-map' | 'medical' | 'archive' | 'retro-history';

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
  const [memberFocus, setMemberFocus] = useState<string | null>(null);
  const [mapFocus, setMapFocus] = useState<string | null>(null);
  const [showQuickFront, setShowQuickFront] = useState(false);
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
    let memberList = members || [];
    if (!mergedSettings.customFrontsSeeded) {
      memberList = [...memberList, ...makeDefaultCustomFronts()];
      mergedSettings.customFrontsSeeded = true;
      await store.setBatch({ [KEYS.members]: memberList, [KEYS.settings]: mergedSettings });
    }
    let front = migrateFrontState(frontRaw);
    const archivedFrontIds = new Set(memberList.filter(m => m.archived).map(m => m.id));
    if (front && archivedFrontIds.size > 0) {
      const pruneTier = (tier: any) => tier ? {...tier, memberIds: (tier.memberIds || []).filter((id: string) => !archivedFrontIds.has(id))} : tier;
      const next: any = {...front, primary: pruneTier(front.primary), coFront: pruneTier(front.coFront), coConscious: pruneTier(front.coConscious)};
      const count = (f: any) => (f?.primary?.memberIds?.length || 0) + (f?.coFront?.memberIds?.length || 0) + (f?.coConscious?.memberIds?.length || 0);
      if (count(next) !== count(front)) {
        front = isFrontEmpty(next) ? null : next;
        await store.set(KEYS.front, front);
      }
    }
    const allPalettes = [...BUILTIN_PALETTES, ...(palettes || [])];
    const activePalette = allPalettes.find(p => p.id === mergedSettings.activePaletteId) || DARK_PALETTE;
    const theme = deriveTheme(activePalette.bg, activePalette.accent, activePalette.text, activePalette.mid);
    applyThemeToDOM(theme);
    applyTextScale(mergedSettings.textScale);
    applyFontChoice(mergedSettings.fontChoice ?? (mergedSettings.useDyslexicFont === true ? 'opendyslexic' : 'default'));
    changeLanguage(mergedSettings.language);

    setState({
      system: system || { name: '', description: '' },
      members: memberList,
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
  useEffect(() => startMedicalReminders(), []);

  const systemName = state.system.name || 'Plural Star';

  const isSinglet = state.settings.accountMode === 'singlet';
  const selfMember = isSinglet
    ? (state.members.find(m => m.id === state.settings.selfMemberId && !m.isCustomFront)
      || state.members.find(m => !m.isCustomFront && !m.archived))
    : undefined;
  const statuses = singletStatuses(state.members);

  const ensureSelfMember = async (): Promise<Member> => {
    if (selfMember) {
      if (selfMember.id !== state.settings.selfMemberId) {
        await store.set(KEYS.settings, { ...state.settings, selfMemberId: selfMember.id });
        await loadData();
      }
      return selfMember;
    }
    const nm: Member = { id: uid(), name: state.system.name || 'Me', pronouns: '', role: '', color: '#DAA520', description: '', tags: [], groupIds: [], customFields: [], createdAt: Date.now() };
    await store.set(KEYS.members, [...state.members, nm]);
    await store.set(KEYS.settings, { ...state.settings, selfMemberId: nm.id });
    await loadData();
    return nm;
  };

  const saveQuickFront = async (p: any, cf: any, cc: any) => {
    await applyFrontUpdate(state.front, p, cf, cc);
    loadData();
  };

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
            {isSinglet ? (
              <StatusTile
                front={state.front}
                members={state.members}
                selfId={selfMember?.id}
                onClick={() => setView('front')}
                onUpdateStatus={async () => { await ensureSelfMember(); setShowQuickFront(true); }}
              />
            ) : (
              <FrontTile
                front={state.front}
                members={state.members}
                onClick={() => setView('front')}
                onUpdateFront={() => setShowQuickFront(true)}
              />
            )}
            {!isSinglet && (
              <SystemManagerTile
                groups={state.groups}
                onClick={() => setView('system-manager')}
              />
            )}
            {!isSinglet && (
              <SystemMapTile
                onClick={() => { setMapFocus(null); setView('system-map'); }}
              />
            )}
            <MedicalTile onClick={() => setView('medical')} />
            {isSinglet ? (
              <ProfileTile
                member={selfMember}
                statuses={statuses}
                onClick={() => setView('members')}
              />
            ) : (
              <MembersTile
                members={state.members}
                onClick={() => setView('members')}
              />
            )}
            <HistoryTile
              history={state.history}
              members={state.members}
              onClick={() => setView('history')}
            />
            <RetroHistoryTile
              onClick={() => setView('retro-history')}
            />
            <JournalTile
              journal={state.journal}
              members={state.members}
              onClick={() => setView('journal')}
            />
            {!isSinglet && (
              <ChatTile
                channels={state.channels}
                members={state.members}
                onClick={() => setView('chat')}
              />
            )}
            <StatsTile
              history={state.history}
              members={state.members}
              onClick={() => setView('stats')}
            />
            <ImportExportTile
              onClick={() => setView('import-export')}
            />
            {!isSinglet && (
              <CustomFieldsTile
                onClick={() => setView('custom-fields')}
              />
            )}
            {!isSinglet && (
              <PollsTile
                onClick={() => setView('polls')}
              />
            )}
            {!isSinglet && (
              <ArchiveTile
                members={state.members}
                onClick={() => setView('archive')}
              />
            )}
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
              {view === 'front' ? (isSinglet ? t('tabs.status') : t('tabs.front'))
                : view === 'members' ? (isSinglet ? t('tabs.profile') : t('members.title'))
                : view === 'history' ? t('history.title')
                : view === 'journal' ? t('journal.title')
                : view === 'chat' ? t('hub.systemChat')
                : view === 'stats' ? t('hub.statistics')
                : view === 'import-export' ? t('hub.importExport')
                : view === 'settings' ? t('modal.systemSettings')
                : view === 'custom-fields' ? t('customFields.title')
                : view === 'polls' ? t('polls.title')
                : view === 'credits' ? t('hub.credits', { defaultValue: 'Credits' })
                : view === 'system-manager' ? t('systemManager.title')
                : view === 'system-map' ? t('systemMap.title')
                : view === 'medical' ? t('medical.title')
                : view === 'archive' ? t('hub.archive')
                : view === 'retro-history' ? t('hub.retroHistory')
                : view}
            </span>
          </div>
          <div className="full-view__content">
            {view === 'settings' && (
              <SettingsView system={state.system} settings={state.settings} palettes={state.palettes} onUpdate={loadData} />
            )}
            {view === 'members' && (isSinglet ? (
              <ProfileView member={selfMember} statuses={statuses} front={state.front}
                members={state.members} onUpdate={loadData} onEnsureSelf={ensureSelfMember} />
            ) : (
              <MembersView members={state.members} groups={state.groups} settings={state.settings} onUpdate={loadData}
                focusMemberId={memberFocus} onFocusHandled={() => setMemberFocus(null)}
                onShowOnMap={(id) => { setMapFocus(id); setView('system-map'); }} />
            ))}
            {view === 'archive' && (
              <MembersView members={state.members} groups={state.groups} settings={state.settings} onUpdate={loadData} archiveOnly />
            )}
            {view === 'retro-history' && (
              <RetroHistoryView members={state.members} history={state.history} front={state.front}
                onUpdate={loadData} onDone={() => setView('dashboard')}
                singlet={isSinglet} selfId={selfMember?.id} />
            )}
            {view === 'import-export' && (
              <ImportExportView system={state.system} members={state.members} history={state.history}
                journal={state.journal} settings={state.settings} channels={state.channels}
                palettes={state.palettes} onUpdate={loadData} />
            )}
            {view === 'stats' && (
              <StatsView history={state.history} members={state.members} channels={state.channels}
                singlet={isSinglet} selfId={selfMember?.id} />
            )}
            {view === 'journal' && (
              <JournalView journal={state.journal} members={state.members} onUpdate={loadData} />
            )}
            {view === 'history' && (
              <HistoryView history={state.history} members={state.members} onUpdate={loadData}
                singlet={isSinglet} selfId={selfMember?.id} />
            )}
            {view === 'front' && (isSinglet ? (
              <StatusView front={state.front} members={state.members} statuses={statuses}
                selfId={selfMember?.id} settings={state.settings} onSaveStatus={saveQuickFront}
                onEnsureSelf={ensureSelfMember} />
            ) : (
              <FrontView front={state.front} members={state.members} groups={state.groups}
                history={state.history} settings={state.settings} onUpdate={loadData} />
            ))}
            {view === 'system-manager' && (
              <SystemManagerView members={state.members} groups={state.groups}
                onViewMember={(id) => { setMemberFocus(id); setView('members'); }} onUpdate={loadData} />
            )}
            {view === 'system-map' && (
              <SystemMapView members={state.members} focusMemberId={mapFocus}
                onViewMember={(id) => { setMemberFocus(id); setView('members'); }} />
            )}
            {view === 'medical' && (
              <MedicalView onUpdate={loadData} />
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

      {isSinglet ? (
        <SetStatusModal
          open={showQuickFront}
          onClose={() => setShowQuickFront(false)}
          onSave={saveQuickFront}
          statuses={statuses}
          selfId={selfMember?.id}
          current={state.front}
          settings={state.settings}
        />
      ) : (
        <SetFrontModal
          open={showQuickFront}
          onClose={() => setShowQuickFront(false)}
          onSave={saveQuickFront}
          members={state.members.filter(m => !m.archived)}
          groups={state.groups}
          current={state.front}
          settings={state.settings}
          allMoods={[...DEFAULT_MOODS, ...(state.settings.customMoods || [])]}
        />
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
