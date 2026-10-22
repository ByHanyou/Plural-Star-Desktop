import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { saveData } from '../store/actions';
import { useAppStore } from '../store/appStore';
import { Btn, Field, Section, ConfirmDialog, ImageErrorDialog, clickable, linkButton, StatusMsg } from '../components/ui';
import SystemProfileCard from '../components/SystemProfileCard';
import { BannerField } from '../components/ImageFields';
import { useImagePick } from '../hooks/useImagePick';
import { useFlash } from '../hooks/useFlash';
import { logError } from '../utils/log';

type Mode = 'read' | 'edit';

export default function SystemProfileView() {
  const system = useAppStore(s => s.system);
  const { t } = useTranslation();

  const [mode, setMode] = useState<Mode>('read');
  const [name, setName] = useState(system.name || '');
  const [desc, setDesc] = useState(system.description || '');
  const [avatar, setAvatar] = useState(system.avatar || '');
  const [banner, setBanner] = useState(system.banner || '');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [saved, flashSaved] = useFlash<StatusMsg>(3000);
  const { pick, imageError, clearImageError } = useImagePick();

  const dirty =
    name !== (system.name || '') ||
    desc !== (system.description || '') ||
    avatar !== (system.avatar || '') ||
    banner !== (system.banner || '');

  const resetFields = () => {
    setName(system.name || '');
    setDesc(system.description || '');
    setAvatar(system.avatar || '');
    setBanner(system.banner || '');
  };

  const commit = async () => {
    try {
      await saveData('system', {
        ...system,
        name: name.trim(),
        description: desc.trim(),
        avatar: avatar || undefined,
        banner: banner || undefined,
      });
    } catch (e) {
      logError('profile', e);
      flashSaved({ msg: t('common.settingsError'), error: true }, 4000);
      return;
    }
    setMode('read');
    flashSaved({ msg: t('common.settingsSaved'), error: false });
  };

  const discard = () => {
    resetFields();
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
    resetFields();
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
        <SystemProfileCard name={system.name} description={system.description} avatar={system.avatar} banner={system.banner} />
      ) : (
        <>
          <Field label={t('modal.systemName')} value={name} onChange={setName}
            placeholder={t('modal.systemNamePlaceholder')} />
          <Field label={t('modal.descriptionLabel')} value={desc} onChange={setDesc}
            placeholder={t('modal.descriptionFieldPlaceholder')} multiline />

          <Section label={t('systemProfile.avatarAndBanner')} />
          <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'flex-start' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 72, height: 72, borderRadius: 36, border: '2px solid var(--accent)', overflow: 'hidden', cursor: 'pointer',
                backgroundImage: avatar ? `url(${avatar})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center',
                backgroundColor: avatar ? undefined : 'var(--surface)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: 'var(--dim)',
              }} {...clickable(() => pick('image', setAvatar), t('systemProfile.changeAvatar'))}>
                {!avatar && '📷'}
              </div>
              <div style={{ marginTop: 4, display: 'flex', gap: 6, justifyContent: 'center' }}>
                <button style={linkButton('var(--accent)', 10)}
                  onClick={() => pick('image', setAvatar)}>{t('systemProfile.changeAvatar')}</button>
                {avatar && <button style={linkButton('var(--danger)', 10)}
                  onClick={() => setAvatar('')}>{t('systemProfile.removeAvatar')}</button>}
              </div>
            </div>
            <BannerField banner={banner} pickLabel={t('systemProfile.changeBanner')} removeLabel={t('systemProfile.removeBanner')}
              onPick={() => pick('banner', setBanner)} onRemove={() => setBanner('')} style={{ flex: 1, marginBottom: 0 }} />
          </div>

          <p style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>{t('systemProfile.shareHint')}</p>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <Btn variant="solid" onClick={() => void commit()}>{t('common.save')}</Btn>
            <Btn variant="ghost" onClick={() => switchTo('read')}>{t('common.cancel')}</Btn>
          </div>
        </>
      )}

      {saved && <p style={{ fontSize: 12, color: saved.error ? 'var(--danger)' : 'var(--success)', marginTop: 12 }} role={saved.error ? 'alert' : 'status'}>{saved.msg}</p>}

      <ConfirmDialog
        open={confirmDiscard}
        title={t('systemProfile.discardTitle')}
        message={t('systemProfile.discardMsg')}
        danger single
        onConfirm={discard}
        onCancel={() => setConfirmDiscard(false)}
      />
      <ImageErrorDialog error={imageError} onClose={clearImageError} />
    </div>
  );
}
