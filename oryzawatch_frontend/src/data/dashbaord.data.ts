// ─── Types ───────────────────────────────────────────────────────────────────
// Defined here so Dashboard.tsx .map() callbacks are never implicitly `any`.
// The stat cards are computed from real data in DashboardView.tsx.

export interface StatItem {
  value: string;
  label: string;
  sub: string;
  subColor: string;
}
