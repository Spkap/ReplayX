import Link from "next/link";
import type { ReactNode } from "react";

import { ThemeToggle } from "./theme-toggle";

export type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  active?: boolean;
};

export type PillTone = "accent" | "danger" | "neutral" | "success" | "warning";

const navGlyphs: Record<string, ReactNode> = {
  Analytics: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 18V9m7 9V5m7 13v-6" />
    </svg>
  ),
  Home: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 11.5 12 5l7.5 6.5V20h-5v-5h-5v5h-5v-8.5Z" />
    </svg>
  ),
  "New run": (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Ops: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7h14M5 12h14M5 17h14" />
    </svg>
  ),
  Proof: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12 4 4L19 6" />
    </svg>
  )
};

export function ReplayXMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? "rx-mark rx-mark-compact" : "rx-mark"} aria-hidden="true">
      <svg viewBox="0 0 56 56" role="img" focusable="false">
        <path
          className="rx-mark-field"
          d="M28 3.5c13.53 0 24.5 10.97 24.5 24.5S41.53 52.5 28 52.5 3.5 41.53 3.5 28 14.47 3.5 28 3.5Z"
        />
        <path
          className="rx-mark-line"
          d="M15.6 17.7h14.3c6.3 0 10.4 3.55 10.4 9 0 3.7-1.9 6.55-5.05 8.05l6.1 8.55h-7.5l-5.1-7.45h-6.7v7.45H15.6V17.7Z"
        />
        <path className="rx-mark-cut" d="M22.05 30.2h7.65c2.55 0 4.1-1.25 4.1-3.35 0-2.16-1.55-3.3-4.1-3.3h-7.65v6.65Z" />
        <path className="rx-mark-accent" d="m31.85 43.3 9.7-13.1h6.8l-9.85 13.1h-6.65Z" />
      </svg>
    </span>
  );
}

export function BrandLockup({ href = "/", subtitle = "Incident proof engine" }: { href?: string; subtitle?: string }) {
  return (
    <Link className="brand-lockup" href={href} aria-label="ReplayX home">
      <ReplayXMark />
      <span>
        <strong>ReplayX</strong>
        <span>{subtitle}</span>
      </span>
    </Link>
  );
}

export function AppFrame({
  active,
  children,
  controlPlaneLabel,
  homePath = "/",
  navItems,
  statusDetail
}: {
  active: string;
  children: ReactNode;
  controlPlaneLabel?: string;
  homePath?: string;
  navItems?: NavItem[];
  statusDetail?: string;
}) {
  const items =
    navItems ??
    [
      { href: homePath, label: "Home", shortLabel: "HM", active: active === "home" },
      { href: "/new", label: "New run", shortLabel: "NR", active: active === "new" },
      { href: "/ops", label: "Ops", shortLabel: "OP", active: active === "ops" },
      { href: "/analytics", label: "Analytics", shortLabel: "AN", active: active === "analytics" }
    ];

  return (
    <div className="app-frame">
      <aside className="app-rail" aria-label="ReplayX navigation">
        <BrandLockup href={homePath} />
        <nav className="rail-nav">
          {items.map((item) => (
            <Link
              aria-current={item.active ? "page" : undefined}
              className={item.active ? "rail-link rail-link-active" : "rail-link"}
              href={item.href}
              key={`${item.label}-${item.href}`}
            >
              <span className="rail-glyph">{navGlyphs[item.label] ?? item.shortLabel}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="rail-footer">
          <div className="rail-status">
            <span>{controlPlaneLabel ?? "Control plane"}</span>
            <strong>{statusDetail ?? "Operator surface"}</strong>
          </div>
          <ThemeToggle />
        </div>
      </aside>
      <main className="app-main">{children}</main>
    </div>
  );
}

export function PageHeader({
  actions,
  eyebrow,
  lead,
  meta,
  title
}: {
  actions?: ReactNode;
  eyebrow?: string;
  lead?: string;
  meta?: ReactNode;
  title: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {lead ? <p className="lead">{lead}</p> : null}
        {meta ? <div className="header-meta">{meta}</div> : null}
      </div>
      {actions ? <div className="header-actions">{actions}</div> : null}
    </header>
  );
}

export function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: PillTone }) {
  return <span className={`status-pill status-${tone}`}>{children}</span>;
}

export function MetricCell({
  label,
  value,
  detail,
  tone = "neutral"
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: PillTone;
}) {
  return (
    <div className={`metric-cell metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <p>{detail}</p> : null}
    </div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  body
}: {
  eyebrow?: string;
  title: ReactNode;
  body?: ReactNode;
}) {
  return (
    <div className="section-header">
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      <h2>{title}</h2>
      {body ? <p>{body}</p> : null}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <ReplayXMark compact />
      <div>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
    </div>
  );
}

export function CommandBlock({ children, success = false }: { children: ReactNode; success?: boolean }) {
  return <pre className={success ? "command-block command-block-success" : "command-block"}>{children}</pre>;
}
