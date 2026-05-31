import type {CSSProperties} from 'react';

export type ColorRole =
  | 'bg'
  | 'fg'
  | 'fgSoft'
  | 'muted'
  | 'line'
  | 'panel'
  | 'panelStrong'
  | 'accent'
  | 'accentMuted'
  | 'accentText'
  | 'warning'
  | 'info';

export type ColorSchemeName = 'terminal' | 'paper';

export type ColorScheme = {
  name: ColorSchemeName;
  label: string;
  roles: Record<ColorRole, string>;
};

export const colorSchemes = {
  terminal: {
    name: 'terminal',
    label: 'Terminal dark',
    roles: {
      bg: '#10110f',
      fg: '#f0f1ed',
      fgSoft: '#d9ddd3',
      muted: '#8d9288',
      line: '#2b2e29',
      panel: '#171914',
      panelStrong: '#1f221b',
      accent: '#4cc9a6',
      accentMuted: '#347e68',
      accentText: '#07100c',
      warning: '#d7b46a',
      info: '#81a8d8'
    }
  },
  paper: {
    name: 'paper',
    label: 'Paper light',
    roles: {
      bg: '#f4f2ec',
      fg: '#191b18',
      fgSoft: '#343931',
      muted: '#73786e',
      line: '#d8d2c4',
      panel: '#fffdf6',
      panelStrong: '#ebe6d8',
      accent: '#167b67',
      accentMuted: '#88baaa',
      accentText: '#f4fff9',
      warning: '#9a6a19',
      info: '#335f91'
    }
  }
} satisfies Record<ColorSchemeName, ColorScheme>;

export function getColorScheme(name: ColorSchemeName = 'terminal') {
  return colorSchemes[name];
}

export function colorVars(name: ColorSchemeName = 'terminal'): CSSProperties {
  const roles = getColorScheme(name).roles;

  return {
    '--oo-bg': roles.bg,
    '--oo-fg': roles.fg,
    '--oo-fg-soft': roles.fgSoft,
    '--oo-muted': roles.muted,
    '--oo-line': roles.line,
    '--oo-panel': roles.panel,
    '--oo-panel-strong': roles.panelStrong,
    '--oo-accent': roles.accent,
    '--oo-accent-muted': roles.accentMuted,
    '--oo-accent-text': roles.accentText,
    '--oo-warning': roles.warning,
    '--oo-info': roles.info
  } as CSSProperties;
}
