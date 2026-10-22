import { useState, useRef, useEffect, useId } from 'react';
import type React from 'react';
import { errorMessage, log, logError } from '../utils/log';
import { useTranslation } from 'react-i18next';
import { Btn, Section, ConfirmDialog, SrOnly, StatusBanner, StatusMsg, linkButton } from '../components/ui';
import { ImportWaitOverlay } from '../components/ImportWaitOverlay';
import { ImportControl, ImportProgress } from '../import/progress';
import { store } from '../storage';
import { NetworkManager } from '../network/NetworkManager';
import { CloudServices } from '../cloud/cloudPlatform';
import { ExportPayload, fmtNum } from '../utils';
import type { ExtPreview } from '../import/preview';
import type { ImportCtx } from '../import/ctx';
import { useFlash } from '../hooks/useFlash';
import { BACKUP_CATEGORIES, BackupCategory, allCategories } from '../export/backupCategories';
import { handleExport, handlePluralKitExport } from '../export/backupExport';
import { handlePickBackup, handleRestore, restoreAvailability } from '../import/restore';
import { handleImportSP } from '../import/simplyPlural';
import { handleImportForeign } from '../import/foreign';
import { handleImportPluralSpace } from '../import/pluralspace';
import { handleImportPluralLog } from '../import/plurallog';
import { handleTokenFetch, handleTokenImport } from '../import/pluralkit';
import { useAppStore } from '../store/appStore';
import { loadAll } from '../store/boot';

type ExtKey = 'system' | 'members' | 'avatars' | 'frontHistory' | 'customFields' | 'groups' | 'displayNames' | 'pronouns';

const MIN_IMPORT_PHASES = 3;

const PANEL: React.CSSProperties = { padding: 16, background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16 };
const HINT: React.CSSProperties = { fontSize: 13, color: 'var(--dim)', marginBottom: 12, lineHeight: 1.5 };
const LIST: React.CSSProperties = { background: 'var(--card)', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 12 };
const ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid var(--border)' };

function ImportSection({ label, hint, action, importing, onPick }: { label: string; hint: string; action: string; importing: boolean; onPick: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      <Section label={label} />
      <div style={PANEL}>
        <p style={HINT}>{hint}</p>
        <Btn onClick={onPick} disabled={importing}>{importing ? t('share.importing') : action}</Btn>
      </div>
    </>
  );
}

export default function ImportExportView() {
  const onUpdate = () => { loadAll().catch(e => log.error('store', 'reload failed:', e)); };
  const system = useAppStore(s => s.system);
  const members = useAppStore(s => s.members);
  const history = useAppStore(s => s.history);
  const journal = useAppStore(s => s.journal);
  const settings = useAppStore(s => s.settings);
  const channels = useAppStore(s => s.channels);
  const palettes = useAppStore(s => s.palettes);
  const { t } = useTranslation();
  const [status, flashStatus] = useFlash<StatusMsg>(4000);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const importControlRef = useRef<ImportControl | null>(null);
  const beginImport = (phases: number) => {
    const planned = Math.max(MIN_IMPORT_PHASES, phases);
    const control = new ImportControl(setImportProgress);
    control.plan(planned);
    importControlRef.current = control;
    setImportProgress({ label: '', phase: 0, phases: planned });
    return control;
  };
  useEffect(() => {
    if (!importing) {
      importControlRef.current = null;
      setImportProgress(null);
    }
  }, [importing]);
  const [restoreData, setRestoreData] = useState<ExportPayload | null>(null);
  const [restoreFile, setRestoreFile] = useState<string | null>(null);
  const [restoreSel, setRestoreSel] = useState(() => allCategories(true));
  const togR = (k: BackupCategory) => setRestoreSel(s => ({ ...s, [k]: !s[k] }));
  const [mergeLogs, setMergeLogs] = useState(false);

  const [exportSel, setExportSel] = useState(() => allCategories(false));
  const togExp = (k: BackupCategory) => setExportSel(s => ({ ...s, [k]: !s[k] }));
  const [showExportOptions, setShowExportOptions] = useState(false);

  const showStatus = (msg: string, error = false) => flashStatus({ msg, error });

  const [extToken, setExtToken] = useState('');
  const [extLoading, setExtLoading] = useState(false);
  const [extPreview, setExtPreview] = useState<ExtPreview | null>(null);
  const [extSel, setExtSel] = useState<Record<ExtKey, boolean>>({ system: true, members: true, avatars: true, frontHistory: true, customFields: true, groups: true, displayNames: true, pronouns: true });
  const [importMode, setImportMode] = useState<'overwrite' | 'update'>('overwrite');
  const togE = (k: ExtKey) => setExtSel(s => ({ ...s, [k]: !s[k] }));

  const [confirmClear, setConfirmClear] = useState(false);
  const exportOptionsId = useId();
  const clearActionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (confirmClear) clearActionsRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [confirmClear]);

  const [pendingOverwrite, setPendingOverwrite] = useState<{ title: string; run: () => void } | null>(null);
  const confirmOverwrite = (title: string, run: () => void) => {
    if (importMode !== 'overwrite') { run(); return; }
    setPendingOverwrite({ title, run });
  };

  const ctx: ImportCtx = {
    system, members, history, journal, settings, channels, palettes, onUpdate, t, showStatus, setImporting,
    showExportOptions, exportSel, restoreData, setRestoreData, setRestoreFile, restoreSel, mergeLogs,
    extToken, setExtToken, setExtLoading, extPreview, setExtPreview, extSel, importMode,
  };

  const clearAllData = async () => {
    setConfirmClear(false);
    try {
      await CloudServices.unlink().catch(e => logError('reset', e));
      await store.clearAll();
      await NetworkManager.wipe().catch(e => logError('reset', e));
      showStatus(t('share.statusAllCleared'));
    } catch (e) {
      showStatus(errorMessage(e), true);
    }
    onUpdate();
  };

  const importOther = (label: string, hint: string, action: string, run: () => void) => (
    <ImportSection label={label} hint={hint} action={action} importing={importing} onPick={() => confirmOverwrite(t('share.importSelected'), run)} />
  );

  const extRows: [ExtKey, string, boolean][] = extPreview ? [
    ['system', t('share.systemNameDesc'), true],
    ['members', t('share.memberProfiles'), extPreview.members.length > 0],
    ['displayNames', t('share.usePkDisplayNames'), true],
    ['pronouns', t('share.importPronouns'), true],
    ['avatars', t('share.profilePictures'), extPreview.members.length > 0],
    ['frontHistory', t('share.frontHistory'), extPreview.switches.length > 0],
  ] : [];

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <ImportWaitOverlay
        visible={importing}
        progress={importProgress}
        onCancel={importControlRef.current ? () => importControlRef.current?.requestStop() : undefined}
      />
      <StatusBanner status={status} style={{ padding: '10px 16px', marginBottom: 16 }} />

      <Section label={t('share.backup')} />
      <div style={PANEL}>
        <p style={HINT}>{t('share.exportDesc')}</p>
        <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>
          <span>{t('share.membersCountSimple', { count: members.filter(m => !m.deleted).length })}</span>
          <span aria-hidden>·</span>
          <span>{t('share.historyCount', { count: history.length })}</span>
          <span aria-hidden>·</span>
          <span>{t('share.journalCount', { count: journal.length })}</span>
        </div>

        <button type="button" style={{ ...linkButton('var(--accent)', 12), padding: '4px 0', marginBottom: 8, fontWeight: 500 }}
          aria-expanded={showExportOptions} aria-controls={showExportOptions ? exportOptionsId : undefined}
          onClick={() => setShowExportOptions(!showExportOptions)}>
          <span aria-hidden>{showExportOptions ? '▾' : '▸'}</span> {t('share.customizeExport')}
        </button>

        {showExportOptions && (
          <div id={exportOptionsId} style={LIST}>
            {BACKUP_CATEGORIES.map(([k, labelKey]) => (
              <label key={k} style={{ ...ROW, cursor: 'pointer' }}>
                <input type="checkbox" checked={exportSel[k]} onChange={() => togExp(k)} />
                <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{t(labelKey)}</span>
              </label>
            ))}
          </div>
        )}

        <Btn variant="solid" onClick={() => handleExport(ctx)}>{t('share.exportBackup')}</Btn>
        <div style={{ marginTop: 8 }}>
          <Btn variant="ghost" onClick={() => handlePluralKitExport(ctx)}>{t('share.exportPluralKit')}</Btn>
        </div>
        <p style={{ fontSize: 11, color: 'var(--dim)', marginTop: 6, lineHeight: 1.4 }}>
          {t('share.pkExportHint')}
        </p>
      </div>

      <Section label={t('share.importMode')} />
      <div style={PANEL}>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['overwrite', 'update'] as const).map(m => (
            <button key={m} type="button" onClick={() => setImportMode(m)} aria-pressed={importMode === m}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, background: importMode === m ? 'var(--accent-bg)' : 'transparent', color: importMode === m ? 'var(--accent)' : 'var(--dim)', border: `1px solid ${importMode === m ? 'var(--accent)' : 'var(--border)'}` }}>
              {t(m === 'overwrite' ? 'share.importModeOverwrite' : 'share.importModeUpdate')}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, marginBottom: 0, lineHeight: 1.4 }}>
          {t(importMode === 'overwrite' ? 'share.importModeOverwriteHint' : 'share.importModeUpdateHint')}
        </p>
      </div>

      <Section label={t('share.restore')} />
      <div style={PANEL}>
        <p style={HINT}>{t('share.restoreDesc')}</p>
        <Btn onClick={() => handlePickBackup(ctx)}>
          {restoreFile || t('share.importPSBackup')}
        </Btn>
        {restoreData && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--dim)', fontWeight: 600, marginBottom: 8 }}>
              {t('share.restoreCategories')}
            </div>
            <div style={LIST}>
              {BACKUP_CATEGORIES.map(([k, labelKey]) => {
                const { avail, count } = restoreAvailability(restoreData, k);
                return (
                  <label key={k} style={{ ...ROW, opacity: avail ? 1 : 0.4, cursor: avail ? 'pointer' : 'default' }}>
                    <input type="checkbox" checked={avail && restoreSel[k]} disabled={!avail} onChange={() => togR(k)} />
                    <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{t(labelKey)}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {avail ? (count !== null ? fmtNum(count, 0) : <><span aria-hidden>✓</span><SrOnly>{t('common.included')}</SrOnly></>) : t('common.notInExport')}
                    </span>
                  </label>
                );
              })}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 10px', fontSize: 12, color: 'var(--dim)', cursor: 'pointer' }}>
              <input type="checkbox" checked={mergeLogs} onChange={() => setMergeLogs(v => !v)} />
              {t('share.mergeLogs')}
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="ghost" onClick={() => { setRestoreData(null); setRestoreFile(null); }}>{t('common.cancel')}</Btn>
              <Btn variant="danger" onClick={() => confirmOverwrite(t('share.restoreSelectedData'), () => handleRestore({ ...ctx, control: beginImport(Object.values(restoreSel).filter(Boolean).length) }))} disabled={importing}>
                {importing ? t('share.importing') : t('share.restoreSelectedData')}
              </Btn>
            </div>
          </div>
        )}
      </div>

      {importOther(t('share.spImport'), t('share.spMergeDesc'), t('share.importFromSP'), () => handleImportSP({ ...ctx, control: beginImport(5) }))}
      {importOther(t('share.importOtherApps'), t('share.importOtherAppsDesc'), t('share.importFromOtherApp'), () => handleImportForeign({ ...ctx, control: beginImport(4) }))}
      {importOther(t('share.psImport'), t('share.psHint'), t('share.pickPsFile'), () => handleImportPluralSpace(ctx))}
      {importOther(t('share.pluralLog'), t('share.plurallogHint'), t('share.plurallogPick'), () => handleImportPluralLog(ctx))}

      <Section label={t('share.pkImportToken')} />
      <div style={PANEL}>
        <p style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 10, lineHeight: 1.5 }}>
          {t('share.pkTokenHint')}
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input className="field__input" value={extToken} onChange={e => setExtToken(e.target.value)}
            aria-label={t('share.pkTokenPlaceholder')} placeholder={t('share.pkTokenPlaceholder')}
            style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }} />
          <Btn onClick={() => handleTokenFetch(ctx)} disabled={extLoading}>
            {extLoading ? t('share.fetching') : t('share.fetchData')}
          </Btn>
        </div>
        {extPreview && (
          <div style={{ background: 'var(--card)', borderRadius: 8, border: '1px solid var(--border)', padding: 12, marginTop: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
              {t('share.membersCount', { count: extPreview.members.length })} · {t('share.frontEntries', { count: extPreview.switches.length })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {extRows.map(([k, label, avail]) => (
                <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: avail ? 1 : 0.4, cursor: avail ? 'pointer' : 'default' }}>
                  <input type="checkbox" checked={avail && extSel[k]} disabled={!avail} onChange={() => togE(k)} />
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>{label}</span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="ghost" onClick={() => { setExtPreview(null); setExtToken(''); }}>{t('common.cancel')}</Btn>
              <Btn variant="solid" onClick={() => confirmOverwrite(t('share.importSelected'), () => handleTokenImport({ ...ctx, control: beginImport(Object.values(extSel).filter(Boolean).length) }))} disabled={importing}>
                {importing ? t('share.importing') : t('share.importSelected')}
              </Btn>
            </div>
          </div>
        )}
      </div>

      <Section label={t('share.dangerZone')} color="var(--danger)" />
      <div style={{ padding: 16, background: 'var(--danger-bg)', borderRadius: 8, border: '1px solid var(--danger)', marginBottom: 16 }}>
        {!confirmClear ? (
          <>
            <p style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12, lineHeight: 1.5 }}>
              {t('share.clearAllDataDesc')}
            </p>
            <Btn variant="danger" onClick={() => setConfirmClear(true)}>{t('share.clearAllData')}</Btn>
          </>
        ) : (
          <>
            <p role="alert" style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12, fontWeight: 600 }}>
              {t('share.clearAllConfirm')}
            </p>
            <div ref={clearActionsRef} style={{ display: 'flex', gap: 8 }}>
              <Btn variant="ghost" onClick={() => setConfirmClear(false)}>{t('common.cancel')}</Btn>
              <Btn variant="danger" onClick={() => void clearAllData()}>{t('share.yesDeleteEverything')}</Btn>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog open={!!pendingOverwrite} title={pendingOverwrite?.title || ''} message={t('share.importModeOverwriteHint')} danger
        onConfirm={() => { const run = pendingOverwrite?.run; setPendingOverwrite(null); run?.(); }}
        onCancel={() => setPendingOverwrite(null)} />
    </div>
  );
}
