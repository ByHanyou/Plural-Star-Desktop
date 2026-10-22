import { useTranslation } from 'react-i18next';
import { CREDITS } from '../utils';

export default function CreditsView() {
  const { t } = useTranslation();
  return (
    <div className="credits-view">
      {CREDITS.map(c => (
        <a key={c.url} href={c.url} target="_blank" rel="noopener noreferrer" className="credit-row"
          style={{ display: 'flex', alignItems: 'center', padding: 14, marginBottom: 10, borderRadius: 14, border: '1px solid var(--border)', backgroundColor: 'var(--card)', textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
          <span aria-hidden style={{ fontSize: 22, color: 'var(--accent)', marginRight: 14 }}>✦</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{c.name}</div>
            <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>{t(c.roleKey)}</div>
          </div>
          <span aria-hidden style={{ fontSize: 14, color: 'var(--dim)', marginLeft: 8 }}>↗</span>
        </a>
      ))}
    </div>
  );
}
