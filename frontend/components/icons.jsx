// Small inline icon set shared across app/(app) pages (Lend, Swap, RWA, ...).
// Hand-drawn instead of an icon-font dependency, so the app stays self-hosted.
// Every icon takes an optional `size` (px) so the same glyph can sit in a
// stat tile (18px), a nav tab (15px) or a panel title (14px) at native size.

export function IconLayers({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <path d="M9 2.3 16 6.3 9 10.3 2 6.3 9 2.3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M2 9.6 9 13.6 16 9.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconShield({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <path
        d="M9 1.6 15.4 4 15.4 8.6C15.4 12.5 12.6 15.2 9 16.4 5.4 15.2 2.6 12.5 2.6 8.6L2.6 4 9 1.6Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M6.1 9 8.2 11 12 6.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconPercent({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <circle cx="5.4" cy="5.4" r="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12.6" cy="12.6" r="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M13.5 3.5 4.5 14.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconFlip({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 15 15" fill="none">
      <path d="M4 3v8M4 11 1.5 8.5M4 11l2.5-2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 12V4M11 4l2.5 2.5M11 4 8.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconDroplet({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path
        d="M8 1.7C8 1.7 3.1 7.4 3.1 10.3A4.9 4.9 0 0 0 8 15.2A4.9 4.9 0 0 0 12.9 10.3C12.9 7.4 8 1.7 8 1.7Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconCalendar({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <rect x="2" y="3.2" width="14" height="12.6" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 7h14" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.5 1.6v3M12.5 1.6v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconClock({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9 5v4l3 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconCalendarClock({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1.6" y="2.8" width="12.8" height="11.6" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.6 6.2h12.8" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4.6 1.4v2.6M11.4 1.4v2.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="9.7" cy="10" r="3.1" fill="var(--surface-2, #fff)" stroke="currentColor" strokeWidth="1.2" />
      <path d="M9.7 8.5v1.6l1.1 0.7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconLock({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <rect x="3.5" y="8" width="11" height="8" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.8 8V5.6a3.2 3.2 0 0 1 6.4 0V8" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="9" cy="11.8" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function IconCheckCircle({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.2 8.2 7.2 10.2 11 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconLoader({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 1.6a6.4 6.4 0 1 1 -6.4 6.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconCircleEmpty({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.6" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function IconSwapHorizontal({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 15 15" fill="none">
      <path d="M2 5h9M8.5 2.5 11 5 8.5 7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 10H4M6.5 12.5 4 10l2.5-2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconTrendUp({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <path d="M2 13 7 8l3 3 6-6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 5h3v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconShieldCheck({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <path
        d="M9 1.6 15.4 4 15.4 8.6C15.4 12.5 12.6 15.2 9 16.4 5.4 15.2 2.6 12.5 2.6 8.6L2.6 4 9 1.6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M6.1 9 8.2 11 12 6.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconWallet({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <rect x="1.6" y="4.5" width="14.8" height="10.5" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1.6 7.6h14.8" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12.6" cy="11.2" r="1" fill="currentColor" />
    </svg>
  );
}

export function IconHistory({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <path d="M2.6 9A6.4 6.4 0 1 0 4.4 4.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M2.1 3.6 2.6 9 5.1 6.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 5.6v3.6l2.4 1.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconBank({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <path d="M2 6.2 9 2l7 4.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="2" y="6.2" width="14" height="1.6" fill="currentColor" />
      <path d="M4.2 8.6v5.4M9 8.6v5.4M13.8 8.6v5.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M2 15.4h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconRoute({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <circle cx="3.4" cy="4" r="1.8" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="14.6" cy="14" r="1.8" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4.8 5.3C7 7 6 9 9 9s2 3.7 4.2 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeDasharray="0.5 2.6" />
    </svg>
  );
}

export function IconCursor({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <path
        d="M4 2 4 14 7.2 11.2 9 15.5 11 14.6 9.2 10.4 13 10.2Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconArrowUp({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconChart({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9 2v7l5.2 3.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
