import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { store, KEYS } from '../storage';
import { useAppStore } from '../store/appStore';
import { Btn, Field, Section, ConfirmDialog, clickable } from '../components/ui';
import SystemProfileCard from '../components/SystemProfileCard';
import { resizeBannerDataUrl } from '../utils';
import { chooseImageTreatment } from '../components/ImageCropModal';

type Mode = 'read' | 'edit';

interface Props {
  onUpdate: () => void;
}

/**
 * The system's own profile, reached by clicking the system name in the title
 * bar. These fields used to live inside Settings; a profile is not a setting,
 * so it reads like one — the singlet Profile with a Read/Edit switch instead of
 * a separate editor screen.
 */
export default function SystemProfileView({ onUpdate }: Props) {
  const system = useAppStore(s => s.state.system);
  const { t } = useTranslation();

  const [mode, setMode] = useState<Mode>('read');
  const [name, setName] = useState(system.name || '');
  const [desc, setDesc] = useState(system.description || '');
  const [avatar, setAvatar] = useState(system.avatar || '');
  const [banner, setBanner] = useState(system.banner || '');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [saved, setSaved] = useState(false);

  const dirty =
    name !== (system.name || '') ||
    desc !== (system.description || '') ||
    avatar !== (system.avatar || '') ||
    banner !== (system.banner || '');

  const pickImage = async (target: 'avatar' | 'banner') => {
    const filePath = await window.electronAPI.dialog.openFile([
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
    ]);
    if (!filePath) return;
    const dataUrl = await window.electronAPI.file.readAsBase64(filePath);
    if (!dataUrl) return;
    const chosen = await chooseImageTreatment(dataUrl);
    if (!chosen) return;
    if (target === 'avatar') {
      setAvatar(chosen);
      return;
    }
    try {
      setBanner(await resizeBannerDataUrl(chosen));
    } catch {
      setBanner(chosen);
    }
  };

  const commit = async () => {
    // Merged onto the live record so the journal password, which lives on the
    // same object and is edited in Settings, is never dropped by a profile save.
    await store.set(KEYS.system, {
      ...system,
      name: name.trim(),
      description: desc.trim(),
      avatar: avatar || undefined,
      banner: banner || undefined,
    });
    onUpdate();
    setMode('read');
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const discard = () => {
    setName(system.name || '');
    setDesc(system.description || '');
    setAvatar(system.avatar || '');
    setBanner(system.banner || '');
    setConfirmDiscard(false);
    setMode('read');
  };

  const switchTo = (next: Mode) => {
    if (next === mode) return;
    if (next === 'read') {
      if (dirty) { setConfirmDiscard(true); return; }
      setMode('read');
      return;
    }
    // Seed the edit buffer at the moment editing starts, so it can never open
    // on top of a record that changed while the read view was up.
    setName(system.name || '');
    setDesc(system.description || '');
    setAvatar(system.avatar || '');
    setBanner(system.banner || '');
    setMode('edit');
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Btn variant="solid" onClick={() => switchTo(mode === 'read' ? 'edit' : 'read')}>
          {mode === 'read' ? t('common.edit') : t('systemProfile.read')}
        </Btn>
      </div>

      {mode === 'read' ? (
        // Reads straight off the live record, never off the edit buffer: a sync
        // or an import landing while this is open should show, and after a save
        // the buffer and the record say the same thing anyway.
        <SystemProfileCard name={system.name} description={system.description} avatar={system.avatar} banner={system.banner} />
      ) : (
        <>
          <Field label={t('modal.systemName')} value={name} onChange={setName}
            placeholder={t('modal.systemNamePlaceholder')} />
          <Field label={t('modal.descriptionLabel')} value={desc} onChange={setDesc}
            placeholder={t('modal.descriptionFieldPlaceholder')} multiline />

          <Section label={`${t('systemProfile.avatar')} · ${t('systemProfile.banner')}`} />
          <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'flex-start' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 72, height: 72, borderRadius: 36, border: '2px solid var(--accent)', overflow: 'hidden', cursor: 'pointer',
                backgroundImage: avatar ? `url(${avatar})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center',
                backgroundColor: avatar ? undefined : 'var(--surface)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: 'var(--dim)',
              }} {...clickable(() => pickImage('avatar'), t('systemProfile.changeAvatar'))}>
                {!avatar && '📷'}
              </div>
              <div style={{ marginTop: 4, display: 'flex', gap: 6, justifyContent: 'center' }}>
                <button style={{ fontSize: 10, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                  onClick={() => pickImage('avatar')}>{t('systemProfile.changeAvatar')}</button>
                {avatar && <button style={{ fontSize: 10, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}
                  onClick={() => setAvatar('')}>{t('systemProfile.removeAvatar')}</button>}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                width: '100%', aspectRatio: '3 / 1', borderRadius: 8, border: '1px dashed var(--border)', overflow: 'hidden', cursor: 'pointer',
                backgroundImage: banner ? `url(${banner})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center',
                backgroundColor: banner ? undefined : 'var(--surface)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--dim)', fontSize: 13,
              }} {...clickable(() => pickImage('banner'), t('systemProfile.changeBanner'))}>
                {!banner && t('systemProfile.changeBanner')}
              </div>
              {banner && <button style={{ fontSize: 10, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4 }}
                onClick={() => setBanner('')}>{t('systemProfile.removeBanner')}</button>}
            </div>
          </div>

          <p style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>{t('systemProfile.shareHint')}</p>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <Btn variant="solid" onClick={commit}>{t('common.save')}</Btn>
            <Btn variant="ghost" onClick={() => switchTo('read')}>{t('common.cancel')}</Btn>
          </div>
        </>
      )}

      {saved && <p style={{ fontSize: 12, color: 'var(--success)', marginTop: 12 }} role="status">{t('common.settingsSaved')}</p>}

      <ConfirmDialog
        open={confirmDiscard}
        title={t('systemProfile.discardTitle')}
        message={t('systemProfile.discardMsg')}
        danger
        onConfirm={discard}
        onCancel={() => setConfirmDiscard(false)}
      />
    </div>
  );
}
