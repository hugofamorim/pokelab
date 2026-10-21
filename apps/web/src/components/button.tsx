import type { ButtonHTMLAttributes } from 'react';
export function Button({
  variant = 'primary',
  loading = false,
  children,
  disabled,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      className={`button button-${variant} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading}
    >
      {loading ? 'Carregando…' : children}
    </button>
  );
}
