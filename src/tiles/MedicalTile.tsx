import React from 'react';
import { useTranslation } from 'react-i18next';
import { fmtClockHHMM, fmtTime, fmtList } from '../utils';
import { useAppStore } from '../store/appStore';
import { Tile } from '../components/Tile';

interface Props { onClick: () => void; }

const SECTION_LABEL: React.CSSProperties = { fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8, marginBottom: 2 };
const ROW: React.CSSProperties = { fontSize: 13, color: 'var(--text)', display: 'flex', gap: 6, alignItems: 'baseline' };
const ELLIPSIS: React.CSSProperties = { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const MED_PREVIEW = 3;
const APPT_PREVIEW = 2;

export default function MedicalTile({ onClick }: Props) {
  const { t } = useTranslation();
  const data = useAppStore(s => s.medical);

  const meds = (data.medications || []).filter(m => m.enabled);
  const now = Date.now();
  const upcoming = (data.appointments || []).filter(a => a.time >= now).sort((a, b) => a.time - b.time);
  const e = data.emergency || { showOnNotification: false };
  const emergencyLine = [e.conditions, e.allergies, e.bloodType].map(x => (x || '').trim()).filter(Boolean).join(' · ');
  const empty = meds.length === 0 && upcoming.length === 0 && !emergencyLine;

  return (
    <Tile glyph="⚕" title={t('medical.title')} onClick={onClick}>
      {empty && <span className="tile__empty">{t('medical.noMedications')}</span>}

      {meds.length > 0 && (<>
        <div style={SECTION_LABEL}>{t('medical.medications')}</div>
        {meds.slice(0, MED_PREVIEW).map(m => (
          <div key={m.id} style={ROW}>
            <span aria-hidden>💊</span>
            <span style={ELLIPSIS}>{m.name}</span>
            {m.times.length > 0 && <span style={{ color: 'var(--muted)', fontSize: 11 }}>{fmtList(m.times.map(fmtClockHHMM))}</span>}
          </div>
        ))}
        {meds.length > MED_PREVIEW && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{t('share.more', { count: meds.length - MED_PREVIEW })}</span>}
      </>)}

      {upcoming.length > 0 && (<>
        <div style={SECTION_LABEL}>{t('medical.appointments')}</div>
        {upcoming.slice(0, APPT_PREVIEW).map(a => (
          <div key={a.id} style={ROW}>
            <span aria-hidden>📅</span>
            <span style={ELLIPSIS}>{a.title}</span>
            <span style={{ color: 'var(--muted)', fontSize: 11 }}>{fmtTime(a.time)}</span>
          </div>
        ))}
      </>)}

      {emergencyLine && (<>
        <div style={SECTION_LABEL}>{t('medical.emergency')}</div>
        <div style={{ fontSize: 12, color: 'var(--danger)', display: 'flex', gap: 6 }}>
          <span aria-hidden>⚠</span><span style={{ flex: 1 }}>{emergencyLine}</span>
        </div>
      </>)}
    </Tile>
  );
}
