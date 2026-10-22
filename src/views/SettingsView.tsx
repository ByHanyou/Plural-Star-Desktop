import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { logError } from '../utils/log';
import { Field, Toggle, Dropdown, Section, ChipList, AddRow, Btn, StatusBanner, StatusMsg } from '../components/ui';
import { TextScale, TEXT_SCALE_OPTIONS, fontChoiceOf, hexOr, uid, upsertById } from '../utils';
import { CustomPalette, BUILTIN_PALETTES, DARK_PALETTE, LIGHT_PALETTE, MAX_CUSTOM_PALETTES, deriveTheme, FONT_OPTIONS, FontChoice } from '../theme';
import { saveData, saveSettings, savePalettes } from '../store/actions';
import { useAppStore } from '../store/appStore';
import { SUPPORTED_LANGUAGES } from '../i18n/i18n';
import type { SupportedLanguage } from '../i18n/i18n';
import { TERMINOLOGY_FIELDS, TIER_NAME_FIELDS } from '../i18n/terminology';
import { UpdatesSection } from './settings/UpdatesSection';
import { HexField, PalettePreview } from './settings/PaletteParts';
import DevSettings from '../components/DevSettings';
import { useFlash } from '../hooks/useFlash';

interface Props {
  onOpenProfile: () => void;
}

export default function SettingsView({ onOpenProfile }: Props) {
  const system = useAppStore(s => s.system);
  const settings = useAppStore(s => s.settings);
  const palettes = useAppStore(s => s.palettes);
  const { t } = useTranslation();
  const [saveStatus, flashSave] = useFlash<StatusMsg>(3000);
  const [singletMode, setSingletMode] = useState(settings.accountMode === 'singlet');

  const [journalPw, setJournalPw] = useState(system.journalPassword || '');
  const [sysName, setSysName] = useState(system.name || '');
  const [sysDesc, setSysDesc] = useState(system.description || '');
  const [showPw, setShowPw] = useState(!!system.journalPassword);

  const [locs, setLocs] = useState(settings.locations);
  const [moods, setMoods] = useState(settings.customMoods);
  const [newLoc, setNewLoc] = useState('');
  const [newMood, setNewMood] = useState('');
  const [lang, setLang] = useState<SupportedLanguage>(settings.language);
  const [notif, setNotif] = useState(settings.notificationsEnabled);
  const [termMap, setTermMap] = useState<Record<string, string>>(settings.terminology || {});
  const [tierMap, setTierMap] = useState<Record<string, string>>(settings.tierNames || {});
  const [textScale, setTextScale] = useState<TextScale>(settings.textScale);
  const [activePaletteId, setActivePaletteId] = useState(settings.activePaletteId);
  const [fontChoice, setFontChoice] = useState<FontChoice>(fontChoiceOf(settings));

  const [editPalette, setEditPalette] = useState<CustomPalette | null>(null);
  const [palName, setPalName] = useState('');
  const [palBg, setPalBg] = useState('');
  const [palAccent, setPalAccent] = useState('');
  const [palText, setPalText] = useState('');
  const [palMid, setPalMid] = useState('');

  const allPalettes = [...BUILTIN_PALETTES, ...palettes];
  const [themesOpen, setThemesOpen] = useState(false);
  const [termOpen, setTermOpen] = useState(false);
  const activePalette = allPalettes.find(p => p.id === activePaletteId) || BUILTIN_PALETTES[0];
  const paletteLabel = (p: { id: string; name: string }): string =>
    p.id === DARK_PALETTE.id ? t('modal.paletteObsidian') : p.id === LIGHT_PALETTE.id ? t('modal.paletteSteel') : p.name;
  const activePreview = deriveTheme(activePalette.bg, activePalette.accent, activePalette.text, activePalette.mid);

  const addLoc = () => {
    const v = newLoc.trim();
    if (v && !locs.includes(v)) { setLocs([...locs, v]); setNewLoc(''); }
  };

  const addMood = () => {
    const v = newMood.trim();
    if (v && !moods.includes(v)) { setMoods([...moods, v]); setNewMood(''); }
  };

  const reportFailure = (e: unknown, msgKey: string) => {
    logError('settings', e);
    flashSave({ msg: t(msgKey), error: true }, 4000);
  };

  const selectPalette = async (id: string) => {
    setActivePaletteId(id);
    try {
      await saveSettings({ ...settings, activePaletteId: id });
    } catch (e) {
      reportFailure(e, 'common.settingsError');
    }
  };

  const startEditPalette = (p: CustomPalette) => {
    setEditPalette(p); setPalName(p.name); setPalBg(p.bg); setPalAccent(p.accent); setPalText(p.text); setPalMid(p.mid);
  };

  const startNewPalette = () => {
    const p: CustomPalette = { ...DARK_PALETTE, id: uid(), name: '' };
    startEditPalette(p);
  };

  const savePaletteEdit = async () => {
    if (!editPalette || !palName.trim()) {
      flashSave({ msg: t('common.paletteNameRequired'), error: true });
      return;
    }
    const updated: CustomPalette = {
      id: editPalette.id, name: palName.trim(),
      bg: hexOr(palBg, editPalette.bg),
      accent: hexOr(palAccent, editPalette.accent),
      text: hexOr(palText, editPalette.text),
      mid: hexOr(palMid, editPalette.mid),
    };
    try {
      await savePalettes(upsertById(palettes, updated));
      setEditPalette(null);
      flashSave({ msg: t('common.paletteSaved'), error: false });
    } catch (e) {
      reportFailure(e, 'common.paletteError');
    }
  };

  const deletePalette = async (id: string) => {
    try {
      await savePalettes(palettes.filter(p => p.id !== id));
    } catch (e) {
      reportFailure(e, 'common.paletteError');
      return;
    }
    if (activePaletteId === id) await selectPalette(DARK_PALETTE.id);
  };

  const save = async () => {
    try {
      await saveData('system', {
        ...system,
        ...(singletMode ? { name: sysName.trim(), description: sysDesc.trim() } : {}),
        journalPassword: showPw && journalPw ? journalPw : undefined,
      });
      await saveSettings({
        ...settings, accountMode: singletMode ? 'singlet' : 'system', locations: locs, customMoods: moods, language: lang,
        notificationsEnabled: notif, textScale, activePaletteId, fontChoice, useDyslexicFont: fontChoice === 'opendyslexic',
        terminology: termMap,
        tierNames: tierMap,
      });
      flashSave({ msg: t('common.settingsSaved'), error: false });
    } catch (e) {
      reportFailure(e, 'common.settingsError');
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      {singletMode ? (
        <>
          <Section label={t('modal.name')} />
          <Field label={t('modal.name')} value={sysName} onChange={setSysName} placeholder={t('setup.yourNamePlaceholder')} />
          <Field label={t('modal.goals')} value={sysDesc} onChange={setSysDesc} placeholder={t('setup.goalsPlaceholder')} multiline />
        </>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <Btn variant="solid" onClick={onOpenProfile}>{t('systemProfile.title')}</Btn>
        </div>
      )}

      <Section label={t('modal.palette')} />
      <button type="button" aria-expanded={themesOpen} aria-label={t('common.labelValue', { label: t('modal.palette'), value: paletteLabel(activePalette) })} onClick={() => setThemesOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 12px', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
          border: `1px solid ${themesOpen ? 'var(--accent)' : 'var(--border)'}`, background: 'var(--surface)', marginBottom: themesOpen ? 8 : 12 }}>
        <span aria-hidden style={{ display: 'flex', gap: 3 }}>
          {[activePreview.bg, activePreview.accent, activePreview.text, activePreview.surface].map((c, i) => (
            <span key={i} style={{ width: 14, height: 14, borderRadius: 3, background: c, border: '1px solid rgba(255,255,255,0.1)', display: 'inline-block' }} />
          ))}
        </span>
        <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{paletteLabel(activePalette)}</span>
        <span aria-hidden style={{ fontSize: 11, color: 'var(--dim)' }}>{themesOpen ? '▲' : '▼'}</span>
      </button>
      {themesOpen && (<>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {allPalettes.map(p => {
            const isActive = activePaletteId === p.id;
            const isBuiltin = p.id.startsWith('__');
            const preview = deriveTheme(p.bg, p.accent, p.text, p.mid);
            return (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                borderRadius: 8, border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                background: isActive ? 'var(--accent-bg)' : 'var(--surface)', cursor: 'pointer',
              }} onClick={() => void selectPalette(p.id)}>
                <div aria-hidden style={{ display: 'flex', gap: 3 }}>
                  {[preview.bg, preview.accent, preview.text, preview.surface].map((c, i) => (
                    <div key={i} style={{ width: 14, height: 14, borderRadius: 3, background: c, border: '1px solid rgba(255,255,255,0.1)' }} />
                  ))}
                </div>
                <span style={{ flex: 1, fontSize: 13, color: isActive ? 'var(--accent)' : 'var(--text)', fontWeight: isActive ? 600 : 400 }}
                  role="button" tabIndex={0} aria-pressed={isActive}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void selectPalette(p.id); } }}>
                  {paletteLabel(p)}
                </span>
                {isActive && <span aria-hidden style={{ fontSize: 11, color: 'var(--accent)' }}>✓</span>}
                {!isBuiltin && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn--ghost" aria-label={t('common.editNamed', { name: p.name })} style={{ padding: '3px 8px', fontSize: 11 }} onClick={e => { e.stopPropagation(); startEditPalette(p); }}>✎</button>
                    <button className="btn btn--danger" aria-label={t('common.deleteNamed', { name: p.name })} style={{ padding: '3px 8px', fontSize: 11 }} onClick={e => { e.stopPropagation(); void deletePalette(p.id); }}>✕</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {editPalette ? (
          <div style={{ padding: 14, background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 14 }}>
            <Field label={t('modal.paletteName')} value={palName} onChange={setPalName} placeholder={t('common.paletteNamePlaceholder')} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <HexField label={t('modal.palBg')} value={palBg} onChange={setPalBg} />
              <HexField label={t('modal.palAccent')} value={palAccent} onChange={setPalAccent} />
              <HexField label={t('modal.palText')} value={palText} onChange={setPalText} />
              <HexField label={t('modal.palMid')} value={palMid} onChange={setPalMid} />
            </div>
            <PalettePreview bg={palBg} accent={palAccent} text={palText} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <Btn variant="ghost" onClick={() => setEditPalette(null)}>{t('common.cancel')}</Btn>
              <Btn onClick={() => void savePaletteEdit()}>{t('common.save')}</Btn>
            </div>
          </div>
        ) : (
          palettes.length < MAX_CUSTOM_PALETTES && (
            <Btn variant="ghost" onClick={startNewPalette}>+ {t('modal.newPalette')}</Btn>
          )
        )}
        <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>{t('modal.paletteSlots', { used: palettes.length, max: MAX_CUSTOM_PALETTES })}</p>
      </>)}

      <Section label={t('modal.globalJournalPassword')} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--dim)' }}>{t('modal.lockJournal')}</span>
        <Btn variant={showPw ? 'danger' : 'primary'} onClick={() => { setShowPw(!showPw); if (showPw) setJournalPw(''); }}>
          {showPw ? t('common.remove') : t('common.add')}
        </Btn>
      </div>
      {showPw && <Field value={journalPw} onChange={setJournalPw} placeholder={t('modal.lockJournal')} type="password" />}

      <Toggle label={t('modal.notifications')} description={t('modal.notificationsDesc')} value={notif} onChange={setNotif} />
      <Section label={t('modal.appFont')} />
      <Dropdown
        value={fontChoice}
        options={FONT_OPTIONS.map(o => o.value)}
        onChange={setFontChoice}
        ariaLabel={t('modal.appFont')}
        renderOption={v => v === 'default' ? t('modal.fontDefault') : (FONT_OPTIONS.find(o => o.value === v)?.label || v)}
        optionStyle={v => {
          if (v === 'default') return { fontFamily: 'var(--font-body-fallback)' };
          if (v === 'opendyslexic') return { fontFamily: "'OpenDyslexic', var(--font-body-fallback)" };
          const css = FONT_OPTIONS.find(o => o.value === v)?.css;
          return css ? { fontFamily: css } : undefined;
        }}
      />

      <Section label={t('modal.language')} />
      <Dropdown
        value={lang}
        options={[...SUPPORTED_LANGUAGES]}
        onChange={setLang}
        ariaLabel={t('modal.language')}
        renderOption={v => t(`language.${v}`)}
      />

      <Section label={t('modal.textSize')} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {TEXT_SCALE_OPTIONS.map(opt => (
          <button key={opt.value}
            className={`btn ${textScale === opt.value ? 'btn--primary' : 'btn--ghost'}`}
            style={{ flex: 1 }} aria-pressed={textScale === opt.value}
            onClick={() => setTextScale(opt.value)}>
            {t(opt.labelKey)}
          </button>
        ))}
      </div>

      <Section label={t('modal.locations')} />
      <ChipList items={locs} onRemove={l => setLocs(locs.filter(x => x !== l))} color="var(--accent)" />
      <AddRow value={newLoc} onChange={setNewLoc} onAdd={addLoc} placeholder={t('modal.addLocationPlaceholder')} />

      <Section label={t('modal.customMoods')} />
      <ChipList items={moods} onRemove={m => setMoods(moods.filter(x => x !== m))} color="var(--info)" />
      <AddRow value={newMood} onChange={setNewMood} onAdd={addMood} placeholder={t('modal.addMoodPlaceholder')} />

      <Section label={t('terminology.title')} expanded={termOpen} onToggle={() => setTermOpen(o => !o)} />
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: termOpen ? 8 : 12 }}>{t('terminology.hint')}</div>
      {termOpen && (<>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          {TERMINOLOGY_FIELDS.flat().map(term => (
            <Field key={term} label={t(`terminology.${term}`)} value={termMap[term] || ''}
              onChange={v => setTermMap(m => ({ ...m, [term]: v }))} placeholder={t(`terminology.${term}`)} />
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>{t('terminology.tierHint')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          {TIER_NAME_FIELDS.map(([tier, labelKey]) => (
            <Field key={tier} label={t(`terminology.${labelKey}`)} value={tierMap[tier] || ''}
              onChange={v => setTierMap(m => ({ ...m, [tier]: v }))} placeholder={t(`terminology.${labelKey}`)} />
          ))}
        </div>
      </>)}

      <Toggle label={t('settings.observatory')} description={t('settings.observatoryDesc')} value={singletMode} onChange={setSingletMode} />

      <UpdatesSection />
      {import.meta.env.DEV ? <DevSettings /> : null}

      <div style={{ position: 'sticky', bottom: 0, padding: '12px 0', background: 'var(--bg)', borderTop: '1px solid var(--border)' }}>
        <StatusBanner status={saveStatus} style={{ padding: '8px 14px', marginBottom: 8, textAlign: 'center' }} />
        <Btn variant="solid" onClick={() => void save()} className="btn--full">{t('common.save')}</Btn>
      </div>
    </div>
  );
}
