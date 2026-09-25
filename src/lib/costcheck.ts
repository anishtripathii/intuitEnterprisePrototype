// SiteLog CostCheck: a partner agent that compares approved crew time with payroll's labor allocation
// and proposes moving labor cost between projects. The same function runs in the Proving Ground
// (against synthetic cases) and on a customer's data once installed. It has no database access:
// the platform hands it only the scopes it declared.

export type Alloc = { worker: string; project: string; hours: number; amount: number };
export type TimeEntry = { worker: string; project: string; week: string; hours: number; approved: boolean; source: "sitelog" | "ies_time" };
export type AgentConfig = {
  permissions: string[];
  toleranceHours: number;
  abstainUnapproved: boolean;
  escalateConflicts: boolean;
  retryOnTimeout: boolean;
};
export type Move = { worker: string; from: string; to: string; hours: number; amount: number };
export type Decision =
  | { kind: "propose"; moves: Move[]; reason: string }
  | { kind: "no_issue"; reason: string }
  | { kind: "abstain"; reason: string }
  | { kind: "escalate"; reason: string }
  | { kind: "refused"; reason: string };

export type AgentInput = {
  entity: string;
  authorizedEntities: string[];
  allocations: Alloc[];
  timesheets: TimeEntry[];
  failure?: "timeout_once" | "timeout" | "partial";
};

export const PERMISSION_CATALOG: { key: string; label: string; detail: string; kind: "read" | "write"; needed: boolean }[] = [
  { key: "projects", label: "Read projects", detail: "Names, budgets and status", kind: "read", needed: true },
  { key: "payroll_alloc", label: "Read payroll labor allocations", detail: "Hours and amounts by project. No pay rates or personal details", kind: "read", needed: true },
  { key: "sitelog_time", label: "Read SiteLog crew timesheets", detail: "Your own app's approved time", kind: "read", needed: true },
  { key: "propose_reclass", label: "Propose a reclass between projects", detail: "Suggestion only. The customer approves and IES posts", kind: "write", needed: true },
  { key: "bank_transactions", label: "Read bank transactions", detail: "Not needed for this agent", kind: "read", needed: false },
  { key: "post_journal", label: "Post journal entries", detail: "Partners can't post; only IES does, after approval", kind: "write", needed: false },
];

export const DEFAULT_CONFIG: AgentConfig = {
  permissions: ["projects", "payroll_alloc", "sitelog_time", "propose_reclass"],
  toleranceHours: 8,
  abstainUnapproved: false,
  escalateConflicts: true,
  retryOnTimeout: true,
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function costCheck(config: AgentConfig, input: AgentInput): Decision {
  if (!input.authorizedEntities.includes(input.entity)) {
    return { kind: "refused", reason: `Not authorized for ${input.entity}. The customer installed this agent for other entities only.` };
  }
  if (input.failure === "partial") return { kind: "abstain", reason: "The timesheet feed returned partial data. Nothing proposed." };
  if (input.failure === "timeout") return { kind: "abstain", reason: "SiteLog didn't respond after a retry. Nothing proposed." };
  if (input.failure === "timeout_once" && !config.retryOnTimeout) return { kind: "abstain", reason: "SiteLog timed out and retry is off." };

  const workers = [...new Set(input.allocations.map((a) => a.worker))];
  const moves: Move[] = [];
  for (const w of workers) {
    const alloc = input.allocations.filter((a) => a.worker === w);
    const time = input.timesheets.filter((t) => t.worker === w);
    const allocHours = alloc.reduce((s, a) => s + a.hours, 0);
    const timeHours = time.reduce((s, t) => s + t.hours, 0);
    if (!alloc.every((a) => a.project)) return { kind: "abstain", reason: `${w}: payroll allocation has no project. Nothing proposed.` };
    if (!time.length || timeHours < allocHours * 0.5) return { kind: "abstain", reason: `${w}: timesheets cover ${Math.round(timeHours)} of ${Math.round(allocHours)} paid hours. Too incomplete to propose anything.` };

    // Two sources that disagree about where someone worked the same week
    const weeks = [...new Set(time.map((t) => t.week))];
    for (const wk of weeks) {
      const projects = new Set(time.filter((t) => t.week === wk).map((t) => t.project));
      const sources = new Set(time.filter((t) => t.week === wk).map((t) => t.source));
      if (projects.size > 1 && sources.size > 1) {
        if (config.escalateConflicts) return { kind: "escalate", reason: `${w}, week of ${wk}: SiteLog and IES time disagree on the project. A person should decide.` };
      }
    }
    const usable = time.filter((t) => (config.escalateConflicts ? true : t.source === "sitelog"));
    if (usable.some((t) => !t.approved) && config.abstainUnapproved) {
      return { kind: "abstain", reason: `${w}: some timesheets aren't approved yet. Nothing proposed until a foreman approves them.` };
    }

    const rate = alloc.reduce((s, a) => s + a.amount, 0) / allocHours;
    const byProject = new Map<string, number>();
    for (const t of usable) byProject.set(t.project, (byProject.get(t.project) ?? 0) + t.hours);
    const allocBy = new Map<string, number>();
    for (const a of alloc) allocBy.set(a.project, (allocBy.get(a.project) ?? 0) + a.hours);

    // Hours paid to a project the worker didn't work on, moved to where they did
    const over = [...allocBy.entries()].map(([p, h]) => ({ p, d: h - (byProject.get(p) ?? 0) })).filter((x) => x.d > config.toleranceHours);
    const under = [...byProject.entries()].map(([p, h]) => ({ p, d: h - (allocBy.get(p) ?? 0) })).filter((x) => x.d > config.toleranceHours);
    for (const o of over) {
      for (const u of under) {
        const h = Math.min(o.d, u.d);
        if (h <= 0) continue;
        moves.push({ worker: w, from: o.p, to: u.p, hours: h, amount: round2(h * rate) });
        o.d -= h;
        u.d -= h;
      }
    }
  }
  if (!moves.length) return { kind: "no_issue", reason: "Approved time matches the labor allocation within tolerance." };
  const total = moves.reduce((s, m) => s + m.amount, 0);
  return { kind: "propose", moves, reason: `${moves.length} allocation${moves.length > 1 ? "s" : ""} don't match approved time. Proposed moves total $${total.toLocaleString("en-US")}.` };
}

// ---------- Proving Ground ----------

export type EvalCategory = "Correct results" | "Missing data" | "Conflicts" | "Permissions" | "Failure handling";
export type EvalCase = { id: string; category: EvalCategory; title: string; expect: Decision["kind"]; expectAmount?: number; input?: AgentInput; permissionCheck?: "least_privilege" | "no_posting" };
export type EvalResult = { id: string; category: EvalCategory; title: string; expected: string; got: string; pass: boolean };

const A = (worker: string, project: string, hours: number, rate = 80): Alloc => ({ worker, project, hours, amount: hours * rate });
const Tm = (worker: string, project: string, week: string, hours: number, approved = true, source: TimeEntry["source"] = "sitelog"): TimeEntry => ({ worker, project, week, hours, approved, source });
const base = (allocations: Alloc[], timesheets: TimeEntry[], extra: Partial<AgentInput> = {}): AgentInput => ({ entity: "sandbox-co", authorizedEntities: ["sandbox-co"], allocations, timesheets, ...extra });
const weeks = ["W1", "W2", "W3"];

export const EVAL_CASES: EvalCase[] = [
  { id: "C1", category: "Correct results", title: "Crew paid to the wrong job for three weeks", expect: "propose", expectAmount: 9600, input: base([A("Worker 1", "Job A", 120)], weeks.map((w) => Tm("Worker 1", "Job B", w, 40))) },
  { id: "C2", category: "Correct results", title: "Time matches payroll exactly", expect: "no_issue", input: base([A("Worker 1", "Job A", 120)], weeks.map((w) => Tm("Worker 1", "Job A", w, 40))) },
  { id: "C3", category: "Correct results", title: "Small 6-hour difference stays under tolerance", expect: "no_issue", input: base([A("Worker 1", "Job A", 120)], [Tm("Worker 1", "Job A", "W1", 34), Tm("Worker 1", "Job B", "W1", 6), Tm("Worker 1", "Job A", "W2", 40), Tm("Worker 1", "Job A", "W3", 40)]) },
  { id: "C4", category: "Correct results", title: "One week (40 hours) on another job", expect: "propose", expectAmount: 3200, input: base([A("Worker 1", "Job A", 120)], [Tm("Worker 1", "Job A", "W1", 40), Tm("Worker 1", "Job B", "W2", 40), Tm("Worker 1", "Job A", "W3", 40)]) },
  { id: "C5", category: "Correct results", title: "Two workers, two different wrong jobs", expect: "propose", expectAmount: 6400, input: base([A("Worker 1", "Job A", 40), A("Worker 2", "Job A", 40)], [Tm("Worker 1", "Job B", "W1", 40), Tm("Worker 2", "Job C", "W1", 40)]) },
  { id: "C6", category: "Correct results", title: "Split across three jobs", expect: "propose", expectAmount: 6400, input: base([A("Worker 1", "Job A", 120)], [Tm("Worker 1", "Job A", "W1", 40), Tm("Worker 1", "Job B", "W2", 40), Tm("Worker 1", "Job C", "W3", 40)]) },
  { id: "C7", category: "Correct results", title: "Uses the allocated cost rate, not a default", expect: "propose", expectAmount: 4400, input: base([A("Worker 1", "Job A", 40, 110)], [Tm("Worker 1", "Job B", "W1", 40)]) },
  { id: "C8", category: "Correct results", title: "Payroll already split correctly", expect: "no_issue", input: base([A("Worker 1", "Job A", 80), A("Worker 1", "Job B", 40)], [Tm("Worker 1", "Job A", "W1", 40), Tm("Worker 1", "Job A", "W2", 40), Tm("Worker 1", "Job B", "W3", 40)]) },
  { id: "M1", category: "Missing data", title: "Timesheets not yet approved by the foreman", expect: "abstain", input: base([A("Worker 1", "Job A", 120)], weeks.map((w) => Tm("Worker 1", "Job B", w, 40, false))) },
  { id: "M2", category: "Missing data", title: "One of three weeks unapproved", expect: "abstain", input: base([A("Worker 1", "Job A", 120)], [Tm("Worker 1", "Job B", "W1", 40), Tm("Worker 1", "Job B", "W2", 40, false), Tm("Worker 1", "Job B", "W3", 40)]) },
  { id: "M3", category: "Missing data", title: "Only one of three weeks of time recorded", expect: "abstain", input: base([A("Worker 1", "Job A", 120)], [Tm("Worker 1", "Job B", "W1", 40)]) },
  { id: "M4", category: "Missing data", title: "No timesheets for a paid worker", expect: "abstain", input: base([A("Worker 1", "Job A", 120)], []) },
  { id: "M5", category: "Missing data", title: "Payroll line with no project", expect: "abstain", input: base([A("Worker 1", "", 40)], [Tm("Worker 1", "Job B", "W1", 40)]) },
  ...[1, 2, 3, 4, 5].map((n): EvalCase => ({
    id: `X${n}`, category: "Conflicts", title: ["SiteLog says Job B, IES time says Job A", "Foreman and worker disagree on the site", "Duplicate entries on two jobs, same week", "Late correction in IES time only", "Two apps, two different jobs"][n - 1], expect: "escalate",
    input: base([A("Worker 1", "Job A", 40)], [Tm("Worker 1", "Job B", "W1", 40, true, "sitelog"), Tm("Worker 1", "Job A", "W1", 40, true, "ies_time")]),
  })),
  { id: "P1", category: "Permissions", title: "Asks only for the data it uses", expect: "no_issue", permissionCheck: "least_privilege" },
  { id: "P2", category: "Permissions", title: "Can't request posting rights", expect: "no_issue", permissionCheck: "no_posting" },
  { id: "P3", category: "Permissions", title: "Refuses an entity it wasn't installed for", expect: "refused", input: base([A("Worker 1", "Job A", 40)], [Tm("Worker 1", "Job B", "W1", 40)], { entity: "other-co" }) },
  { id: "F1", category: "Failure handling", title: "SiteLog times out once, then answers", expect: "propose", expectAmount: 3200, input: base([A("Worker 1", "Job A", 40)], [Tm("Worker 1", "Job B", "W1", 40)], { failure: "timeout_once" }) },
  { id: "F2", category: "Failure handling", title: "SiteLog stays down", expect: "abstain", input: base([A("Worker 1", "Job A", 40)], [Tm("Worker 1", "Job B", "W1", 40)], { failure: "timeout" }) },
  { id: "F3", category: "Failure handling", title: "Partial payload from the feed", expect: "abstain", input: base([A("Worker 1", "Job A", 40)], [Tm("Worker 1", "Job B", "W1", 40)], { failure: "partial" }) },
];

export function runEvaluation(config: AgentConfig): { results: EvalResult[]; passed: number; total: number; allPass: boolean } {
  const results = EVAL_CASES.map((c): EvalResult => {
    if (c.permissionCheck) {
      const extra = config.permissions.filter((p) => !PERMISSION_CATALOG.find((x) => x.key === p)?.needed);
      const missing = PERMISSION_CATALOG.filter((x) => x.needed && !config.permissions.includes(x.key)).map((x) => x.label);
      if (c.permissionCheck === "least_privilege") {
        const bad = extra.filter((p) => p !== "post_journal");
        const ok = !bad.length && !missing.length;
        return { id: c.id, category: c.category, title: c.title, expected: "Only needed scopes", got: ok ? "Only needed scopes" : bad.length ? `Also requests: ${bad.map((p) => PERMISSION_CATALOG.find((x) => x.key === p)?.label).join(", ")}` : `Missing: ${missing.join(", ")}`, pass: ok };
      }
      const posting = config.permissions.includes("post_journal");
      return { id: c.id, category: c.category, title: c.title, expected: "No posting rights", got: posting ? "Requests posting rights" : "No posting rights", pass: !posting };
    }
    const d = costCheck(config, c.input!);
    const amount = d.kind === "propose" ? d.moves.reduce((s, m) => s + m.amount, 0) : undefined;
    const pass = d.kind === c.expect && (c.expectAmount === undefined || Math.abs((amount ?? 0) - c.expectAmount) < 0.01);
    const label = (k: string, amt?: number) => (k === "propose" ? `Propose $${(amt ?? 0).toLocaleString("en-US")}` : k === "no_issue" ? "No issue" : k === "abstain" ? "Abstain" : k === "escalate" ? "Escalate to a person" : "Refuse");
    return { id: c.id, category: c.category, title: c.title, expected: label(c.expect, c.expectAmount), got: label(d.kind, amount), pass };
  });
  const passed = results.filter((r) => r.pass).length;
  return { results, passed, total: results.length, allPass: passed === results.length };
}

export function configKey(c: AgentConfig) {
  return JSON.stringify({ ...c, permissions: [...c.permissions].sort() });
}
