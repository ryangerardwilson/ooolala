import {forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes} from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md';

export function TerminalMark() {
  return (
    <span
      aria-hidden="true"
      className="grid h-[18px] w-[18px] place-items-center border border-[var(--oo-accent)] font-mono text-[10px] leading-none text-[var(--oo-accent)]"
    >
      &gt;
    </span>
  );
}

export function GithubMark({size = 13}: {size?: number}) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .3C5.37.3 0 5.67 0 12.3c0 5.3 3.44 9.8 8.2 11.38.6.11.82-.26.82-.58v-2.03c-3.34.72-4.04-1.61-4.04-1.61-.55-1.38-1.33-1.75-1.33-1.75-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.23 1.84 1.23 1.07 1.84 2.8 1.31 3.49 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23.96-.27 1.98-.4 3-.41 1.02.01 2.04.14 3 .41 2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.62-5.47 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12.02 12.02 0 0 0 24 12.3C24 5.67 18.63.3 12 .3Z" />
    </svg>
  );
}

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean}) {
  const variants = {
    primary: 'border-[var(--oo-accent)] bg-[var(--oo-accent)] font-semibold text-[var(--oo-accent-text)]',
    secondary: 'border-[var(--oo-line)] bg-[var(--oo-panel)] text-[var(--oo-fg)] hover:border-[var(--oo-accent)]',
    ghost: 'border-[var(--oo-line)] bg-transparent text-[var(--oo-fg)] hover:border-[var(--oo-accent)]'
  };
  const sizes = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 text-sm'
  };

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 border disabled:opacity-50 ${sizes[size]} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({
  children,
  className = '',
  size = 'md',
  variant = 'panel',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {size?: 'sm' | 'md' | 'lg'; variant?: 'panel' | 'strong' | 'ghost'}) {
  const sizes = {
    sm: 'h-8 w-8',
    md: 'h-9 w-9',
    lg: 'h-10 w-10'
  };
  const variants = {
    panel: 'bg-[var(--oo-panel)]',
    strong: 'bg-[var(--oo-panel-strong)]',
    ghost: 'bg-transparent'
  };

  return (
    <button
      className={`grid shrink-0 place-items-center border border-[var(--oo-line)] text-[var(--oo-fg)] disabled:opacity-40 enabled:hover:border-[var(--oo-accent)] ${sizes[size]} ${variants[variant]} ${className}`}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {fieldSize?: ButtonSize};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({className = '', fieldSize = 'md', ...props}, ref) {
  const sizes = {
    sm: 'h-9 text-sm',
    md: 'h-10 text-sm'
  };

  return (
    <input
      ref={ref}
      className={`w-full border border-[var(--oo-line)] bg-[var(--oo-panel-strong)] px-3 text-[var(--oo-fg)] outline-none transition focus:border-[var(--oo-accent)] ${sizes[fieldSize]} ${className}`}
      {...props}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({className = '', ...props}, ref) {
  return (
    <textarea
      ref={ref}
      className={`min-h-10 flex-1 resize-none border-0 bg-transparent py-2 text-sm leading-5 text-[var(--oo-fg)] outline-none ${className}`}
      {...props}
    />
  );
});

export function StatusText({children, className = ''}: {children: ReactNode; className?: string}) {
  if (!children) return null;
  return <p className={`text-sm leading-6 text-[var(--oo-warning)] ${className}`}>{children}</p>;
}
