import { store, KEYS, chatMsgKey } from '../storage';
import {
  Member, HistoryEntry, JournalEntry, ChatChannel, ChatMessage,
  CustomFieldDef, CustomFieldType, MemberGroup, MemberPoll, uid,
} from '../utils';
import { detectForeignFormat, convertOurcana, convertMultiplicity, convertOctocon, convertAmpar, ConvertedImport, detectPluralSpace, convertPluralSpace } from '../importers';
import { unzipSync, strFromU8 } from 'fflate';
import { bytesToDataUri, spAvatarUrl, inlineRemoteAvatars } from '../exportUtils';
import { ImportCtx } from './ctx';

export const handleImportSP = async (ctx: ImportCtx) => {
  const { setImporting, extSel, showStatus, onUpdate } = ctx;
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
              avatar: extSel.avatars ? (spAvatarUrl(m) || m.avatar || undefined) : undefined,
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
          const newMembersRaw = importedMembers.filter(m => !existingIds.has(m.id));
          const newMembers = extSel.avatars ? await inlineRemoteAvatars(newMembersRaw) : newMembersRaw;

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

export const handleImportForeign = async (ctx: ImportCtx) => {
  const { setImporting, showStatus, history, onUpdate } = ctx;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.ampar';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setImporting(true);
      try {
        let conv: ConvertedImport | null = null;
        if (file.name.toLowerCase().endsWith('.ampar')) {
          const bytes = new Uint8Array(await file.arrayBuffer());
          conv = convertAmpar(bytes);
        } else {
          const text = await file.text();
          const fmt = detectForeignFormat(text);
          if (!fmt) { showStatus('Error: Unrecognized file. Use an Ourcana, HiveMind, Octocon (.json) or Ampersand (.ampar) export.'); setImporting(false); return; }
          const d = JSON.parse(text);
          conv = fmt === 'ourcana' ? convertOurcana(d) : fmt === 'multiplicity' ? convertMultiplicity(d) : convertOctocon(d);
        }
        if (!conv || (conv.members.length === 0 && conv.history.length === 0)) { showStatus('Error: Nothing to import from that file'); setImporting(false); return; }

        const batch: Record<string, unknown> = {};
        const existing = await store.getStrict<Member[]>(KEYS.members, []) || [];
        const merged = [...existing];
        const idRemap: Record<string, string> = {};
        const toAdd: Member[] = [];
        conv.members.forEach(nm => {
          const di = merged.findIndex(e => (nm.sourceId && e.sourceId === nm.sourceId) || (!e.sourceId && e.name.toLowerCase() === nm.name.toLowerCase()));
          if (di >= 0) {
            const dup = merged[di];
            idRemap[nm.id] = dup.id;
            if (dup.deleted) merged[di] = { ...dup, deleted: false, archived: nm.archived ?? false };
          } else { idRemap[nm.id] = nm.id; toAdd.push(nm); }
        });
        const toAddInlined = await inlineRemoteAvatars(toAdd);
        batch[KEYS.members] = [...merged, ...toAddInlined];

        if (conv.history.length > 0) {
          const remapped = conv.history.map(h => ({ ...h, memberIds: h.memberIds.map(id => idRemap[id] || id) }));
          batch[KEYS.history] = [...remapped, ...history].sort((a, b) => b.startTime - a.startTime);
        }
        if (conv.groups && conv.groups.length > 0) {
          const existingGroups = await store.getStrict<any[]>(KEYS.groups, []) || [];
          const mergedGroupList = [...existingGroups];
          conv.groups.forEach(g => {
            const srcId = `ext:${String(g.id)}`;
            const idx = mergedGroupList.findIndex((e: any) => e.sourceId === srcId);
            const nameIdx = idx < 0 ? mergedGroupList.findIndex((e: any) => !e.sourceId && String(e.name || '').toLowerCase() === g.name.toLowerCase()) : -1;
            const at = idx >= 0 ? idx : nameIdx;
            if (at >= 0) mergedGroupList[at] = { ...mergedGroupList[at], name: g.name, sourceId: srcId };
            else mergedGroupList.push({ ...g, sourceId: srcId });
          });
          batch[KEYS.groups] = mergedGroupList;
        }
        if (conv.customFieldDefs && conv.customFieldDefs.length > 0) {
          const existingDefs = await store.getStrict<any[]>(KEYS.customFieldDefs, []) || [];
          const names = new Set(existingDefs.map((d: any) => String(d.name || '').toLowerCase()));
          batch[KEYS.customFieldDefs] = [...existingDefs, ...conv.customFieldDefs.filter(d => !names.has(d.name.toLowerCase()))];
        }

        await store.setBatch(batch);
        showStatus(`${conv.sourceLabel} import: ${toAdd.length} new members, ${conv.history.length} history entries`);
        onUpdate();
      } catch (e: any) {
        showStatus(`Import error (no changes saved): ${e.message}`);
      } finally {
        setImporting(false);
      }
    };
    input.click();
};

export const handleImportPluralSpace = async (ctx: ImportCtx) => {
  const { t, setImporting, showStatus, history, system, onUpdate } = ctx;
    const filePath = await window.electronAPI.dialog.openFile([
      { name: 'PluralSpace export (.zip or data.json)', extensions: ['zip', 'json'] },
      { name: 'All Files', extensions: ['*'] },
    ]);
    if (!filePath) return;
    setImporting(true);
    try {
      const dataUri = await window.electronAPI.file.readAsBase64(filePath);
      if (!dataUri) throw new Error(t('share.psNotExport'));
      const b64 = dataUri.split(',')[1] || '';
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      let zipFiles: Record<string, Uint8Array> | null = null;
      let text: string;
      if (/\.zip$/i.test(filePath)) {
        zipFiles = unzipSync(bytes);
        const jsonEntry = zipFiles['data.json']
          ? 'data.json'
          : Object.keys(zipFiles).find(k => /(^|\/)data\.json$/i.test(k)) || Object.keys(zipFiles).find(k => /\.json$/i.test(k));
        if (!jsonEntry) throw new Error(t('share.psNotExport'));
        text = strFromU8(zipFiles[jsonEntry]);
      } else {
        text = new TextDecoder('utf-8').decode(bytes);
      }
      let d: any;
      try { d = JSON.parse(text); } catch { throw new Error(t('share.psNotExport')); }
      if (!detectPluralSpace(d)) throw new Error(t('share.psNotExport'));
      const conv = convertPluralSpace(d);

      const batch: Record<string, unknown> = {};

      const existingDefs = await store.getStrict<CustomFieldDef[]>(KEYS.customFieldDefs, []) || [];
      const defRemap: Record<string, string> = {};
      const defsToAdd: CustomFieldDef[] = [];
      (conv.customFieldDefs || []).forEach(dd => {
        const ex = existingDefs.find(e => e.name.toLowerCase() === dd.name.toLowerCase());
        if (ex) { defRemap[dd.id] = ex.id; } else { defRemap[dd.id] = dd.id; defsToAdd.push(dd); }
      });
      if (defsToAdd.length > 0) batch[KEYS.customFieldDefs] = [...existingDefs, ...defsToAdd];

      const existingGroups = await store.getStrict<MemberGroup[]>(KEYS.groups, []) || [];
      const groupRemap: Record<string, string> = {};
      const groupsToAdd: MemberGroup[] = [];
      const mergedGroupList = [...existingGroups];
      let groupsChanged = false;
      (conv.groups || []).forEach(g => {
        const srcId = `ps:${String(g.id)}`;
        const idx = mergedGroupList.findIndex(e => e.sourceId === srcId);
        const nameIdx = idx < 0 ? mergedGroupList.findIndex(e => !e.sourceId && String(e.name).toLowerCase() === g.name.toLowerCase()) : -1;
        const at = idx >= 0 ? idx : nameIdx;
        if (at >= 0) {
          groupRemap[g.id] = mergedGroupList[at].id;
          mergedGroupList[at] = { ...mergedGroupList[at], name: g.name, sourceId: srcId };
          groupsChanged = true;
        } else {
          groupRemap[g.id] = g.id;
          mergedGroupList.push({ ...g, sourceId: srcId });
          groupsChanged = true;
        }
      });
      if (groupsChanged) batch[KEYS.groups] = mergedGroupList;

      const existing = await store.getStrict<Member[]>(KEYS.members, []) || [];
      const merged = [...existing];
      const idRemap: Record<string, string> = {};
      const toAdd: Member[] = [];
      conv.members.forEach(nm => {
        const fixed: Member = {
          ...nm,
          customFields: (nm.customFields || []).map(cv => ({ ...cv, fieldId: defRemap[cv.fieldId] || cv.fieldId })),
          groupIds: (nm.groupIds || []).map(g => groupRemap[g] || g),
        };
        const di = merged.findIndex(e => (nm.sourceId && e.sourceId === nm.sourceId) || (!e.sourceId && e.name.toLowerCase() === nm.name.toLowerCase()));
        if (di >= 0) {
          const dup = merged[di];
          idRemap[nm.id] = dup.id;
          const mergedCF = [...(dup.customFields || [])];
          (fixed.customFields || []).forEach(cv => {
            const ci = mergedCF.findIndex(c => c.fieldId === cv.fieldId);
            if (ci >= 0) mergedCF[ci] = cv; else mergedCF.push(cv);
          });
          merged[di] = {
            ...dup, name: fixed.name, pronouns: fixed.pronouns, role: fixed.role, color: fixed.color,
            description: fixed.description, archived: fixed.archived, isCustomFront: fixed.isCustomFront,
            sourceId: nm.sourceId, customFields: mergedCF,
            groupIds: [...new Set([...(dup.groupIds || []), ...(fixed.groupIds || [])])],
            ...(dup.deleted ? { deleted: false } : {}),
          };
        } else {
          idRemap[nm.id] = nm.id;
          toAdd.push(fixed);
        }
      });
      let allMembers: Member[] = [...merged, ...toAdd];

      let avatarsLoaded = 0;
      const sep = filePath.includes('\\') ? '\\' : '/';
      const baseDir = filePath.slice(0, filePath.lastIndexOf(sep));
      for (const [origId, rel] of Object.entries(conv.avatarMediaPaths)) {
        const localId = idRemap[origId] || origId;
        const relNorm = String(rel).replace(/^[/\\]+/, '');
        if (relNorm.includes('..')) continue;
        if (zipFiles) {
          const zipKey = relNorm.replace(/\\/g, '/');
          const entry = zipFiles[zipKey] || zipFiles[String(rel)];
          if (entry) {
            allMembers = allMembers.map(m => m.id === localId ? { ...m, avatar: bytesToDataUri(entry, zipKey) } : m);
            avatarsLoaded++;
          }
          continue;
        }
        const abs = baseDir + sep + relNorm.replace(/[/\\]+/g, sep);
        const dataUrl = await window.electronAPI.file.readAsBase64(abs).catch(() => null);
        if (dataUrl) { allMembers = allMembers.map(m => m.id === localId ? { ...m, avatar: dataUrl } : m); avatarsLoaded++; }
      }
      allMembers = await inlineRemoteAvatars(allMembers);
      batch[KEYS.members] = allMembers;

      if (conv.history.length > 0) {
        const remapped = conv.history.map(h => ({
          ...h,
          memberIds: h.memberIds.map(id => idRemap[id] || id),
          coFrontIds: h.coFrontIds?.map(id => idRemap[id] || id),
          coConsciousIds: h.coConsciousIds?.map(id => idRemap[id] || id),
        }));
        batch[KEYS.history] = [...remapped, ...history].sort((a, b) => b.startTime - a.startTime);
      }

      if (conv.journal.length > 0) {
        const existingJ = await store.getStrict<JournalEntry[]>(KEYS.journal, []) || [];
        const newJ: JournalEntry[] = conv.journal.map(j => ({
          id: uid(), title: j.title, body: j.body,
          authorIds: j.authorIds.map(id => idRemap[id] || id),
          hashtags: [], timestamp: j.timestamp,
        }));
        batch[KEYS.journal] = [...newJ, ...existingJ].sort((a, b) => b.timestamp - a.timestamp);
      }

      if (conv.chatChannels.length > 0) {
        const existingCh = await store.getStrict<ChatChannel[]>(KEYS.chatChannels, []) || [];
        const mergedCh: ChatChannel[] = [...existingCh];
        for (const ch of conv.chatChannels) {
          let local = mergedCh.find(c => c.name.toLowerCase() === ch.name.toLowerCase());
          if (!local) { local = { id: uid(), name: ch.name, createdAt: ch.createdAt }; mergedCh.push(local); }
          if (ch.messages.length > 0) {
            const existingMsgs = await store.getStrict<ChatMessage[]>(chatMsgKey(local.id), []) || [];
            const newMsgs: ChatMessage[] = ch.messages.map(msg => ({
              id: uid(), channelId: local!.id,
              authorId: idRemap[msg.authorId] || msg.authorId || '',
              type: 'text', content: msg.content, timestamp: msg.timestamp,
            }));
            batch[chatMsgKey(local.id)] = [...existingMsgs, ...newMsgs].sort((a, b) => a.timestamp - b.timestamp);
          }
        }
        batch[KEYS.chatChannels] = mergedCh;
      }

      if (conv.polls.length > 0) {
        const existingPolls = await store.getStrict<MemberPoll[]>(KEYS.polls, []) || [];
        const newPolls: MemberPoll[] = conv.polls.map(p => {
          const creator = idRemap[p.createdBy] || p.createdBy || '';
          return {
            id: uid(), targetMemberId: creator, question: p.question,
            createdBy: creator, createdAt: p.createdAt, closedAt: p.closedAt,
            options: p.options.map(o => ({ id: uid(), label: o.text, votes: o.votes.map(v => idRemap[v] || v) })),
          };
        });
        batch[KEYS.polls] = [...existingPolls, ...newPolls];
      }

      if (conv.systemName) {
        batch[KEYS.system] = { ...system, name: conv.systemName || system.name, description: conv.systemDesc || system.description };
      }

      await store.setBatch(batch);
      showStatus(t('share.psImportDone', { members: toAdd.length, history: conv.history.length, avatars: avatarsLoaded }));
      onUpdate();
    } catch (e: any) {
      showStatus(`Error: ${e.message}`);
    } finally {
      setImporting(false);
    }
};

export const handleTokenFetch = async (ctx: ImportCtx) => {
  const { extToken, showStatus, t, setExtLoading, setExtPreview, extSource, spGet } = ctx;
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
        const mData = await spGet(`https://v2.apparyllis.com/v1/members/${userId}`, headers);
        const sData = await spGet(`https://v2.apparyllis.com/v1/frontHistory/${userId}?startTime=0&endTime=${Date.now()}`, headers);
        const cfData = await spGet(`https://v2.apparyllis.com/v1/customFields/${userId}`, headers);
        const gData = await spGet(`https://v2.apparyllis.com/v1/groups/${userId}`, headers);
        if (mData == null) throw new Error(t('share.spFetchPartial', {categories: t('share.memberProfiles')}));
        const failedCats: string[] = [];
        if (sData == null) failedCats.push(t('share.frontHistory'));
        if (cfData == null) failedCats.push(t('customFields.title'));
        if (gData == null) failedCats.push(t('share.memberGroups'));
        setExtPreview({
          system: meData,
          members: Array.isArray(mData) ? mData : (mData.members || []),
          switches: Array.isArray(sData) ? sData : (sData?.switches || sData?.frontHistory || []),
          customFields: Array.isArray(cfData) ? cfData : (cfData?.customFields || []),
          groups: Array.isArray(gData) ? gData : (gData?.groups || []),
        });
        if (failedCats.length > 0) showStatus(`Error: ${t('share.spFetchPartial', {categories: failedCats.join(', ')})}`);
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

export const handleTokenImport = async (ctx: ImportCtx) => {
  const { extPreview, extSource, setImporting, system, extSel, members, history, showStatus, setExtPreview, setExtToken, onUpdate } = ctx;
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
      const spUid = String(extPreview.system?.id || extPreview.system?.uid || '');
      let newM: Member[] = extSel.members && extPreview.members.length > 0
        ? extPreview.members.map((m: any) => ({
            id: uid(), name: isPK ? ((extSel.displayNames ? (m.display_name || m.name) : (m.name || m.display_name)) || 'Unknown') : (m.content?.name || m.name || 'Unknown'),
            pronouns: isPK ? (m.pronouns || '') : (m.content?.pronouns || ''),
            role: isPK ? '' : (m.content?.role || ''),
            color: isPK ? (m.color ? `#${m.color}` : '#DAA520') : (m.content?.color || '#DAA520'),
            description: isPK ? (m.description || '') : (m.content?.desc || ''),
            avatar: extSel.avatars ? (isPK ? (m.avatar_url || undefined) : (spAvatarUrl(m.content, spUid) || undefined)) : undefined,
            tags: [] as string[], groupIds: [] as string[],
          }))
        : [];
      if (extSel.avatars && newM.length > 0) newM = await inlineRemoteAvatars(newM);
      let membersAfter: Member[] = members;
      let membersDirty = false;
      if (newM.length > 0) {
        membersAfter = [...members, ...newM.filter(nm => !members.find(em => em.name.toLowerCase() === nm.name.toLowerCase()))];
        membersDirty = true;
      }

      const normId = (raw: any): string => {
        if (raw == null) return '';
        if (typeof raw === 'string') return raw;
        if (typeof raw === 'number') return String(raw);
        if (typeof raw === 'object') {
          if (typeof raw.$oid === 'string') return raw.$oid;
          if (typeof raw._id === 'string') return raw._id;
          if (typeof raw.id === 'string') return raw.id;
          if (typeof raw.toString === 'function') { const s = raw.toString(); if (s && s !== '[object Object]') return s; }
        }
        return '';
      };
      const spLocalByName = (spm: any): Member | undefined => {
        const nm = String(spm.content?.name || spm.name || '').trim().toLowerCase();
        return nm ? membersAfter.find(l => l.name.toLowerCase() === nm) : undefined;
      };

      if (!isPK && extSel.customFields && extPreview.customFields && extPreview.customFields.length > 0) {
        const SP_TYPE_MAP: Record<string, CustomFieldType> = {'0': 'text', '1': 'color', '2': 'date', '3': 'month', '4': 'year', '5': 'monthYear', '6': 'timestamp', '7': 'monthDay', text: 'text', number: 'number', checkbox: 'toggle', toggle: 'toggle', date: 'date', markdown: 'markdown'};
        const existingDefs = await store.getStrict<CustomFieldDef[]>(KEYS.customFieldDefs, []) || [];
        const fieldIdMap: Record<string, string> = {};
        const newDefs: CustomFieldDef[] = [];
        extPreview.customFields.forEach((cf: any, i: number) => {
          const candidates = [cf.id, cf.uuid, cf._id, cf.content?._id, cf.content?.id, cf.content?.uuid, cf.content?.order, cf.order, String(i)];
          const spIds = candidates.map(normId).filter(Boolean);
          const spName = String(cf.content?.name || cf.name || `Field ${i + 1}`);
          const ex = existingDefs.find(dd => dd.name.toLowerCase() === spName.toLowerCase());
          let localId: string;
          if (ex) { localId = ex.id; } else {
            localId = uid();
            newDefs.push({id: localId, name: spName, type: SP_TYPE_MAP[String(cf.content?.type ?? cf.type)] || 'text', sortOrder: cf.content?.order ?? i});
          }
          spIds.forEach(k => { fieldIdMap[k] = localId; });
          fieldIdMap['name:' + spName.toLowerCase().trim()] = localId;
        });
        if (newDefs.length > 0) batch[KEYS.customFieldDefs] = [...existingDefs, ...newDefs];
        membersAfter = membersAfter.map(lm => {
          const spm = extPreview.members.find((sm: any) => spLocalByName(sm)?.id === lm.id);
          if (!spm) return lm;
          const info = spm.content?.info || spm.info || spm.content?.fields || spm.fields;
          if (!info || typeof info !== 'object') return lm;
          const cfVals = [...(lm.customFields || [])];
          Object.entries(info).forEach(([spFieldId, rawValue]: [string, any]) => {
            const localFieldId = fieldIdMap[normId(spFieldId)] || fieldIdMap[spFieldId] || fieldIdMap['name:' + String(spFieldId).toLowerCase().trim()];
            if (!localFieldId) return;
            let value: any = rawValue;
            if (value && typeof value === 'object' && !Array.isArray(value)) {
              if ('value' in value) value = value.value;
              else if ('content' in value && typeof value.content === 'object' && 'value' in value.content) value = value.content.value;
            }
            if (value == null) return;
            const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
            if (valStr === '') return;
            const ci = cfVals.findIndex(cv => cv.fieldId === localFieldId);
            if (ci >= 0) cfVals[ci] = {fieldId: localFieldId, value: valStr};
            else cfVals.push({fieldId: localFieldId, value: valStr});
          });
          return {...lm, customFields: cfVals};
        });
        membersDirty = true;
      }

      if (!isPK && extSel.groups && extPreview.groups && extPreview.groups.length > 0) {
        const existingGroups = await store.getStrict<MemberGroup[]>(KEYS.groups, []) || [];
        const mergedGroups: MemberGroup[] = [...existingGroups];
        const groupMemberSets: {localGroupId: string; extMemberIds: string[]}[] = [];
        extPreview.groups.forEach((g: any) => {
          const gName = String(g.content?.name || g.name || 'Group');
          const gColorRaw = String(g.content?.color || g.color || '').trim();
          const extMembers: string[] = Array.isArray(g.content?.members) ? g.content.members : (Array.isArray(g.members) ? g.members : []);
          let lg = mergedGroups.find(x => String(x.name).toLowerCase() === gName.toLowerCase());
          if (!lg) { lg = {id: uid(), name: gName, color: gColorRaw ? (gColorRaw.startsWith('#') ? gColorRaw : `#${gColorRaw}`) : undefined}; mergedGroups.push(lg); }
          groupMemberSets.push({localGroupId: lg.id, extMemberIds: extMembers.map(normId).filter(Boolean)});
        });
        batch[KEYS.groups] = mergedGroups;
        const extToLocal: Record<string, string> = {};
        extPreview.members.forEach((m: any) => {
          const eid = normId(m._id || m.id);
          const lm = spLocalByName(m);
          if (eid && lm) extToLocal[eid] = lm.id;
        });
        membersAfter = membersAfter.map(lm => {
          const additions = groupMemberSets
            .filter(gs => gs.extMemberIds.some(eid => extToLocal[eid] === lm.id))
            .map(gs => gs.localGroupId)
            .filter(gid => !(lm.groupIds || []).includes(gid));
          if (additions.length === 0) return lm;
          return {...lm, groupIds: [...(lm.groupIds || []), ...additions]};
        });
        membersDirty = true;
      }

      if (membersDirty) batch[KEYS.members] = membersAfter;

      if (extSel.frontHistory && extPreview.switches.length > 0) {
        const allMembers = membersAfter;
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
