import Link from "next/link";
import type { ReactNode } from "react";

export type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  active?: boolean;
};

export type PillTone = "accent" | "danger" | "neutral" | "success" | "warning";

export function ReplayXMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? "rx-mark rx-mark-compact" : "rx-mark"} aria-hidden="true">
      <svg viewBox="0 0 48 48" role="img" focusable="false">
        <path
          d="M8 10.5C8 8.57 9.57 7 11.5 7h16.1C35.5 7 41 12.08 41 19.09c0 4.77-2.55 8.58-6.73 10.56L41.52 41H32.7l-6.18-9.86H17.2V41H8V10.5Z"
          className="rx-mark-fill"
        />
        <path
          d="M17.2 23.9h9.45c3.18 0 5.17-1.78 5.17-4.63 0-2.92-1.99-4.61-5.17-4.61H17.2v9.24Z"
          className="rx-mark-cut"
        />
        <path d="M26.36 41 36.7 27.07h8.1L34.34 41h-7.98Z" className="rx-mark-cut" />
      </svg>
    </span>
  );
}

export function BrandLockup({ href = "/", subtitle = "Proof engine" }: { href?: string; subtitle?: string }) {
  return (
    <Link className="brand-lockup" href={href}>
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
              <span className="rail-glyph">{item.shortLabel}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="rail-status">
          <span>{controlPlaneLabel ?? "Control plane"}</span>
          <strong>{statusDetail ?? "Operator surface"}</strong>
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
