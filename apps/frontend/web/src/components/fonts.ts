import type {CSSProperties} from 'react';

export type FontSchemeName = 'system' | 'mono';

export type FontScheme = {
  name: FontSchemeName;
  label: string;
  body: string;
  mono: string;
};

export const fontSchemes = {
  system: {
    name: 'system',
    label: 'System',
    body: 'Arial, Helvetica, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
  },
  mono: {
    name: 'mono',
    label: 'Mono',
    body: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
  }
} satisfies Record<FontSchemeName, FontScheme>;

export function getFontScheme(name: FontSchemeName = 'system') {
  return fontSchemes[name];
}

export function fontVars(name: FontSchemeName = 'system'): CSSProperties {
  const scheme = getFontScheme(name);

  return {
    '--oo-font-body': scheme.body,
    '--oo-font-mono': scheme.mono
  } as CSSProperties;
}
