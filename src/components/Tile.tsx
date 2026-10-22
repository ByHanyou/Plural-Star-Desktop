import React from 'react';
import { activateOnKey, clickable } from './ui';

const ACTION_STYLE: React.CSSProperties = {
  marginLeft: 'auto', fontSize: 11, fontWeight: 500, fontFamily: 'inherit', padding: '3px 10px', borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--accent-bg)', color: 'var(--accent)', cursor: 'pointer',
};

export function Tile({ glyph, title, onClick, center = false, action, children }: {
  glyph: string;
  title: string;
  onClick: () => void;
  center?: boolean;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  return (
    <div className={center ? 'tile tile--center' : 'tile'} {...(action ? { onClick } : clickable(onClick))}>
      <div className="tile__header">
        <div className="tile__glyph" aria-hidden>{glyph}</div>
        {action ? (
          <>
            <span className="tile__title" role="button" tabIndex={0} onKeyDown={activateOnKey(onClick)}>{title}</span>
            <button onClick={e => { e.stopPropagation(); action.onClick(); }} style={ACTION_STYLE}>{action.label}</button>
          </>
        ) : (
          <span className="tile__title">{title}</span>
        )}
      </div>
      <div className="tile__body">{children}</div>
    </div>
  );
}
