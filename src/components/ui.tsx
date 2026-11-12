import type { ComponentProps, ReactNode } from "react";

export const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-base outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60";

const buttonVariants = {
  primary: "bg-accent text-accent-foreground hover:opacity-90",
  secondary: "border border-border bg-background hover:bg-foreground/5",
  ghost: "hover:bg-foreground/5",
};

export function buttonClass(variant: keyof typeof buttonVariants = "primary", extra = "") {
  return `inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${buttonVariants[variant]} ${extra}`;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof buttonVariants }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : hint ? (
        <p className="text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function FormMessage({ ok, children }: { ok?: boolean; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="status"
      className={`rounded-md px-3 py-2 text-sm ${
        ok
          ? "bg-accent/10 text-accent"
          : "bg-red-500/10 text-red-700 dark:text-red-400"
      }`}
    >
      {children}
    </p>
  );
}

export function Avatar({ name, image, size = 32 }: { name: string; image?: string | null; size?: number }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element -- avatar eksternal (Google), belum lewat R2
    return <img src={image} alt="" width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center rounded-full bg-accent/15 font-medium text-accent"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials || "?"}
    </span>
  );
}
