import { all, nowIso, one, run } from "./db";
import { configKey, DEFAULT_CONFIG, PERMISSION_CATALOG, runEvaluation, type AgentConfig, type EvalResult } from "./costcheck";
import type { AgentRow } from "./model";

export type Demand = { key: string; problem: string; example: string; openIssues: number; companies: number; agents: number; includesYou: boolean; buildable: boolean };

export function demandBoard(): Demand[] {
  const hpWaiting = !!one("select id from issues where kind='labor' and status='needs_agent'");
  const published = one<{ n: number }>("select count(*) n from agents where status='published'")?.n ?? 0;
  return [
    { key: "labor_vs_time", problem: "Project labor doesn't match site time", example: "Payroll charges a crew's default job; field timesheets show another site", openIssues: 1240 + (hpWaiting ? 1 : 0), companies: 312 + (hpWaiting ? 1 : 0), agents: published, includesYou: hpWaiting, buildable: true },
    { key: "sub_lien", problem: "Subcontractor bills without lien waivers", example: "Bills are approved before the waiver arrives", openIssues: 860, companies: 205, agents: 1, includesYou: false, buildable: false },
    { key: "equip_idle", problem: "Rental equipment billed after it left the site", example: "Rental invoices run past the last day in the daily log", openIssues: 410, companies: 138, agents: 0, includesYou: false, buildable: false },
    { key: "retainage", problem: "Retainage receivable not tracked by milestone", example: "Retainage sits in one account with no job detail", openIssues: 295, companies: 96, agents: 2, includesYou: false, buildable: false },
  ];
}

export type DevState = {
  agent: (Omit<AgentRow, "config" | "eval" | "permissions" | "security"> & { config: AgentConfig; permissions: string[]; eval: { results: EvalResult[]; passed: number; total: number; allPass: boolean; ranAt: string } | null; evalCurrent: boolean; security: { status: string; at: string; note: string } | null }) | null;
  demand: Demand[];
  catalog: typeof PERMISSION_CATALOG;
  usage: { id: number; company: string; detail: string; amount: number; dev_share: number; created_at: string }[];
  installs: { id: number; entities: string; installed_at: string; revoked_at: string | null }[];
};

export function devState(developerId: string): DevState {
  const a = one<AgentRow>("select * from agents where developer_id=? order by created_at desc limit 1", developerId);
  const agent = a
    ? (() => {
        const config = JSON.parse(a.config) as AgentConfig;
        const ev = a.eval ? JSON.parse(a.eval) : null;
        return { ...a, config, permissions: config.permissions, eval: ev, evalCurrent: !!ev && a.eval_config === configKey(config), security: a.security ? JSON.parse(a.security) : null };
      })()
    : null;
  return {
    agent,
    demand: demandBoard(),
    catalog: PERMISSION_CATALOG,
    usage: a ? all("select id, company, detail, amount, dev_share, created_at from usage where agent_id=? order by id desc", a.id) : [],
    installs: a ? all("select id, entities, installed_at, revoked_at from installs where agent_id=? order by id desc", a.id) : [],
  };
}

export function createAgent(developerId: string) {
  const existing = one<{ id: string }>("select id from agents where developer_id=?", developerId);
  if (existing) return existing.id;
  const id = "agent_costcheck";
  run(
    "insert into agents(id,developer_id,name,vendor,template,summary,permissions,config,status,price,eval,eval_config,security,published_at,created_at) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    id, developerId, "SiteLog CostCheck", "SiteLog", "Reconciliation agent",
    "Compares approved crew timesheets in SiteLog with payroll's labor allocation and proposes moving labor cost to the right project.",
    JSON.stringify(DEFAULT_CONFIG.permissions), JSON.stringify(DEFAULT_CONFIG), "draft", 6, null, null, null, null, nowIso(),
  );
  return id;
}

export function saveConfig(developerId: string, patch: Partial<AgentConfig> & { name?: string; summary?: string; price?: number }) {
  const a = one<AgentRow>("select * from agents where developer_id=?", developerId);
  if (!a) return { ok: false, message: "Create the agent first" };
  if (a.status === "published") return { ok: false, message: "Published agents can't be edited in this prototype" };
  const cfg = { ...(JSON.parse(a.config) as AgentConfig) };
  if (patch.permissions) cfg.permissions = patch.permissions.filter((p) => PERMISSION_CATALOG.some((x) => x.key === p));
  if (patch.toleranceHours !== undefined) cfg.toleranceHours = Math.max(0, Math.min(200, Number(patch.toleranceHours) || 0));
  if (patch.abstainUnapproved !== undefined) cfg.abstainUnapproved = !!patch.abstainUnapproved;
  if (patch.escalateConflicts !== undefined) cfg.escalateConflicts = !!patch.escalateConflicts;
  if (patch.retryOnTimeout !== undefined) cfg.retryOnTimeout = !!patch.retryOnTimeout;
  const changed = configKey(cfg) !== configKey(JSON.parse(a.config) as AgentConfig);
  run(
    "update agents set config=?, permissions=?, name=?, summary=?, price=?, status=?, security=? where id=?",
    JSON.stringify(cfg), JSON.stringify(cfg.permissions), patch.name?.trim() || a.name, patch.summary?.trim() || a.summary,
    patch.price !== undefined ? Math.max(0, Number(patch.price) || 0) : a.price, changed ? "draft" : a.status, changed ? null : a.security, a.id,
  );
  return { ok: true, message: changed ? "Saved. Run the Proving Ground again to check this version." : "Saved" };
}

export function evaluate(developerId: string) {
  const a = one<AgentRow>("select * from agents where developer_id=?", developerId);
  if (!a) return { ok: false, message: "Create the agent first" };
  const cfg = JSON.parse(a.config) as AgentConfig;
  const res = runEvaluation(cfg);
  run("update agents set eval=?, eval_config=?, status=? where id=?", JSON.stringify({ ...res, ranAt: nowIso() }), configKey(cfg), a.status === "published" ? "published" : res.allPass ? "evaluated" : "draft", a.id);
  return { ok: true, message: res.allPass ? `All ${res.total} cases passed` : `${res.passed} of ${res.total} passed`, allPass: res.allPass };
}

export function submitSecurity(developerId: string) {
  const a = one<AgentRow>("select * from agents where developer_id=?", developerId);
  if (!a) return { ok: false, message: "Create the agent first" };
  const cfg = JSON.parse(a.config) as AgentConfig;
  const ev = a.eval ? (JSON.parse(a.eval) as { allPass: boolean }) : null;
  if (!ev?.allPass || a.eval_config !== configKey(cfg)) return { ok: false, message: "Pass the Proving Ground with this version first" };
  const writes = cfg.permissions.filter((p) => PERMISSION_CATALOG.find((x) => x.key === p)?.kind === "write");
  const note = `Scopes reviewed: ${cfg.permissions.length} (${writes.length} write, suggestion only). Data stays in IES; no bulk export.`;
  run("update agents set security=? where id=?", JSON.stringify({ status: "approved", at: nowIso(), note }), a.id);
  return { ok: true, message: "Security and permissions review approved" };
}

export function publish(developerId: string) {
  const a = one<AgentRow>("select * from agents where developer_id=?", developerId);
  if (!a) return { ok: false, message: "Create the agent first" };
  const cfg = JSON.parse(a.config) as AgentConfig;
  const ev = a.eval ? (JSON.parse(a.eval) as { allPass: boolean }) : null;
  if (!ev?.allPass || a.eval_config !== configKey(cfg)) return { ok: false, message: "Pass the Proving Ground first" };
  if (!a.security || JSON.parse(a.security).status !== "approved") return { ok: false, message: "Get the security review approved first" };
  run("update agents set status='published', published_at=? where id=?", nowIso(), a.id);
  return { ok: true, message: `${a.name} is live in the IES App Store` };
}
