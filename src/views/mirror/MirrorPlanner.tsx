import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { MirrorAppointment, MirrorPlannerPayload, MirrorReminder } from '../../network/types';
import { fmtClockHHMM, fmtTime } from '../../utils';
import { Nothing } from './shared';

const card: CSSProperties = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 8 };
const heading: CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--dim)', margin: '0 0 8px' };
const line = (color: string): CSSProperties => ({ fontSize: 11, color, marginTop: 2 });

export function MirrorPlanner({ data }: { data: Partial<MirrorPlannerPayload> }) {
  const { t } = useTranslation();
  const appts: MirrorAppointment[] = (Array.isArray(data.appointments) ? data.appointments : []).filter(Boolean)
    .sort((a, b) => (Number(a.time) || 0) - (Number(b.time) || 0));
  const rems: MirrorReminder[] = (Array.isArray(data.reminders) ? data.reminders : []).filter(Boolean);
  if (appts.length === 0 && rems.length === 0) return <Nothing />;
  return (
    <div>
      {appts.length > 0 && (
        <>
          <h3 style={heading}>{t('planner.appt')}</h3>
          {appts.map((a, i) => (
            <div key={`${String(a.id || a.time)}-${i}`} style={card}>
              <div style={{ fontSize: 13, fontWeight: 600, color: a.color || 'var(--text)' }}>{String(a.title || '')}</div>
              <div style={line('var(--dim)')}>{fmtTime(Number(a.time) || 0)}</div>
              {a.location && <div style={line('var(--muted)')}>{String(a.location)}</div>}
              {a.notes && <div style={line('var(--muted)')}>{String(a.notes)}</div>}
            </div>
          ))}
        </>
      )}
      {rems.length > 0 && (
        <>
          <h3 style={{ ...heading, marginTop: appts.length > 0 ? 12 : 0 }}>{t('planner.reminders')}</h3>
          {rems.map((r, i) => (
            <div key={`${String(r.id || r.title)}-${i}`} style={{ ...card, opacity: r.enabled === false ? 0.5 : 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{String(r.title || '')}</div>
              {Array.isArray(r.times) && r.times.length > 0 && (
                <div style={line('var(--dim)')}>{r.times.map(tm => fmtClockHHMM(String(tm))).join('  ·  ')}</div>
              )}
              {r.notes && <div style={line('var(--muted)')}>{String(r.notes)}</div>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
