import React, { useRef, useEffect } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Announcements, ScreenReaderInstructions, UniqueIdentifier } from '@dnd-kit/core';

export const srOnly: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0,
};

export function SrOnly({ children, id }: { children: React.ReactNode; id?: string }) {
  return <span id={id} style={srOnly}>{children}</span>;
}

const SLOT = '\u0001';

export const slots = (...names: string[]): Record<string, string> =>
  Object.fromEntries(names.map((n): [string, string] => [n, `${SLOT}${n}${SLOT}`]));

export function Interp({ text, nodes, textStyle }: { text: string; nodes: Record<string, React.ReactNode>; textStyle?: React.CSSProperties }) {
  const parts = text.split(new RegExp(`${SLOT}(\\w+)${SLOT}`));
  return <>{parts.map((part, i) => (i % 2 === 1
    ? <React.Fragment key={i}>{nodes[part]}</React.Fragment>
    : textStyle && part ? <span key={i} style={textStyle}>{part}</span> : part))}</>;
}

export const activateOnKey = (fn?: () => void) => (e: React.KeyboardEvent) => {
  if ((e.key === 'Enter' || e.key === ' ') && fn) { e.preventDefault(); fn(); }
};

export const clickable = (onClick?: () => void, label?: string) => ({
  role: 'button' as const,
  tabIndex: 0,
  ...(label ? { 'aria-label': label } : {}),
  onClick,
  onKeyDown: activateOnKey(onClick),
});

export function useDndA11y(nameOf: (id: UniqueIdentifier) => string): { announcements: Announcements; screenReaderInstructions: ScreenReaderInstructions } {
  const { t } = useTranslation();
  const name = (id: UniqueIdentifier) => nameOf(id) || String(id);
  return {
    screenReaderInstructions: { draggable: t('dnd.instructions') },
    announcements: {
      onDragStart: ({ active }) => t('dnd.picked', { name: name(active.id) }),
      onDragOver: ({ active, over }) => over
        ? t('dnd.over', { name: name(active.id), over: name(over.id) })
        : t('dnd.notOver', { name: name(active.id) }),
      onDragEnd: ({ active, over }) => over
        ? t('dnd.dropped', { name: name(active.id), over: name(over.id) })
        : t('dnd.droppedNoTarget', { name: name(active.id) }),
      onDragCancel: ({ active }) => t('dnd.cancelled', { name: name(active.id) }),
    },
  };
}

const escapeStack: Array<() => void> = [];

export const tabListKeyDown = (e: ReactKeyboardEvent<HTMLElement>): void => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  const list = e.currentTarget.closest('[role="tablist"]');
  if (!list) return;
  const tabs = Array.from(list.querySelectorAll<HTMLElement>('[role="tab"]'));
  const i = tabs.indexOf(e.currentTarget);
  if (i < 0) return;
  const n = e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'Home' ? 0 : tabs.length - 1;
  e.preventDefault();
  tabs[n].focus();
  tabs[n].click();
};

export function useEscapeKey(active: boolean, onEscape: () => void) {
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;
  useEffect(() => {
    if (!active) return;
    const entry = () => onEscapeRef.current();
    escapeStack.push(entry);
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && escapeStack[escapeStack.length - 1] === entry) entry();
    };
    window.addEventListener('keydown', h);
    return () => {
      window.removeEventListener('keydown', h);
      const i = escapeStack.lastIndexOf(entry);
      if (i >= 0) escapeStack.splice(i, 1);
    };
  }, [active]);
}

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useDialogFocus(open: boolean, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const returnTo = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const visible = () => Array.from(node?.querySelectorAll<HTMLElement>(FOCUSABLE) || []).filter(el => el.offsetParent !== null);
    (visible()[0] || node)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !node) return;
      const items = visible();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === node)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      returnTo?.focus?.();
    };
  }, [open, ref]);
}
