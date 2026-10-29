import { useEffect, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";
import { Link } from "react-router";
import { ArrowDownRight, ArrowUpRight, X } from "lucide-react";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/* =========================================================================
   Sparkline — Pure inline SVG micro-chart matching Kamra PMS
   ========================================================================= */
export function Sparkline({
  data,
  color = "var(--color-brand-600)",
  width = 96,
  height = 32,
  fill = true,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  fill?: boolean;
}) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * w;
    const y = pad + h - ((v - min) / span) * h;
    return [x, y] as const;
  });
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${pad},${height - pad} ${line} ${width - pad},${height - pad}`;
  const [ex, ey] = pts[pts.length - 1];
  const id = `sg-${Math.round(pts[0][1])}-${data.length}-${Math.round(max)}`;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      aria-hidden
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={area} fill={`url(#${id})`} />
        </>
      )}
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={ex} cy={ey} r="2.4" fill={color} />
    </svg>
  );
}

/* =========================================================================
   StatCard — KPI Card with sparkline or progress bar
   ========================================================================= */
export function StatCard({
  icon,
  label,
  value,
  spark,
  sparkColor,
  progress,
  progressLabel,
  delta,
  sub,
  accent,
  to,
  className,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  spark?: number[];
  sparkColor?: string;
  progress?: number;
  progressLabel?: string;
  delta?: { value: string; dir?: "up" | "down" };
  sub?: ReactNode;
  accent?: boolean;
  to?: string;
  className?: string;
}) {
  const down = delta?.dir === "down";
  const content = (
    <>
      <div className="flex items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
          {icon}
        </span>
        <span className="truncate text-[13px] font-medium text-zinc-500">
          {label}
        </span>
      </div>
      <div className="mt-2.5 flex flex-wrap items-end justify-between gap-x-2 gap-y-1.5">
        <div className="max-w-full">
          <div
            className={cn(
              "text-2xl font-semibold tracking-tight tabular-nums",
              accent ? "text-brand-700" : "text-zinc-900",
            )}
          >
            <strong>{typeof value === "number" ? value.toLocaleString("vi-VN") : value}</strong>
          </div>
        </div>
        {spark ? (
          <div className="max-w-full shrink-0">
            <Sparkline data={spark} color={sparkColor} />
          </div>
        ) : null}
      </div>

      {sub ? <div className="mt-1 text-xs text-zinc-400">{sub}</div> : null}

      {progress !== undefined ? (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-brand-600"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
          {progressLabel ? (
            <div className="mt-1 text-xs text-zinc-400">{progressLabel}</div>
          ) : null}
        </div>
      ) : null}

      {delta ? (
        <div
          className={cn(
            "mt-3 flex items-center gap-1 text-xs font-medium",
            down ? "text-rose-600" : "text-emerald-600",
          )}
        >
          {down ? (
            <ArrowDownRight className="size-3.5" />
          ) : (
            <ArrowUpRight className="size-3.5" />
          )}
          <span>{delta.value}</span>
        </div>
      ) : null}
    </>
  );

  const baseClasses = cn(
    "block rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-all",
    to ? "hover:border-brand-300 hover:shadow" : "",
    className,
  );

  return to ? (
    <Link to={to} className={baseClasses}>
      {content}
    </Link>
  ) : (
    <div className={baseClasses}>{content}</div>
  );
}

/* =========================================================================
   Card & Structure Components
   ========================================================================= */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-200 bg-white shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center justify-between px-5 pt-4", className)}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "text-sm font-semibold tracking-wide text-zinc-700",
        className,
      )}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}

/* =========================================================================
   Badge — Toned Chips
   ========================================================================= */
export type BadgeTone =
  | "green"
  | "amber"
  | "rose"
  | "sky"
  | "zinc"
  | "indigo"
  | "brand";

const tones: Record<BadgeTone, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  rose: "bg-rose-50 text-rose-700 ring-rose-600/20",
  sky: "bg-sky-50 text-sky-700 ring-sky-600/20",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  zinc: "bg-zinc-100 text-zinc-600 ring-zinc-500/20",
  brand: "bg-brand-50 text-brand-700 ring-brand-600/20",
};

export function Badge({
  className,
  tone = "zinc",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

/* =========================================================================
   Avatar — Soft initials
   ========================================================================= */
const AVATAR_PALETTE = [
  "bg-brand-50 text-brand-700",
  "bg-sky-50 text-sky-700",
  "bg-amber-50 text-amber-700",
  "bg-rose-50 text-rose-700",
  "bg-indigo-50 text-indigo-700",
  "bg-emerald-50 text-emerald-700",
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function pickAvatarTint(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

export function Avatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
        pickAvatarTint(name),
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/* =========================================================================
   KamraButton — Clean Button variants
   ========================================================================= */
export type KamraButtonVariant = "primary" | "outline" | "ghost" | "danger";

const buttonVariants: Record<KamraButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-brand-600",
  outline:
    "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 focus-visible:outline-zinc-400",
  ghost: "text-zinc-600 hover:bg-zinc-100 focus-visible:outline-zinc-400",
  danger: "bg-rose-600 text-white hover:bg-rose-700 focus-visible:outline-rose-600",
};

export function KamraButton({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: KamraButtonVariant }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium",
        "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
        buttonVariants[variant],
        className,
      )}
      {...props}
    />
  );
}

/* =========================================================================
   Sheet — Right-side slide-over drawer
   ========================================================================= */
export function Sheet(props: {
  open?: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (props.open === false) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [props]);

  if (props.open === false) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/40 animate-fade-in"
        onClick={props.onClose}
        aria-hidden
      />
      <div
        className={cn(
          "absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-2xl animate-sheet-in",
          props.wide ? "md:w-2/3 max-w-4xl" : "max-w-md",
        )}
      >
        <div className="flex items-start justify-between border-b border-zinc-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">{props.title}</h2>
            {props.description && (
              <p className="mt-0.5 text-sm text-zinc-400">
                {props.description}
              </p>
            )}
          </div>
          <button
            type="button"
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            onClick={props.onClose}
            aria-label="Đóng"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">{props.children}</div>

        {props.footer && (
          <div className="border-t border-zinc-100 bg-zinc-50 px-6 py-4">
            {props.footer}
          </div>
        )}
      </div>
    </div>
  );
}
