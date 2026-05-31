import type {CSSProperties, MouseEventHandler, ReactNode, Ref} from 'react';
import {colorVars, type ColorSchemeName} from './colors';
import {fontVars, type FontSchemeName} from './fonts';

export type SurfaceProps = {
  children: ReactNode;
  colorScheme?: ColorSchemeName;
  fontScheme?: FontSchemeName;
  className?: string;
};

export function Surface({children, colorScheme = 'terminal', fontScheme = 'system', className = ''}: SurfaceProps) {
  const style = {
    ...colorVars(colorScheme),
    ...fontVars(fontScheme)
  } as CSSProperties;

  return (
    <div className={`min-h-screen bg-[var(--oo-bg)] text-[var(--oo-fg)] ${className}`} style={style}>
      {children}
    </div>
  );
}

export function Screen({children, className = ''}: {children: ReactNode; className?: string}) {
  return <main className={`min-h-screen overflow-hidden bg-[var(--oo-bg)] text-[var(--oo-fg)] ${className}`}>{children}</main>;
}

export function TopBar({
  brand,
  detail,
  actions
}: {
  brand: ReactNode;
  detail?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex min-h-14 items-center justify-between border-b border-[var(--oo-line)] bg-[var(--oo-panel)] px-4">
      <div className="min-w-0">
        {brand}
        {detail && <div className="mt-1 truncate text-xs text-[var(--oo-muted)]">{detail}</div>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Center({children, className = ''}: {children: ReactNode; className?: string}) {
  return <div className={`grid min-h-screen place-items-center px-4 ${className}`}>{children}</div>;
}

export function PageWidth({children, className = '', max = 'max-w-[980px]'}: {children: ReactNode; className?: string; max?: string}) {
  return <div className={`mx-auto w-full ${max} ${className}`}>{children}</div>;
}

export function Stack({children, gap = 'gap-3', className = ''}: {children: ReactNode; gap?: string; className?: string}) {
  return <div className={`grid ${gap} ${className}`}>{children}</div>;
}

export function Inline({children, className = ''}: {children: ReactNode; className?: string}) {
  return <div className={`flex items-center gap-2 ${className}`}>{children}</div>;
}

export function Panel({children, className = ''}: {children: ReactNode; className?: string}) {
  return <section className={`border border-[var(--oo-line)] bg-[var(--oo-panel)] ${className}`}>{children}</section>;
}

export function ChatShell({children, className = ''}: {children: ReactNode; className?: string}) {
  return (
    <section className={`flex min-h-0 flex-1 flex-col overflow-hidden border border-[var(--oo-line)] bg-[var(--oo-panel)] ${className}`}>
      {children}
    </section>
  );
}

export function ChatHeader({children, actions}: {children: ReactNode; actions?: ReactNode}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--oo-line)] px-4">
      <div className="min-w-0">{children}</div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Transcript({children, scrollRef}: {children: ReactNode; scrollRef?: Ref<HTMLDivElement>}) {
  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto px-4 py-5">
      {children}
    </div>
  );
}

export function ComposerDock({children}: {children: ReactNode}) {
  return <div className="shrink-0 border-t border-[var(--oo-line)] p-3">{children}</div>;
}

export function ModalLayer({children, contained = false, onMouseDown}: {children: ReactNode; contained?: boolean; onMouseDown?: MouseEventHandler<HTMLDivElement>}) {
  return (
    <div
      className={`${contained ? 'absolute' : 'fixed z-50'} inset-0 grid place-items-center bg-[rgba(3,4,3,0.64)] px-4 py-6 backdrop-blur-sm`}
      onMouseDown={onMouseDown}
    >
      {children}
    </div>
  );
}
