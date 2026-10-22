import type { FrontTierKey, Member } from './utils';
import { isValidHex } from './utils/colors';
import { deriveColors, profileColors, DARK_PALETTE } from './themeColors';
import type { ThemeColorSet } from './themeColors';

export { hexToRgb, initialOn, contrastRatio, ensureReadable, textFloor, inkOn, readableAccentColor, DARK_PALETTE, LIGHT_PALETTE, BUILTIN_PALETTES, MAX_CUSTOM_PALETTES, PALETTE } from './themeColors';
export type { CustomPalette } from './themeColors';

export type ThemeColors = ThemeColorSet;

export const deriveTheme = deriveColors;

export const profileTheme = profileColors;

export const tint = (color: string, pct: number): string => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

export const themeVars = (theme: ThemeColors): Record<string, string> => ({
  '--bg': theme.bg,
  '--surface': theme.surface,
  '--card': theme.card,
  '--border': theme.border,
  '--border-lt': theme.borderLt,
  '--accent': theme.accent,
  '--accent-bg': theme.accentBg,
  '--text': theme.text,
  '--dim': theme.dim,
  '--muted': theme.muted,
  '--toggle-off': theme.toggleOff,
  '--danger': theme.danger,
  '--danger-bg': theme.dangerBg,
  '--success': theme.success,
  '--success-bg': theme.successBg,
  '--info': theme.info,
  '--info-bg': theme.infoBg,
});

export const cssVar = (name: string): string =>
  typeof getComputedStyle === 'function' ? getComputedStyle(document.documentElement).getPropertyValue(name).trim() : '';

export const liveThemeBase = (): Pick<ThemeColors, 'accent' | 'danger' | 'success' | 'info'> => {
  const read = (name: string, fallback: string) => {
    const v = cssVar(name);
    return /^#[0-9A-Fa-f]{6}$/.test(v) ? v : fallback;
  };
  return {
    accent: read('--accent', DARK_PALETTE.accent),
    danger: read('--danger', '#d9534f'),
    success: read('--success', '#4caf8a'),
    info: read('--info', '#7B9FE8'),
  };
};

export const memberProfileTheme = (m: Pick<Member, 'profileBg' | 'color'> | undefined): ThemeColors | null =>
  m?.profileBg && isValidHex(m.color) ? profileTheme(liveThemeBase(), m.color) : null;

export const TIER_COLOR: Record<FrontTierKey, string> = {
  primary: 'var(--accent)',
  coFront: 'var(--info)',
  coConscious: 'var(--success)',
};

export function applyThemeToDOM(theme: ThemeColors): void {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(themeVars(theme))) root.style.setProperty(name, value);
}

export function applyTextScale(scale: number): void {
  document.body.style.zoom = String(scale);
}

export type FontChoice = 'default' | 'opendyslexic' | 'atkinson' | 'lexend' | 'comicneue' | 'cause' | 'gelasio' | 'anton';

const FONT_BODY_FALLBACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";

export const FONT_OPTIONS: { value: FontChoice; label: string; css: string | null }[] = [
  { value: 'default', label: 'Default', css: null },
  { value: 'opendyslexic', label: 'OpenDyslexic', css: null },
  { value: 'atkinson', label: 'Atkinson Hyperlegible', css: `'Atkinson Hyperlegible', ${FONT_BODY_FALLBACK}` },
  { value: 'lexend', label: 'Lexend', css: `'Lexend', ${FONT_BODY_FALLBACK}` },
  { value: 'comicneue', label: 'Comic Neue', css: `'Comic Neue', ${FONT_BODY_FALLBACK}` },
  { value: 'cause', label: 'Cause', css: `'Cause', ${FONT_BODY_FALLBACK}` },
  { value: 'gelasio', label: 'Gelasio', css: "'Gelasio', Georgia, 'Times New Roman', serif" },
  { value: 'anton', label: 'Anton', css: "'Anton', Impact, sans-serif" },
];

export function applyFontChoice(choice?: FontChoice): void {
  const root = document.documentElement;
  const opt = FONT_OPTIONS.find(o => o.value === choice) || FONT_OPTIONS[0];
  root.style.removeProperty('--font-body');
  root.style.removeProperty('--font-display');
  if (opt.value === 'default') {
    root.classList.add('no-dyslexic');
    return;
  }
  root.classList.remove('no-dyslexic');
  if (opt.value !== 'opendyslexic' && opt.css) {
    root.style.setProperty('--font-body', opt.css);
    const displayFamily = opt.css.split(',')[0].trim();
    root.style.setProperty('--font-display', `${displayFamily}, var(--font-display-fallback)`);
  }
}
