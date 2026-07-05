import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { store, KEYS } from '../storage';

interface Props { onClick: () => void; }

export default function WhiteboardTile({ onClick }: Props) {
  const { t } = useTranslation();
  const [strokeCount, setStrokeCount] = useState(0);
  useEffect(() => {
    store.get<any[]>(KEYS.whiteboard, []).then(s => setStrokeCount((s || []).length));
  }, []);

  return (
    <div className="tile tile--clickable" role="button" tabIndex={0} onClick={onClick} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}>
      <div className="tile__header"><div className="tile__glyph">🖌</div><span className="tile__title">{t('whiteboard.title')}</span></div>
      <div className="tile__body">
        {strokeCount === 0 ? (
          <span className="tile__empty">{t('whiteboard.draw')}</span>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text)' }}>✎ {strokeCount}</div>
        )}
      </div>
    </div>
  );
}
