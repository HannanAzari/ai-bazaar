import type { ButtonHTMLAttributes } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const styles = {
  primary: "bg-timber-dark text-parchment shadow-soft hover:bg-timber",
  accent: "bg-ember text-[#3d2410] shadow-soft hover:bg-lantern",
  outline: "border border-timber/30 bg-parchment/70 text-ink shadow-soft hover:border-timber/50 hover:bg-parchment",
  ghost: "text-ink-soft hover:bg-ink/5 hover:text-ink",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof styles;
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50",
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: keyof typeof styles;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold transition",
        styles[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}
