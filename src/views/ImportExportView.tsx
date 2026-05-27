import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Btn, Section } from '../components/ui';
import { store, KEYS, chatMsgKey } from '../storage';
import {
  Member, HistoryEntry, JournalEntry, SystemInfo, AppSettings, ChatChannel, ChatMessage,
  ExportPayload, CustomFieldDef, NoteboardEntry, MemberPoll, uid, DEFAULT_CHANNELS,
  parallelMap,
} from '../utils';
import { CustomPalette } from '../theme';

interface ExportCategories {
  system: boolean; members: boolean; avatars: boolean; banners: boolean; frontHistory: boolean; journal: boolean;
  groups: boolean; chat: boolean; moods: boolean; palettes: boolean; settings: boolean;
  customFields: boolean; noteboards: boolean; polls: boolean; journalTemplates: boolean;
}

interface Props {
  system: SystemInfo;
  members: Member[];
  history: HistoryEntry[];
  journal: JournalEntry[];
  settings: AppSettings;
  channels: ChatChannel[];
  palettes: CustomPalette[];
  onUpdate: () => void;
}

export default function ImportExportView({ system, members, history, journal, settings, channels, palettes, onUpdate }: Props) {
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

  const handleExport = async () => {
    const cat = showExportOptions ? exportSel : {
      system: true, members: true, avatars: true, banners: true, frontHistory: true, journal: true,
      groups: true, chat: true, moods: true, palettes: true, settings: true,
      customFields: true, noteboards: true, polls: true, journalTemplates: true,
    };

    const chatMessages: Record<string, any[]> = {};
    if (cat.chat) {
      const fetched = await parallelMap(channels, async (ch) => ({id: ch.id, msgs: await store.get<any[]>(chatMsgKey(ch.id))}), 6);
      for (const f of fetched) if (f && f.msgs && f.msgs.length > 0) chatMessages[f.id] = f.msgs;
    }

    const avatars: Record<string, string> = {};
    if (cat.avatars) {
      const withAvatars = members.filter(m => !!m.avatar);
      const results = await parallelMap(withAvatars, async (m) => {
        if (m.avatar!.startsWith('data:')) return {id: m.id, data: m.avatar!};
        const dataUri = await window.electronAPI.file.readAsBase64(m.avatar!).catch(() => null);
        return dataUri ? {id: m.id, data: dataUri} : null;
      }, 6);
      for (const r of results) if (r) avatars[r.id] = r.data;
    }
    const banners: Record<string, string> = {};
    if (cat.banners) {
      const withBanners = members.filter(m => !!m.banner);
      const results = await parallelMap(withBanners, async (m) => {
        if (m.banner!.startsWith('data:')) return {id: m.id, data: m.banner!};
        const dataUri = await window.electronAPI.file.readAsBase64(m.banner!).catch(() => null);
        return dataUri ? {id: m.id, data: dataUri} : null;
      }, 6);
      for (const r of results) if (r) banners[r.id] = r.data;
    }
    const membersForExport = members.map(({ avatar: _a, banner: _b, ...rest }) => rest as Member);

    const payload: ExportPayload = {
      _meta: { version: '1.2', app: 'Plural Star', exportedAt: new Date().toISOString() },
      system: cat.system ? system : undefined as any,
      members: cat.members ? membersForExport : [],
      frontHistory: cat.frontHistory ? history : [],
      journal: cat.journal ? journal : [],
      groups: cat.groups ? (await store.get(KEYS.groups) || []) : [],
      chatChannels: cat.chat ? channels : [],
      chatMessages: cat.chat ? chatMessages : {},
      settings: cat.settings ? settings : undefined,
      front: cat.frontHistory ? (await store.get(KEYS.front) || null) : undefined,
      palettes: cat.palettes ? palettes : [],
      avatars: cat.avatars ? avatars : {},
      banners: cat.banners ? banners : {},
      customMoods: cat.moods ? (settings?.customMoods || []) : [],
      customFieldDefs: cat.customFields ? (await store.get(KEYS.customFieldDefs) || []) : [],
      noteboards: cat.noteboards ? (await store.get(KEYS.noteboards) || []) : [],
      polls: cat.polls ? (await store.get(KEYS.polls) || []) : [],
      journalTemplates: cat.journalTemplates ? (await store.get(KEYS.journalTemplates) || []) : [],
    };
    const json = JSON.stringify(payload, null, 2);
    const defaultName = `PluralStar_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    const filePath = await window.electronAPI.dialog.saveFile(defaultName);
    if (!filePath) return;

    await window.electronAPI.file.write(filePath, json);
    showStatus('Backup exported successfully');
  };


  const handlePickBackup = async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,.txt';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const text = await file.text();
        const data = JSON.parse(text) as ExportPayload;

        if (!data._meta?.app?.includes('PluralSpace') && !data._meta?.app?.includes('Plural Space') && !data._meta?.app?.includes('PluralStar') && !data._meta?.app?.includes('Plural Star')) {
          showStatus('Error: Not a Plural Star backup file');
          return;
        }

        setRestoreData(data);
        setRestoreFile(file.name);
      };
      input.click();
    } catch (e: any) {
      showStatus(`Import error: ${e.message}`);
    }
  };

  const handleRestore = async () => {
    if (!restoreData) return;
    setImporting(true);
    try {
      const batch: Record<string, unknown> = {};

      if (restoreSel.system && restoreData.system) batch[KEYS.system] = restoreData.system;

      if (restoreSel.members && restoreData.members) {
        const avatarMap: Record<string, string> = { ...(restoreData.avatars || {}) };
        const bannerMap: Record<string, string> = { ...(restoreData.banners || {}) };
        const importedMembers = restoreData.members.map((m: any) => {
          let result: any = m;
          if (!restoreSel.avatars) { const { avatar, ...rest } = result; result = rest; }
          else {
            const resolvedAvatar = avatarMap[m.id] ?? m.avatar;
            if (resolvedAvatar) result = { ...result, avatar: resolvedAvatar };
          }
          if (!restoreSel.banners) { const { banner, ...rest } = result; result = rest; }
          else {
            const resolvedBanner = bannerMap[m.id] ?? m.banner;
            if (resolvedBanner) result = { ...result, banner: resolvedBanner };
          }
          return result;
        });
        batch[KEYS.members] = importedMembers;
      } else if ((restoreSel.avatars || restoreSel.banners) && !restoreSel.members) {
        const avatarMap: Record<string, string> = restoreSel.avatars ? { ...(restoreData.avatars || {}) } : {};
        const bannerMap: Record<string, string> = restoreSel.banners ? { ...(restoreData.banners || {}) } : {};
        if (restoreSel.avatars) {
          for (const m of (restoreData.members || [])) { if ((m as any).avatar && !avatarMap[m.id]) avatarMap[m.id] = (m as any).avatar; }
        }
        if (restoreSel.banners) {
          for (const m of (restoreData.members || [])) { if ((m as any).banner && !bannerMap[m.id]) bannerMap[m.id] = (m as any).banner; }
        }
        if (Object.keys(avatarMap).length > 0 || Object.keys(bannerMap).length > 0) {
          const existing = await store.getStrict<Member[]>(KEYS.members, []) || [];
          const updated = existing.map(m => {
            let result: any = m;
            if (avatarMap[m.id]) result = { ...result, avatar: avatarMap[m.id] };
            if (bannerMap[m.id]) result = { ...result, banner: bannerMap[m.id] };
            return result;
          });
          batch[KEYS.members] = updated;
        }
      }

      if (restoreSel.journal && restoreData.journal) batch[KEYS.journal] = restoreData.journal;

      if (restoreSel.frontHistory && restoreData.frontHistory) {
        batch[KEYS.history] = restoreData.frontHistory;
        if (restoreData.front !== undefined) batch[KEYS.front] = restoreData.front;
      }

      if (restoreSel.groups && restoreData.groups) batch[KEYS.groups] = restoreData.groups;

      if (restoreSel.chat) {
        if (restoreData.chatChannels) batch[KEYS.chatChannels] = restoreData.chatChannels;
        if (restoreData.chatMessages) {
          for (const [chId, msgs] of Object.entries(restoreData.chatMessages)) {
            batch[chatMsgKey(chId)] = msgs;
          }
        }
      }

      if (restoreSel.settings || restoreSel.moods) {
        const currentSettings = await store.getStrict<any>(KEYS.settings, {}) || {};
        let newSettings = { ...currentSettings };
        if (restoreSel.settings && restoreData.settings) {
          newSettings = { ...restoreData.settings };
          if (!restoreSel.moods) newSettings.customMoods = currentSettings.customMoods || [];
        }
        if (restoreSel.moods) {
          newSettings.customMoods = restoreData.customMoods || restoreData.settings?.customMoods || [];
        }
        batch[KEYS.settings] = newSettings;
      }

      if (restoreSel.palettes && restoreData.palettes) batch[KEYS.palettes] = restoreData.palettes;
      if (restoreSel.customFields && restoreData.customFieldDefs) batch[KEYS.customFieldDefs] = restoreData.customFieldDefs;
      if (restoreSel.noteboards && restoreData.noteboards) batch[KEYS.noteboards] = restoreData.noteboards;
      if (restoreSel.polls && restoreData.polls) batch[KEYS.polls] = restoreData.polls;
      if (restoreSel.journalTemplates && restoreData.journalTemplates) batch[KEYS.journalTemplates] = restoreData.journalTemplates;

      if (Object.keys(batch).length === 0) {
        showStatus('Nothing selected to restore');
        return;
      }

      await store.setBatch(batch);

      showStatus('Restore complete');
      setRestoreData(null);
      setRestoreFile(null);
      onUpdate();
    } catch (e: any) {
      showStatus(`Restore error (no changes saved): ${e.message}`);
    } finally {
      setImporting(false);
    }
  };


  const handleImportSP = async () => {
    setImporting(true);
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,.txt';
      input.onchange = async () => {
        try {
          const file = input.files?.[0];
          if (!file) return;
          const text = await file.text();
          const data = JSON.parse(text);

          const spMembers = data.members || [];
          const spHistory = data.frontHistory || data.switches || [];

          const importedMembers: Member[] = spMembers.map((entry: any) => {
            const m = entry.content || entry;
            return {
              id: m.id || m._id || uid(),
              name: m.name || 'Unknown',
              pronouns: m.pronouns || '',
              role: m.role || '',
              color: m.color || '#DAA520',
              description: m.desc || m.description || '',
              tags: [],
              groupIds: [],
              avatar: extSel.avatars ? (m.avatarUrl || m.avatar || undefined) : undefined,
            };
          });

          const importedHistory: HistoryEntry[] = spHistory.map((entry: any) => {
            const h = entry.content || entry;
            const memberId = h.member || h.memberId;
            return {
              memberIds: memberId ? [memberId] : [],
              startTime: typeof h.startTime === 'number'
                ? (h.startTime > 1e12 ? h.startTime : h.startTime * 1000)
                : new Date(h.startTime).getTime(),
              endTime: h.endTime
                ? (typeof h.endTime === 'number'
                  ? (h.endTime > 1e12 ? h.endTime : h.endTime * 1000)
                  : new Date(h.endTime).getTime())
                : null,
              note: '',
            };
          });

          const existing = await store.getStrict<Member[]>(KEYS.members, []) || [];
          const existingHistory = await store.getStrict<HistoryEntry[]>(KEYS.history, []) || [];

          const existingIds = new Set(existing.map(m => m.id));
          const newMembers = importedMembers.filter(m => !existingIds.has(m.id));

          await store.setBatch({
            [KEYS.members]: [...existing, ...newMembers],
            [KEYS.history]: [...existingHistory, ...importedHistory],
          });

          showStatus(`SP Import: ${newMembers.length} new members, ${importedHistory.length} history entries`);
          onUpdate();
        } catch (e: any) {
          showStatus(`SP Import error (no changes saved): ${e.message}`);
        } finally {
          setImporting(false);
        }
      };
      input.click();
    } catch (e: any) {
      showStatus(`SP Import error: ${e.message}`);
      setImporting(false);
    }
  };


  const [extSource, setExtSource] = useState<'sp' | 'pk'>('sp');
  const [extToken, setExtToken] = useState('');
  const [extLoading, setExtLoading] = useState(false);
  const [extPreview, setExtPreview] = useState<{members: any[]; switches: any[]; system: any} | null>(null);
  const [extSel, setExtSel] = useState({system: true, members: true, avatars: true, frontHistory: true});
  const togE = (k: string) => setExtSel(s => ({...s, [k]: !s[k as keyof typeof s]}));

  const handleTokenFetch = async () => {
    if (!extToken.trim()) { showStatus(t('share.tokenRequired')); return; }
    setExtLoading(true); setExtPreview(null);
    const netFetch = async (url: string, headers: Record<string, string>) => {
      const res = await window.electronAPI.net.fetch(url, { headers });
      if (!res.ok) throw new Error(t('share.authFailed', {status: res.status}));
      try { return JSON.parse(res.text); } catch { return {}; }
    };
    try {
      if (extSource === 'sp') {
        const headers = {Authorization: extToken.trim(), 'Content-Type': 'application/json'};
        const meData = await netFetch('https://v2.apparyllis.com/v1/me', headers);
        const userId = meData.id || meData.uid;
        const [mData, sData] = await Promise.all([
          netFetch(`https://v2.apparyllis.com/v1/members/${userId}`, headers),
          netFetch(`https://v2.apparyllis.com/v1/frontHistory/${userId}?startTime=0&endTime=${Date.now()}`, headers),
        ]);
        setExtPreview({system: meData, members: Array.isArray(mData) ? mData : (mData.members || []), switches: Array.isArray(sData) ? sData : (sData.switches || sData.frontHistory || [])});
      } else {
        const headers = {Authorization: extToken.trim(), 'Content-Type': 'application/json'};
        const [sData, mData, swData] = await Promise.all([
          netFetch('https://api.pluralkit.me/v2/systems/@me', headers),
          netFetch('https://api.pluralkit.me/v2/systems/@me/members', headers),
          netFetch('https://api.pluralkit.me/v2/systems/@me/switches?limit=500', headers),
        ]);
        setExtPreview({system: sData, members: Array.isArray(mData) ? mData : [], switches: Array.isArray(swData) ? swData : []});
      }
    } catch (e: any) { showStatus(`${t('share.importFailed')}: ${e.message}`); }
    finally { setExtLoading(false); }
  };

  const handleTokenImport = async () => {
    if (!extPreview) return;
    const isPK = extSource === 'pk';
    setImporting(true);
    try {
      const batch: Record<string, unknown> = {};

      if (extSel.system && extPreview.system) {
        const name = isPK ? extPreview.system.name : (extPreview.system.content?.username || extPreview.system.content?.name || extPreview.system.username || system.name);
        const desc = isPK ? (extPreview.system.description || system.description) : (extPreview.system.content?.desc || extPreview.system.content?.description || system.description);
        batch[KEYS.system] = {...system, name: name || system.name, description: desc};
      }
      const newM: Member[] = extSel.members && extPreview.members.length > 0
        ? extPreview.members.map((m: any) => ({
            id: uid(), name: isPK ? (m.display_name || m.name) : (m.content?.name || m.name || 'Unknown'),
            pronouns: isPK ? (m.pronouns || '') : (m.content?.pronouns || ''),
            role: isPK ? '' : (m.content?.role || ''),
            color: isPK ? (m.color ? `#${m.color}` : '#DAA520') : (m.content?.color || '#DAA520'),
            description: isPK ? (m.description || '') : (m.content?.desc || ''),
            avatar: extSel.avatars ? (isPK ? (m.avatar_url || undefined) : (m.content?.avatarUrl || undefined)) : undefined,
            tags: [] as string[], groupIds: [] as string[],
          }))
        : [];
      if (newM.length > 0) {
        const merged = [...members, ...newM.filter(nm => !members.find(em => em.name.toLowerCase() === nm.name.toLowerCase()))];
        batch[KEYS.members] = merged;
      }
      if (extSel.frontHistory && extPreview.switches.length > 0) {
        const allMembers = newM.length > 0 ? [...members, ...newM] : members;
        const idMap: Record<string, string> = {};
        extPreview.members.forEach((m: any, i: number) => {
          const eid = isPK ? (m.uuid || m.id) : m.id;
          const name = isPK ? (m.display_name || m.name || '') : (m.content?.name || m.name || '');
          const lm = allMembers.find(l => l.name.toLowerCase() === name.toLowerCase());
          if (eid && lm) idMap[eid] = lm.id;
          if (isPK && m.id && lm) idMap[m.id] = lm.id;
        });
        const newH: HistoryEntry[] = isPK
          ? extPreview.switches.map((sw: any, i: number, arr: any[]) => {
              const next = arr[i - 1];
              const ids = (Array.isArray(sw.members) ? sw.members : []).map((eid: string) => idMap[eid]).filter(Boolean) as string[];
              return {memberIds: ids, startTime: new Date(sw.timestamp).getTime(), endTime: next ? new Date(next.timestamp).getTime() : null, note: ''} as HistoryEntry;
            }).filter((h: HistoryEntry) => h.memberIds.length > 0)
          : extPreview.switches.map((sw: any) => {
              const externalIds: string[] = Array.isArray(sw.members) ? sw.members : (sw.content?.member ? [sw.content.member] : []);
              const ids = externalIds.map((eid: string) => idMap[eid]).filter(Boolean) as string[];
              const rawTs = sw.content?.startTime || sw.content?.timestamp || sw.timestamp;
              const startTime = typeof rawTs === 'number' ? rawTs : new Date(rawTs).getTime();
              const rawEnd = sw.content?.endTime;
              const endTime = rawEnd ? (typeof rawEnd === 'number' ? rawEnd : new Date(rawEnd).getTime()) : null;
              return {memberIds: ids, startTime, endTime, note: ''} as HistoryEntry;
            }).filter((h: HistoryEntry) => h.memberIds.length > 0 && h.startTime > 0);
        if (newH.length > 0) {
          const merged = [...newH, ...history].sort((a, b) => b.startTime - a.startTime);
          batch[KEYS.history] = merged;
        }
      }

      if (Object.keys(batch).length === 0) {
        showStatus('Nothing to import');
        return;
      }

      await store.setBatch(batch);

      showStatus(`Imported: ${newM.length} members, ${extPreview.switches.length} switches`);
      setExtPreview(null); setExtToken('');
      onUpdate();
    } catch (e: any) { showStatus(`Import error (no changes saved): ${e.message}`); }
    finally { setImporting(false); }
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

        <Btn variant="solid" onClick={handleExport}>{t('share.exportBackup')}</Btn>
      </div>

      <Section label={t('share.restore')} />
      <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 12, lineHeight: 1.5 }}>
          {t('share.restoreDesc')}
        </p>
        <Btn onClick={handlePickBackup}>
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
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="ghost" onClick={() => { setRestoreData(null); setRestoreFile(null); }}>{t('common.cancel')}</Btn>
              <Btn variant="danger" onClick={handleRestore} disabled={importing}>
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
        <Btn onClick={handleImportSP} disabled={importing}>
          {importing ? t('share.importing') : t('share.importFromSP')}
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
          <Btn onClick={handleTokenFetch} disabled={extLoading}>
            {extLoading ? t('share.fetching') : t('share.fetchData')}
          </Btn>
        </div>
        {extPreview && (
          <div style={{ background: 'var(--card)', borderRadius: 8, border: '1px solid var(--border)', padding: 12, marginTop: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
              {t('share.membersCount', {count: extPreview.members.length})} · {t('share.frontEntries', {count: extPreview.switches.length})}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {([
                ['system', t('share.systemNameDesc'), true],
                ['members', t('share.memberProfiles'), extPreview.members.length > 0],
                ['avatars', t('share.profilePictures'), extPreview.members.length > 0],
                ['frontHistory', t('share.frontHistory'), extPreview.switches.length > 0],
              ] as [string, string, boolean][]).map(([k, label, avail]) => (
                <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: avail ? 1 : 0.4, cursor: avail ? 'pointer' : 'default' }}>
                  <input type="checkbox" checked={avail && extSel[k as keyof typeof extSel]} disabled={!avail} onChange={() => togE(k)} />
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>{label}</span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="ghost" onClick={() => { setExtPreview(null); setExtToken(''); }}>{t('common.cancel')}</Btn>
              <Btn variant="solid" onClick={handleTokenImport} disabled={importing}>
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
