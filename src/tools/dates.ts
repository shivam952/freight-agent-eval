// Date / transit tool: deterministic. The model turns messy text ("rdy wk 46", "mid Dec",
// "before the xmas sale") into a ready date or ISO week and a deadline; this tool does the
// arithmetic: week -> dates, + transit time, compared with the deadline.
//
// Frozen assumptions (check before relying on them):
// - Asia -> Northern Europe, ready-at-origin to arrival at the destination seaport:
//   35-50 days (origin handling + sea transit + discharge).
// - Inland destination (not an ocean gateway): +2 to +5 days.

export type DeadlineRisk = "none" | "at_risk" | "impossible";
export type DateNote = "ok" | "no_deadline" | "unknown_ready_date" | "unparseable";

export interface DateCheck {
  ready_window: [string, string] | null; // ISO dates, earliest-latest ready
  arrival_window: [string, string] | null; // ISO dates, earliest-latest arrival
  deadline: string | null;
  risk: DeadlineRisk;
  note: DateNote;
}

const SEA_DAYS: [number, number] = [35, 50];
const INLAND_DAYS: [number, number] = [2, 5];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/** ISO week: Monday of week 1 is the Monday on or before Jan 4. */
export function isoWeekRange(year: number, week: number): [Date, Date] {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday1 = addDays(jan4, -((jan4.getUTCDay() + 6) % 7));
  const start = addDays(monday1, (week - 1) * 7);
  return [start, addDays(start, 6)];
}

/** Accepts "YYYY-MM-DD" or "YYYY-Www" (ISO week). Returns [earliest, latest] or null. */
export function parseReady(text: string): [Date, Date] | null {
  const t = text.trim().toUpperCase();
  const w = /^(\d{4})-W(\d{1,2})$/.exec(t);
  if (w) return isoWeekRange(Number(w[1]), Number(w[2]));
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const d = new Date(`${t}T00:00:00Z`);
    return isNaN(d.getTime()) ? null : [d, d];
  }
  return null;
}

export function deadlineCheck(ready: string, deadline: string, inland: boolean): DateCheck {
  const readyWin = ready.trim() ? parseReady(ready) : null;
  const dl = deadline.trim() ? parseReady(deadline) : null;
  if (ready.trim() && !readyWin) return { ready_window: null, arrival_window: null, deadline: null, risk: "none", note: "unparseable" };
  if (deadline.trim() && !dl) return { ready_window: null, arrival_window: null, deadline: null, risk: "none", note: "unparseable" };

  const extra = inland ? INLAND_DAYS : [0, 0];
  const arrival: [Date, Date] | null = readyWin
    ? [addDays(readyWin[0], SEA_DAYS[0] + extra[0]), addDays(readyWin[1], SEA_DAYS[1] + extra[1])]
    : null;
  const base = {
    ready_window: readyWin ? ([iso(readyWin[0]), iso(readyWin[1])] as [string, string]) : null,
    arrival_window: arrival ? ([iso(arrival[0]), iso(arrival[1])] as [string, string]) : null,
    deadline: dl ? iso(dl[1]) : null,
  };
  if (!dl) return { ...base, risk: "none", note: readyWin ? "no_deadline" : "unknown_ready_date" };
  if (!arrival) return { ...base, risk: "none", note: "unknown_ready_date" };

  const due = dl[1]; // a week as deadline means "by the end of that week"
  const risk: DeadlineRisk = arrival[0] > due ? "impossible" : arrival[1] > due ? "at_risk" : "none";
  return { ...base, risk, note: "ok" };
}
