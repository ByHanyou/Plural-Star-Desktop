import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Btn, Section } from '../components/ui';
import { store, KEYS, chatMsgKey } from '../storage';
import {
  Member, HistoryEntry, JournalEntry, SystemInfo, AppSettings, ChatChannel, ChatMessage,
  ExportPayload, CustomFieldDef, CustomFieldType, MemberGroup, NoteboardEntry, MemberPoll, uid, DEFAULT_CHANNELS,
  parallelMap,
} from '../utils';
import { CustomPalette } from '../theme';
import { detectForeignFormat, convertOurcana, convertMultiplicity, convertOctocon, convertAmpar, ConvertedImport, detectPluralSpace, convertPluralSpace } from '../importers';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';

import { extFromDataUri, dataUriToBytes, u8ToBase64, bytesToDataUri, buildPluralKitExport, spAvatarUrl, inlineRemoteAvatars } from '../exportUtils';
import { handleExport, handlePluralKitExport, handlePickBackup, handleRestore } from '../import/backup';
import { handleImportSP, handleImportForeign, handleImportPluralSpace, handleTokenFetch, handleTokenImport } from '../import/apps';
import { useAppStore } from '../store/appStore';

interface ExportCategories {
  system: boolean; members: boolean; avatars: boolean; banners: boolean; frontHistory: boolean; journal: boolean;
  groups: boolean; chat: boolean; moods: boolean; palettes: boolean; settings: boolean;
  customFields: boolean; noteboards: boolean; polls: boolean; journalTemplates: boolean;
}

interface Props {
  onUpdate: () => void;
}

export default function ImportExportView({ onUpdate }: Props) {
  const system = useAppStore(s => s.state.system);
  const members = useAppStore(s => s.state.members);
  const history = useAppStore(s => s.state.history);
  const journal = useAppStore(s => s.state.journal);
  const settings = useAppStore(s => s.state.settings);
  const channels = useAppStore(s => s.state.channels);
  const palettes = useAppStore(s => s.state.palettes);
  const { t } = useTranslation();
  const [status, setStatus] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [restoreData, setRestoreData] = useState<ExportPayload | null>(null);
  const [restoreFile, setRestoreFile] = useState<string | null>(null);
  const [restoreSel, setRestoreSel] = useState({
    system: true, members: true, avatars: true, banners: true, frontHistory: true, journal: true,
    groups: true, chat: true, moods: true, palettes: true, settings: true,
    customFields: true, noteboards: true, polls: true, journalTemplates: true,
  });
  const togR = (k: string) => setRestoreSel(s => ({ ...s, [k]: !s[k as keyof typeof s] }));
  const [mergeLogs, setMergeLogs] = useState(false);

  const [exportSel, setExportSel] = useState<ExportCategories>({
    system: true, members: true, avatars: true, banners: true, frontHistory: true, journal: true,
    groups: true, chat: true, moods: true, palettes: true, settings: true,
    customFields: true, noteboards: true, polls: true, journalTemplates: true,
  });
  const togExp = (k: keyof ExportCategories) => setExportSel(s => ({ ...s, [k]: !s[k] }));
  const [showExportOptions, setShowExportOptions] = useState(false);

  const showStatus = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(null), 4000);
  };

  const [extSource, setExtSource] = useState<'sp' | 'pk'>('sp');
  const [extToken, setExtToken] = useState('');
  const [extLoading, setExtLoading] = useState(false);
  const [extPreview, setExtPreview] = useState<{members: any[]; switches: any[]; system: any; customFields?: any[]; groups?: any[]} | null>(null);
  const [extSel, setExtSel] = useState({system: true, members: true, avatars: true, frontHistory: true, customFields: true, groups: true, displayNames: true});
  const togE = (k: string) => setExtSel(s => ({...s, [k]: !s[k as keyof typeof s]}));

  const spGet = async (url: string, headers: Record<string, string>): Promise<any | null> => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await window.electronAPI.net.fetch(url, { headers }).catch(() => null);
      if (res && res.ok) { try { return JSON.parse(res.text); } catch { return null; } }
      if (res && (res.status === 401 || res.status === 403)) return null;
      console.log(`[SP-FETCH] ${url} -> ${res ? res.status : 'network error'} (attempt ${attempt + 1})`);
      if (attempt < 2) await new Promise<void>(r => setTimeout(() => r(), 700 * (attempt + 1)));
    }
    return null;
  };

  const [confirmClear, setConfirmClear] = useState(false);

  const clearAllData = async () => {
    await store.clearAll();
    setConfirmClear(false);
    showStatus('All data cleared');
    onUpdate();
  };

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      {status && (
        <div style={{
          padding: '10px 16px', marginBottom: 16, borderRadius: 8,
          background: status.startsWith('Error') ? 'var(--danger-bg)' : 'var(--success-bg)',
          border: `1px solid ${status.startsWith('Error') ? 'var(--danger)' : 'var(--success)'}`,
          color: status.startsWith('Error') ? 'var(--danger)' : 'var(--success)',
          fontSize: 13,
        }}>
          {status}
        </div>
      )}

      <Section label={t('share.backup')} />
      <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 12, lineHeight: 1.5 }}>
          {t('share.exportDesc')}
        </p>
        <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>
          <span>{t('share.membersCountSimple', { count: members.length })}</span>
          <span>·</span>
          <span>{t('share.historyCount', { count: history.length })}</span>
          <span>·</span>
          <span>{t('share.journalCount', { count: journal.length })}</span>
        </div>

        <button style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', padding: '4px 0', marginBottom: 8, fontWeight: 500 }}
          onClick={() => setShowExportOptions(!showExportOptions)}>
          {showExportOptions ? '▾' : '▸'} {t('share.customizeExport')}
        </button>

        {showExportOptions && (
          <div style={{ background: 'var(--card)', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 12 }}>
            {([
              ['system', t('share.systemNameDesc')],
              ['members', t('share.memberProfiles')],
              ['avatars', t('share.profilePictures')],
              ['banners', t('share.banners')],
              ['frontHistory', t('share.frontHistory')],
              ['journal', t('share.journalEntries')],
              ['groups', t('share.memberGroups')],
              ['chat', t('share.chatData')],
              ['moods', t('share.customMoodsLabel')],
              ['palettes', t('share.themePalettes')],
              ['settings', t('share.appSettings')],
              ['customFields', t('customFields.title')],
              ['noteboards', t('noteboard.title')],
              ['polls', t('polls.title')],
              ['journalTemplates', t('journal.templatesTab', { defaultValue: 'Templates' })],
            ] as [keyof ExportCategories, string][]).map(([k, label]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                <input type="checkbox" checked={exportSel[k]} onChange={() => togExp(k)} />
                <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{label}</span>
              </label>
            ))}
          </div>
        )}

        <Btn variant="solid" onClick={() => handleExport({ system, members, history, journal, settings, channels, palettes, onUpdate, t, showStatus, setImporting, showExportOptions, exportSel, restoreData, setRestoreData, setRestoreFile, restoreSel, mergeLogs, extSource, extToken, setExtToken, setExtLoading, extPreview, setExtPreview, extSel, spGet })}>{t('share.exportBackup')}</Btn>
        <div style={{ marginTop: 8 }}>
          <Btn variant="ghost" onClick={() => handlePluralKitExport({ system, members, history, journal, settings, channels, palettes, onUpdate, t, showStatus, setImporting, showExportOptions, exportSel, restoreData, setRestoreData, setRestoreFile, restoreSel, mergeLogs, extSource, extToken, setExtToken, setExtLoading, extPreview, setExtPreview, extSel, spGet })}>{t('share.exportPluralKit', { defaultValue: '↓ PluralKit / Tupperbox' })}</Btn>
        </div>
        <p style={{ fontSize: 11, color: 'var(--dim)', marginTop: 6, lineHeight: 1.4 }}>
          {t('share.pkExportHint', { defaultValue: 'Exports members and front history as a PluralKit-format file for pk;import (PluralKit) or tul!import (Tupperbox). Avatars only carry over if they are image links, and proxy tags are left blank to set up in the bot.' })}
        </p>
      </div>

      <Section label={t('share.restore')} />
      <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 12, lineHeight: 1.5 }}>
          {t('share.restoreDesc')}
        </p>
        <Btn onClick={() => handlePickBackup({ system, members, history, journal, settings, channels, palettes, onUpdate, t, showStatus, setImporting, showExportOptions, exportSel, restoreData, setRestoreData, setRestoreFile, restoreSel, mergeLogs, extSource, extToken, setExtToken, setExtLoading, extPreview, setExtPreview, extSel, spGet })}>
          {restoreFile || t('share.importPSBackup')}
        </Btn>
        {restoreData && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--dim)', fontWeight: 600, marginBottom: 8 }}>
              {t('share.restoreCategories')}
            </div>
            <div style={{ background: 'var(--card)', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 12 }}>
              {([
                ['system', t('share.systemNameDesc'), !!restoreData.system, null],
                ['members', t('share.memberProfiles'), !!restoreData.members, restoreData.members?.length],
                ['avatars', t('share.profilePictures'), !!(restoreData.avatars && Object.keys(restoreData.avatars).length > 0) || !!(restoreData.members?.some((m: any) => m.avatar)), restoreData.avatars ? Object.keys(restoreData.avatars).length : restoreData.members?.filter((m: any) => m.avatar).length || 0],
                ['banners', t('share.banners'), !!(restoreData.banners && Object.keys(restoreData.banners).length > 0) || !!(restoreData.members?.some((m: any) => m.banner)), restoreData.banners ? Object.keys(restoreData.banners).length : restoreData.members?.filter((m: any) => m.banner).length || 0],
                ['frontHistory', t('share.frontHistory'), !!restoreData.frontHistory, restoreData.frontHistory?.length],
                ['journal', t('share.journalEntries'), !!restoreData.journal, restoreData.journal?.length],
                ['groups', t('share.memberGroups'), !!restoreData.groups?.length, restoreData.groups?.length],
                ['chat', t('share.chatData'), !!restoreData.chatChannels?.length, restoreData.chatChannels?.length],
                ['moods', t('share.customMoodsLabel'), !!(restoreData.customMoods?.length || restoreData.settings?.customMoods?.length), restoreData.customMoods?.length || restoreData.settings?.customMoods?.length || 0],
                ['palettes', t('share.themePalettes'), !!restoreData.palettes?.length, restoreData.palettes?.length],
                ['settings', t('share.appSettings'), !!restoreData.settings, null],
                ['customFields', t('customFields.title'), !!restoreData.customFieldDefs?.length, restoreData.customFieldDefs?.length || 0],
                ['noteboards', t('noteboard.title'), !!restoreData.noteboards?.length, restoreData.noteboards?.length || 0],
                ['polls', t('polls.title'), !!restoreData.polls?.length, restoreData.polls?.length || 0],
                ['journalTemplates', t('journal.templatesTab', { defaultValue: 'Templates' }), !!restoreData.journalTemplates?.length, restoreData.journalTemplates?.length || 0],
              ] as [string, string, boolean, number | null][]).map(([k, label, avail, count]) => (
                <label key={k} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                  borderBottom: '1px solid var(--border)', opacity: avail ? 1 : 0.4,
                  cursor: avail ? 'pointer' : 'default',
                }}>
                  <input type="checkbox" checked={avail && restoreSel[k as keyof typeof restoreSel]}
                    disabled={!avail} onChange={() => togR(k)} />
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{label}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {avail ? (count !== null ? `${count}` : '✓') : t('common.notInExport')}
                  </span>
                </label>
              ))}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 10px', fontSize: 12, color: 'var(--dim)', cursor: 'pointer' }}>
              <input type="checkbox" checked={mergeLogs} onChange={() => setMergeLogs(v => !v)} />
              {t('share.mergeLogs')}
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="ghost" onClick={() => { setRestoreData(null); setRestoreFile(null); }}>{t('common.cancel')}</Btn>
              <Btn variant="danger" onClick={() => handleRestore({ system, members, history, journal, settings, channels, palettes, onUpdate, t, showStatus, setImporting, showExportOptions, exportSel, restoreData, setRestoreData, setRestoreFile, restoreSel, mergeLogs, extSource, extToken, setExtToken, setExtLoading, extPreview, setExtPreview, extSel, spGet })} disabled={importing}>
                {importing ? t('share.importing') : t('share.restoreSelectedData')}
              </Btn>
            </div>
          </div>
        )}
      </div>

      <Section label={t('share.spImport')} />
      <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 12, lineHeight: 1.5 }}>
          {t('share.spMergeDesc')}
        </p>
        <Btn onClick={() => handleImportSP({ system, members, history, journal, settings, channels, palettes, onUpdate, t, showStatus, setImporting, showExportOptions, exportSel, restoreData, setRestoreData, setRestoreFile, restoreSel, mergeLogs, extSource, extToken, setExtToken, setExtLoading, extPreview, setExtPreview, extSel, spGet })} disabled={importing}>
          {importing ? t('share.importing') : t('share.importFromSP')}
        </Btn>
      </div>

      <Section label={t('share.importOtherApps', { defaultValue: 'Import from another app' })} />
      <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 12, lineHeight: 1.5 }}>
          {t('share.importOtherAppsDesc', { defaultValue: 'Import members and fronting history from Ourcana, HiveMind, or Octocon (.json), or Ampersand (.ampar).' })}
        </p>
        <Btn onClick={() => handleImportForeign({ system, members, history, journal, settings, channels, palettes, onUpdate, t, showStatus, setImporting, showExportOptions, exportSel, restoreData, setRestoreData, setRestoreFile, restoreSel, mergeLogs, extSource, extToken, setExtToken, setExtLoading, extPreview, setExtPreview, extSel, spGet })} disabled={importing}>
          {importing ? t('share.importing') : t('share.importFromOtherApp', { defaultValue: 'Pick file (.json / .ampar)' })}
        </Btn>
      </div>

      <Section label={t('share.psImport')} />
      <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 12, lineHeight: 1.5 }}>
          {t('share.psHint')}
        </p>
        <Btn onClick={() => handleImportPluralSpace({ system, members, history, journal, settings, channels, palettes, onUpdate, t, showStatus, setImporting, showExportOptions, exportSel, restoreData, setRestoreData, setRestoreFile, restoreSel, mergeLogs, extSource, extToken, setExtToken, setExtLoading, extPreview, setExtPreview, extSel, spGet })} disabled={importing}>
          {importing ? t('share.importing') : t('share.pickPsFile')}
        </Btn>
      </div>

      <Section label={t('share.spImport') + ' / ' + t('share.pkImport') + ' (Token)'} />
      <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Btn variant={extSource === 'sp' ? 'solid' : 'ghost'} onClick={() => { setExtSource('sp'); setExtPreview(null); setExtToken(''); }}>
            {t('share.simplyPlural')}
          </Btn>
          <Btn variant={extSource === 'pk' ? 'solid' : 'ghost'} onClick={() => { setExtSource('pk'); setExtPreview(null); setExtToken(''); }}>
            {t('share.pluralKit')}
          </Btn>
        </div>
        <p style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 10, lineHeight: 1.5 }}>
          {extSource === 'sp' ? t('share.spTokenHint') : t('share.pkTokenHint')}
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input className="field__input" value={extToken} onChange={e => setExtToken(e.target.value)}
            placeholder={extSource === 'sp' ? t('share.spTokenPlaceholder') : t('share.pkTokenPlaceholder')}
            style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }} />
          <Btn onClick={() => handleTokenFetch({ system, members, history, journal, settings, channels, palettes, onUpdate, t, showStatus, setImporting, showExportOptions, exportSel, restoreData, setRestoreData, setRestoreFile, restoreSel, mergeLogs, extSource, extToken, setExtToken, setExtLoading, extPreview, setExtPreview, extSel, spGet })} disabled={extLoading}>
            {extLoading ? t('share.fetching') : t('share.fetchData')}
          </Btn>
        </div>
        {extPreview && (
          <div style={{ background: 'var(--card)', borderRadius: 8, border: '1px solid var(--border)', padding: 12, marginTop: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
              {t('share.membersCount', {count: extPreview.members.length})} · {t('share.frontEntries', {count: extPreview.switches.length})}
              {extSource === 'sp' ? ` · ${t('share.customFieldsCount', {count: (extPreview.customFields || []).length})} · ${t('share.groupsCount', {count: (extPreview.groups || []).length})}` : ''}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {([
                ['system', t('share.systemNameDesc'), true],
                ['members', t('share.memberProfiles'), extPreview.members.length > 0],
                ...(extSource === 'pk' ? [['displayNames', t('share.usePkDisplayNames'), true]] as [string, string, boolean][] : []),
                ['avatars', t('share.profilePictures'), extPreview.members.length > 0],
                ['frontHistory', t('share.frontHistory'), extPreview.switches.length > 0],
                ...(extSource === 'sp' ? [
                  ['customFields', t('customFields.title'), (extPreview.customFields || []).length > 0],
                  ['groups', t('share.memberGroups'), (extPreview.groups || []).length > 0],
                ] as [string, string, boolean][] : []),
              ] as [string, string, boolean][]).map(([k, label, avail]) => (
                <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: avail ? 1 : 0.4, cursor: avail ? 'pointer' : 'default' }}>
                  <input type="checkbox" checked={avail && extSel[k as keyof typeof extSel]} disabled={!avail} onChange={() => togE(k)} />
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>{label}</span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="ghost" onClick={() => { setExtPreview(null); setExtToken(''); }}>{t('common.cancel')}</Btn>
              <Btn variant="solid" onClick={() => handleTokenImport({ system, members, history, journal, settings, channels, palettes, onUpdate, t, showStatus, setImporting, showExportOptions, exportSel, restoreData, setRestoreData, setRestoreFile, restoreSel, mergeLogs, extSource, extToken, setExtToken, setExtLoading, extPreview, setExtPreview, extSel, spGet })} disabled={importing}>
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
            <p style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12, fontWeight: 600 }}>
              {t('share.clearAllConfirm')}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="ghost" onClick={() => setConfirmClear(false)}>{t('common.cancel')}</Btn>
              <Btn variant="danger" onClick={clearAllData}>{t('share.yesDeleteEverything')}</Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
