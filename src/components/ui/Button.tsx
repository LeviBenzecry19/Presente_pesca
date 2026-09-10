import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "accent" | "secondary" | "danger" | "outline" | "ghost";
type Size = "sm" | "md" | "lg" | "xl";

const VARIANT: Record<Variant, string> = {
  primary: "bg-brand text-white dark:text-[#132319] hover:brightness-110 active:brightness-95 shadow-sm",
  accent: "bg-accent text-[#38250f] hover:brightness-105 active:brightness-95 shadow-sm",
  secondary: "bg-surface-2 text-foreground hover:brightness-95 active:brightness-90",
  danger: "bg-danger text-white dark:text-[#1a0505] hover:brightness-110",
  outline: "border border-brand/40 text-brand bg-transparent hover:bg-brand-soft",
  ghost: "bg-transparent text-brand hover:bg-brand-soft",
};

const SIZE: Record<Size, string> = {
  sm: "min-h-11 px-3 text-sm gap-1.5",
  md: "min-h-12 px-4 text-base gap-2",
  lg: "min-h-14 px-5 text-lg gap-2",
  xl: "min-h-15 px-6 text-lg gap-3",
};

interface BaseProps {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}

type ButtonProps = BaseProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type LinkProps = BaseProps & { href: string; onClick?: never; disabled?: boolean };

export function Button(props: ButtonProps | LinkProps) {
  const { variant = "primary", size = "md", fullWidth, loading, icon, children, className = "" } = props;
  const base = `inline-flex items-center justify-center rounded-xl font-semibold leading-tight select-none transition disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${VARIANT[variant]} ${SIZE[size]} ${fullWidth ? "w-full" : ""} ${className}`;

  const content = (
    <>
      {loading ? <Spinner /> : icon}
      {children && <span>{children}</span>}
    </>
  );

  if ("href" in props && props.href !== undefined) {
    if (props.disabled || loading) return <span className={`${base} cursor-not-allowed opacity-50`} aria-disabled="true">{content}</span>;
    return (
      <Link href={props.href} className={base} aria-disabled={props.disabled}>
        {content}
      </Link>
    );
  }
  const { href: _href, variant: _v, size: _s, fullWidth: _f, loading: _l, icon: _i, className: _c, ...rest } =
    props as ButtonProps;
  void _href; void _v; void _s; void _f; void _l; void _i; void _c;
  return (
    <button type="button" {...rest} disabled={rest.disabled || loading} aria-busy={loading || undefined} className={base}>
      {content}
    </button>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-5 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}
