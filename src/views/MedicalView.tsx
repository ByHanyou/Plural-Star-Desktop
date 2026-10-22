import { useState, useId } from 'react';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import {
  MedicalData, Medication, MedicalAppointment, MedicalHistoryEntry, EmergencyInfo,
  time12to24, parseTime24, fmtClockHHMM, uses12HourClock, uid, fmtTime, fmtList,
} from '../utils';
import { saveData } from '../store/actions';
import { useAppStore } from '../store/appStore';
import { Btn, Toggle, ConfirmDialog, SaveErrorDialog, clickable, SrOnly } from '../components/ui';
import { useSaveGuard } from '../hooks/useSaveGuard';
import { AmPmToggle } from '../components/AmPmToggle';

type ItemKind = 'medications' | 'appointments' | 'history';

const REMIND_OPTIONS: [number, string][] = [[0, 'medical.atTime'], [15, 'medical.remind15m'], [30, 'medical.remind30m'], [60, 'medical.remind1h'], [1440, 'medical.remind1d']];
const cardStyle: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 16 };
const rowStyle: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 12 };
const cardTitleStyle: React.CSSProperties = { fontSize: 13, fontFamily: 'var(--font-display)', color: 'var(--accent)', margin: '0 0 10px' };

function MedicalCard({ title, empty, emptyLabel, children }: { title: string; empty: boolean; emptyLabel: string; children: React.ReactNode }) {
  return (
    <div style={cardStyle}>
      <h3 style={cardTitleStyle}>{title}</h3>
      {empty && <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>{emptyLabel}</p>}
      {children}
    </div>
  );
}

function ItemRow({ title, subtitle, onDelete, children }: { title: string; subtitle?: string; onDelete: () => void; children?: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
      {children}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{subtitle}</div>}
      </div>
      <button type="button" onClick={onDelete} aria-label={t('common.deleteNamed', { name: title })} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>✕</button>
    </div>
  );
}

export default function MedicalView() {
  const { t } = useTranslation();
  const data = useAppStore(s => s.medical);
  const [confirmDel, setConfirmDel] = useState<{ kind: ItemKind; id: string } | null>(null);
  const [saveError, run, clearSaveError] = useSaveGuard();

  const [medName, setMedName] = useState('');
  const [medDose, setMedDose] = useState('');
  const [medTime, setMedTime] = useState('');
  const [medAmPm, setMedAmPm] = useState<'AM' | 'PM'>('AM');
  const [medTimes, setMedTimes] = useState<string[]>([]);
  const [timeErr, setTimeErr] = useState(false);
  const [apptTitle, setApptTitle] = useState('');
  const [apptWhen, setApptWhen] = useState('');
  const [apptRemind, setApptRemind] = useState(0);
  const [histTitle, setHistTitle] = useState('');
  const [histWhen, setHistWhen] = useState('');

  const twelveHour = uses12HourClock();
  const medId = useId();

  const update = (change: (current: MedicalData) => MedicalData) => {
    void run(() => saveData('medical', change(useAppStore.getState().medical)));
  };

  const addMedTime = () => {
    const v = twelveHour ? time12to24(medTime, medAmPm) : parseTime24(medTime);
    if (!v) { setTimeErr(true); return; }
    if (!medTimes.includes(v)) setMedTimes([...medTimes, v].sort());
    setMedTime('');
    setTimeErr(false);
  };

  const addMedication = () => {
    const name = medName.trim();
    if (!name) return;
    const med: Medication = { id: uid(), name, dosage: medDose.trim() || undefined, times: medTimes, enabled: true, createdAt: Date.now() };
    update(d => ({ ...d, medications: [...d.medications, med] }));
    setMedName(''); setMedDose(''); setMedTimes([]); setMedTime('');
  };

  const toggleMed = (id: string) => update(d => ({ ...d, medications: d.medications.map(m => (m.id === id ? { ...m, enabled: !m.enabled } : m)) }));

  const addAppointment = () => {
    const title = apptTitle.trim();
    if (!title || !apptWhen) return;
    const appt: MedicalAppointment = { id: uid(), title, time: new Date(apptWhen).getTime(), reminderMinutesBefore: apptRemind || undefined, createdAt: Date.now() };
    update(d => ({ ...d, appointments: [...d.appointments, appt].sort((a, b) => a.time - b.time) }));
    setApptTitle(''); setApptWhen(''); setApptRemind(0);
  };

  const addHistory = () => {
    const title = histTitle.trim();
    if (!title) return;
    const h: MedicalHistoryEntry = { id: uid(), title, date: histWhen ? new Date(histWhen).getTime() : undefined, createdAt: Date.now() };
    update(d => ({ ...d, history: [...d.history, h] }));
    setHistTitle(''); setHistWhen('');
  };

  const setEmergency = (patch: Partial<EmergencyInfo>) => update(d => ({ ...d, emergency: { ...d.emergency, ...patch } }));

  const doDelete = () => {
    const target = confirmDel;
    setConfirmDel(null);
    if (!target) return;
    const without = <T extends { id: string }>(list: T[]) => list.filter(item => item.id !== target.id);
    update(d => (target.kind === 'medications' ? { ...d, medications: without(d.medications) }
      : target.kind === 'appointments' ? { ...d, appointments: without(d.appointments) }
      : { ...d, history: without(d.history) }));
  };

  const emergencyField = (key: 'conditions' | 'allergies' | 'bloodType', label: string, placeholder: string, last = false) => (
    <>
      <label className="field__label" htmlFor={`${medId}-${key}`}>{label}</label>
      <input id={`${medId}-${key}`} className="field__input" value={data.emergency[key] || ''} onChange={e => setEmergency({ [key]: e.target.value })}
        placeholder={placeholder} style={{ marginBottom: last ? 12 : 10 }} />
    </>
  );

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <MedicalCard title={t('medical.medications')} empty={data.medications.length === 0} emptyLabel={t('medical.noMedications')}>
        {data.medications.map(m => (
          <ItemRow key={m.id} title={m.dosage ? `${m.name} · ${m.dosage}` : m.name} subtitle={m.times.length > 0 ? fmtList(m.times.map(fmtClockHHMM)) : undefined}
            onDelete={() => setConfirmDel({ kind: 'medications', id: m.id })}>
            <input type="checkbox" checked={m.enabled} onChange={() => toggleMed(m.id)} aria-label={t('medical.remindersFor', { name: m.name })} />
          </ItemRow>
        ))}
        <div style={rowStyle}>
          <input className="field__input" value={medName} onChange={e => setMedName(e.target.value)} aria-label={t('medical.namePlaceholder')} placeholder={t('medical.namePlaceholder')} style={{ flex: 2, minWidth: 120 }} />
          <input className="field__input" value={medDose} onChange={e => setMedDose(e.target.value)} aria-label={t('medical.dosagePlaceholder')} placeholder={t('medical.dosagePlaceholder')} style={{ flex: 1, minWidth: 80 }} />
        </div>
        <div style={{ ...rowStyle, marginTop: 6 }}>
          <input className={`field__input ${timeErr ? 'field__input--error' : ''}`} value={medTime} onChange={e => { setMedTime(e.target.value); setTimeErr(false); }}
            onKeyDown={e => { if (e.key === 'Enter') addMedTime(); }} aria-label={t('medical.reminderTimes')}
            aria-invalid={timeErr} aria-describedby={timeErr ? `${medId}-hint ${medId}-err` : `${medId}-hint`}
            placeholder={twelveHour ? '9:00' : '14:00'} style={{ width: 70 }} />
          <SrOnly id={`${medId}-hint`}>{t('medical.timeHint')}</SrOnly>
          {twelveHour && <AmPmToggle value={medAmPm} onChange={setMedAmPm} />}
          <Btn variant="ghost" onClick={addMedTime}>{t('medical.addTime')}</Btn>
          {medTimes.map(tm => (
            <span key={tm} style={{ fontSize: 11, background: 'var(--surface)', color: 'var(--text)', padding: '2px 8px', borderRadius: 999, cursor: 'pointer' }}
              {...clickable(() => setMedTimes(medTimes.filter(x => x !== tm)), t('common.removeNamed', { name: fmtClockHHMM(tm) }))}>{fmtClockHHMM(tm)} <span aria-hidden>✕</span></span>
          ))}
          <div style={{ flex: 1 }} />
          <Btn variant="solid" onClick={addMedication}>{t('medical.addMedication')}</Btn>
        </div>
        {timeErr && <p role="alert" id={`${medId}-err`} style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{t('medical.invalidTime')}</p>}
      </MedicalCard>

      <MedicalCard title={t('medical.appointments')} empty={data.appointments.length === 0} emptyLabel={t('medical.noAppointments')}>
        {data.appointments.map(a => (
          <ItemRow key={a.id} title={a.title} subtitle={fmtTime(a.time)} onDelete={() => setConfirmDel({ kind: 'appointments', id: a.id })} />
        ))}
        <div style={rowStyle}>
          <input className="field__input" value={apptTitle} onChange={e => setApptTitle(e.target.value)} aria-label={t('medical.apptPlaceholder')} placeholder={t('medical.apptPlaceholder')} style={{ flex: 1, minWidth: 120 }} />
          <input className="field__input" aria-label={t('medical.apptWhen')} type="datetime-local" value={apptWhen} onChange={e => setApptWhen(e.target.value)} style={{ width: 200 }} />
          <select className="field__input" value={apptRemind} onChange={e => setApptRemind(Number(e.target.value))} aria-label={t('medical.remindBefore')} title={t('medical.remindBefore')} style={{ width: 130 }}>
            {REMIND_OPTIONS.map(([minutes, key]) => <option key={minutes} value={minutes}>{t(key)}</option>)}
          </select>
          <Btn variant="solid" onClick={addAppointment}>{t('medical.addAppointment')}</Btn>
        </div>
      </MedicalCard>

      <MedicalCard title={t('medical.history')} empty={data.history.length === 0} emptyLabel={t('medical.noHistory')}>
        {data.history.map(h => (
          <ItemRow key={h.id} title={h.title} subtitle={h.date ? fmtTime(h.date) : undefined} onDelete={() => setConfirmDel({ kind: 'history', id: h.id })} />
        ))}
        <div style={rowStyle}>
          <input className="field__input" value={histTitle} onChange={e => setHistTitle(e.target.value)} aria-label={t('medical.historyPlaceholder')} placeholder={t('medical.historyPlaceholder')} style={{ flex: 1, minWidth: 120 }} />
          <input className="field__input" aria-label={t('medical.historyDate')} type="date" value={histWhen} onChange={e => setHistWhen(e.target.value)} style={{ width: 160 }} />
          <Btn variant="solid" onClick={addHistory}>{t('medical.addHistory')}</Btn>
        </div>
      </MedicalCard>

      <div style={cardStyle}>
        <h3 style={cardTitleStyle}>{t('medical.emergency')}</h3>
        {emergencyField('conditions', t('medical.conditions'), t('medical.conditionsPlaceholder'))}
        {emergencyField('allergies', t('medical.allergies'), t('medical.allergiesPlaceholder'))}
        {emergencyField('bloodType', t('medical.bloodType'), t('medical.bloodTypePlaceholder'), true)}
        <Toggle label={t('medical.showOnNotification')} description={t('medical.emergencyDesc')}
          value={data.emergency.showOnNotification} onChange={v => setEmergency({ showOnNotification: v })} />
      </div>

      <ConfirmDialog open={!!confirmDel} title={t('common.delete')} message={t('medical.deleteItemMsg')}
        danger onConfirm={doDelete} onCancel={() => setConfirmDel(null)} />
      <SaveErrorDialog error={saveError} onClose={clearSaveError} />
    </div>
  );
}
