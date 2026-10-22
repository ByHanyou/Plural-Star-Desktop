import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FrontTier, FrontTierKey, singletStatuses, findSelfMember } from './utils';
import { ImageCropHost } from './components/ImageCropModal';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { SaveErrorDialog } from './components/ui';
import { useAppStore } from './store/appStore';
import { useSaveGuard } from './hooks/useSaveGuard';
import { updateFront, quickAddToFront, removeFromFront, ensureSelfMember } from './store/actions';
import { Dashboard } from './dashboard/Dashboard';
import { ViewId, useViewTitle } from './app/views';
import { useUpdateCheck, useStartup, useBackgroundServices, useSyncReload, useSyncPrompts, useFrontShare, useViewFocus, useShellLabels } from './app/lifecycle';
import { TitleBar } from './app/TitleBar';
import { UpdateBanner } from './app/UpdateBanner';
import { ViewHost } from './app/ViewHost';
import { QuickFrontModal } from './app/QuickFrontModal';
import { SyncDialogs } from './app/SyncDialogs';

function AppInner() {
  const { t } = useTranslation();
  const [view, setView] = useState<ViewId>('dashboard');
  const [memberFocus, setMemberFocus] = useState<string | null>(null);
  const [mapFocus, setMapFocus] = useState<string | null>(null);
  const [showQuickFront, setShowQuickFront] = useState(false);
  const [saveError, runSave, clearSaveError] = useSaveGuard();
  const loaded = useAppStore(s => s.loaded);
  const members = useAppStore(s => s.members);
  const front = useAppStore(s => s.front);
  const settings = useAppStore(s => s.settings);
  useUpdateCheck(loaded);
  const loadError = useStartup();
  useBackgroundServices();
  useSyncReload();
  const syncPrompts = useSyncPrompts();

  const isSinglet = settings.accountMode === 'singlet';
  const viewTitle = useViewTitle(isSinglet);
  const selfMember = isSinglet
    ? findSelfMember(members, settings.selfMemberId)
    : undefined;
  const selfId = selfMember?.id;
  useFrontShare(loaded, front, members, selfId);
  const statuses = useMemo(() => singletStatuses(members), [members]);
  const { viewTitleRef, rememberTile } = useViewFocus(view);
  useShellLabels();

  const ensureSelf = () => ensureSelfMember(t('profile.defaultSelfName'));

  const saveQuickFront = (p: Partial<FrontTier>, cf: Partial<FrontTier>, cc: Partial<FrontTier>) => runSave(() => updateFront(p, cf, cc));

  const addToFront = (memberId: string, tier: FrontTierKey) => runSave(() => quickAddToFront(memberId, tier));

  const dropFromFront = (memberId: string) => runSave(() => removeFromFront(memberId));

  const openStatusEditor = () => runSave(async () => {
    await ensureSelf();
    setShowQuickFront(true);
  });

  const openMember = (id: string) => { setMemberFocus(id); setView('members'); };

  if (!loaded) {
    return (
      <div className="app-shell">
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {loadError ? (
            <div role="alert" style={{ textAlign: 'center', maxWidth: 480, padding: 24 }}>
              <p style={{ color: 'var(--text)', fontSize: 14, marginBottom: 12 }}>{t('errorBoundary.body')}</p>
              <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 20, whiteSpace: 'pre-wrap' }}>{loadError}</p>
              <button onClick={() => window.location.reload()} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'var(--bg)', fontSize: 14, cursor: 'pointer' }}>
                {t('errorBoundary.retry')}
              </button>
            </div>
          ) : (
            <span role="status" style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)', fontSize: 18 }}>
              {t('common.loading')}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <TitleBar isSinglet={isSinglet} viewTitle={view !== 'dashboard' ? viewTitle(view) : ''} onOpenProfile={() => setView('system-profile')} />

      <UpdateBanner />

      {view === 'dashboard' ? (
        <Dashboard isSinglet={isSinglet} selfMember={selfMember} selfId={selfId} statuses={statuses} viewTitle={viewTitle}
          onOpen={setView} onOpenMap={() => { setMapFocus(null); setView('system-map'); }}
          onUpdateFront={() => setShowQuickFront(true)} onUpdateStatus={openStatusEditor} onRemember={rememberTile} />
      ) : (
        <div className="full-view">
          <div className="full-view__header">
            <button className="full-view__back" onClick={() => setView('dashboard')}>
              {t('hub.dashboard')}
            </button>
            <span className="full-view__title" ref={viewTitleRef} role="heading" aria-level={1} tabIndex={-1}>
              {viewTitle(view)}
            </span>
          </div>
          <div className="full-view__content">
            <ViewHost view={view} isSinglet={isSinglet} selfMember={selfMember} selfId={selfId} statuses={statuses}
              memberFocus={memberFocus} mapFocus={mapFocus} onOpen={setView} onOpenMember={openMember}
              onShowOnMap={id => { setMapFocus(id); setView('system-map'); }} onMemberFocusHandled={() => setMemberFocus(null)}
              onQuickFront={addToFront} onRemoveFromFront={dropFromFront} onSaveStatus={saveQuickFront} onEnsureSelf={ensureSelf} />
          </div>
        </div>
      )}

      <QuickFrontModal open={showQuickFront} onClose={() => setShowQuickFront(false)} onSave={saveQuickFront}
        isSinglet={isSinglet} statuses={statuses} selfId={selfId} />

      <SyncDialogs syncConflict={syncPrompts.syncConflict} onConflictClosed={syncPrompts.clearSyncConflict}
        roleMismatch={syncPrompts.roleMismatch} onRoleMismatchClosed={syncPrompts.clearRoleMismatch} />

      <SaveErrorDialog error={saveError} onClose={clearSaveError} />

      <ImageCropHost />
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
