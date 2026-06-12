import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Member, FrontState, AppSettings, DEFAULT_MOODS, EMPTY_TIER,
  fmtTime, fmtDur, isFrontEmpty, translateMood,
  parseMoodList, toggleMoodInList, serializeMoodList,
} from '../utils';
import { Btn, Field, Section, Modal, ConfirmDialog } from '../components/ui';

export function SetStatusModal({ open, onClose, onSave, statuses, selfId, current, settings }: {
  open: boolean; onClose: () => void; onSave: (p: any, cf: any, cc: any) => void;
  statuses: Member[]; selfId?: string; current: FrontState | null; settings: AppSettings;
}) {
  const { t } = useTranslation();
  const [statusIds, setStatusIds] = useState<Set<string>>(new Set());
  const [mood, setMood] = useState('');
  const [customMood, setCustomMood] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const [energy, setEnergy] = useState<number | undefined>(undefined);
  const [confirmClear, setConfirmClear] = useState(false);

  const prevOpen = React.useRef(false);
  useEffect(() => {
    if (open && !prevOpen.current) {
      setStatusIds(new Set((current?.primary?.memberIds || []).filter(id => id !== selfId)));
      setMood(current?.primary?.mood || '');
      setCustomMood('');
      setShowCustom(false);
      setLocation(current?.primary?.location || '');
      setNote(current?.primary?.note || '');
      setEnergy(current?.primary?.energyLevel);
    }
    prevOpen.current = open;
  }, [open, current, selfId]);

  const allMoods = [...DEFAULT_MOODS, ...(settings.customMoods || [])];
  const allLocations = settings.locations || [];

  const handleSave = () => {
    const moods = parseMoodList(mood);
    if (showCustom && customMood.trim()) moods.push(customMood.trim());
    const memberIds = [selfId, ...statusIds].filter(Boolean) as string[];
    onSave(
      { memberIds, mood: serializeMoodList(moods) || undefined, note, location: location || undefined, energyLevel: energy },
      EMPTY_TIER, EMPTY_TIER,
    );
    onClose();
  };

  const handleConfirmClear = () => {
    onSave(EMPTY_TIER, EMPTY_TIER, EMPTY_TIER);
    setConfirmClear(false);
    onClose();
  };

  return (
    <>
      <Modal open={open} title={t('status.update')} onClose={onClose}
        footer={
          <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'space-between' }}>
            <Btn variant="ghost" onClick={() => setConfirmClear(true)}>{t('common.clear')}</Btn>
            <Btn variant="solid" onClick={handleSave}>{t('common.save')}</Btn>
          </div>
        }>
        <Section label={t('status.statuses')} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {statuses.map(m => {
            const on = statusIds.has(m.id);
            return (
              <button key={m.id} className="chip" style={{
                borderColor: on ? `${m.color}60` : 'var(--border)',
                background: on ? `${m.color}20` : 'var(--surface)',
              }} onClick={() => {
                const next = new Set(statusIds);
                if (on) { next.delete(m.id); } else { next.add(m.id); }
                setStatusIds(next);
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.color, display: 'inline-block' }} />
                <span style={{ color: on ? m.color : 'var(--dim)', fontWeight: on ? 600 : 400 }}>{m.name}</span>
              </button>
            );
          })}
          {statuses.length === 0 && (
            <span style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>{t('profile.noStatuses')}</span>
          )}
        </div>

        <label className="field__label">{t('modal.mood')}</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
          {(() => { const sel = parseMoodList(mood); const chips = [...allMoods, ...sel.filter(m => !allMoods.includes(m))]; return chips.map(m => {
            const on = sel.includes(m);
            return (
              <button key={m} className={`btn ${on ? 'btn--primary' : 'btn--ghost'}`}
                style={{ padding: '4px 10px', fontSize: 11 }}
                onClick={() => setMood(toggleMoodInList(mood, m))}>{translateMood(m, t)}</button>
            );
          }); })()}
          <button className={`btn ${showCustom ? 'btn--primary' : 'btn--ghost'}`}
            style={{ padding: '4px 10px', fontSize: 11 }}
            onClick={() => setShowCustom(!showCustom)}>
            {showCustom ? `− ${t('modal.custom')}` : `+ ${t('modal.custom')}`}
          </button>
        </div>
        {showCustom && (
          <input className="field__input" value={customMood} onChange={e => setCustomMood(e.target.value)}
            placeholder={t('modal.enterMood')} style={{ fontSize: 12, marginBottom: 8 }} />
        )}

        <label className="field__label" style={{ marginTop: 4 }}>{t('modal.location')}</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 4 }}>
          {allLocations.map(l => (
            <button key={l} className={`btn ${location === l ? 'btn--primary' : 'btn--ghost'}`}
              style={{ padding: '4px 10px', fontSize: 11 }}
              onClick={() => setLocation(location === l ? '' : l)}>{l}</button>
          ))}
        </div>
        <input className="field__input" value={location} onChange={e => setLocation(e.target.value)}
          placeholder={t('modal.typeLocation')} style={{ fontSize: 12, marginBottom: 8 }} />

        <label className="field__label" style={{ marginTop: 4 }}>{t('energy.level')}</label>
        <div style={{ display: 'flex', gap: 3, marginBottom: 8, alignItems: 'center' }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
            <button key={n} onClick={() => setEnergy(energy === n ? undefined : n)}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 6, cursor: 'pointer', fontSize: 10, fontWeight: 600,
                background: energy === n ? 'var(--accent-bg)' : 'var(--surface)',
                border: `1px solid ${energy !== undefined && n <= energy ? 'var(--accent)' : 'var(--border)'}`,
                color: energy !== undefined && n <= energy ? 'var(--accent)' : 'var(--dim)',
              }}>{n}</button>
          ))}
        </div>

        <Field label={t('modal.noteOptional')} value={note} onChange={setNote} placeholder={t('modal.whatHappening')} multiline />
      </Modal>
      <ConfirmDialog
        open={confirmClear}
        title={t('status.clearTitle')}
        message={t('status.clearMsg')}
        danger
        onConfirm={handleConfirmClear}
        onCancel={() => setConfirmClear(false)}
      />
    </>
  );
}

interface Props {
  front: FrontState | null;
  members: Member[];
  statuses: Member[];
  selfId?: string;
  settings: AppSettings;
  onSaveStatus: (p: any, cf: any, cc: any) => void;
  onEnsureSelf?: () => Promise<Member>;
}

export default function StatusView({ front, members, statuses, selfId, settings, onSaveStatus, onEnsureSelf }: Props) {
  const { t } = useTranslation();
  const [showSet, setShowSet] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(x => x + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const openSet = async () => {
    if (onEnsureSelf) await onEnsureSelf();
    setShowSet(true);
  };

  const getMember = (id: string) => members.find(m => m.id === id);
  const empty = isFrontEmpty(front);
  const tier = front?.primary;
  const activeStatuses = (tier?.memberIds || [])
    .filter(id => id !== selfId)
    .map(getMember)
    .filter(Boolean) as Member[];

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
      <span style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--dim)', fontWeight: 600, minWidth: 80 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text)' }}>{value}</span>
    </div>
  );

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, fontStyle: 'italic', color: 'var(--text)' }}>
          {t('status.current')}
        </span>
        <Btn variant="solid" onClick={openSet}>{t('status.update')}</Btn>
      </div>

      {empty ? (
        <div style={{ padding: 24, textAlign: 'center', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>{t('status.noneSet')}</span>
        </div>
      ) : (
        <div style={{ padding: 16, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer' }}
          onClick={openSet}>
          {activeStatuses.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {activeStatuses.map(m => (
                <span key={m.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, background: `${m.color}20`, border: `1px solid ${m.color}50`, fontSize: 13, fontWeight: 500, color: m.color }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, display: 'inline-block' }} />
                  {m.name}
                </span>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, fontStyle: 'italic' }}>{t('status.noStatuses')}</div>
          )}
          {tier?.mood ? <Row label={t('modal.mood')} value={translateMood(tier.mood, t)} /> : null}
          {tier?.location ? <Row label={t('modal.location')} value={tier.location} /> : null}
          {tier?.energyLevel !== undefined ? <Row label={t('energy.level')} value={`${tier.energyLevel}/10`} /> : null}
          {tier?.note ? <Row label={t('modal.note')} value={tier.note} /> : null}
          {front ? (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
              {t('status.since', { time: fmtTime(front.startTime) })} · {fmtDur(front.startTime)}
            </div>
          ) : null}
        </div>
      )}

      <SetStatusModal
        open={showSet}
        onClose={() => setShowSet(false)}
        onSave={onSaveStatus}
        statuses={statuses}
        selfId={selfId}
        current={front}
        settings={settings}
      />
    </div>
  );
}
