import postgres from "postgres";
import { AsyncLocalStorage } from "node:async_hooks";
import { cookies } from "next/headers";
import { seed } from "./seed";
import { DEMO_ANCHOR, demoNow } from "./clock";

// Every visitor gets a private copy of the demo: a Postgres schema named ws_<id>, created and
// seeded on their first request (the id lives in the fn_ws cookie set by middleware). Each request
// runs in one transaction with search_path pointed at that schema, so queries stay unqualified.

export const WS_COOKIE = "fn_ws";
export const WS_PATTERN = /^[a-z0-9]{12}$/;

type Sql = postgres.Sql<Record<string, never>>;
type Tx = postgres.TransactionSql<Record<string, never>>;
type Ctx = { tx: Tx; ws: string; offset: number; memo: Map<string, unknown> };

declare global {
  var __fnSql: Sql | undefined;
  var __fnReady: Set<string> | undefined;
  var __fnOffset: number | undefined;
  var __fnOffsetFn: (() => number) | undefined;
}

function connectionUrl(): string {
  const raw = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.SUPABASE_DB_URL;
  if (!raw) throw new Error("No database configured. Set DATABASE_URL or POSTGRES_URL (Supabase transaction pooler).");
  const u = new URL(raw);
  for (const k of [...u.searchParams.keys()]) u.searchParams.delete(k); // pooler hints like ?supa= aren't Postgres settings
  return u.toString();
}

function pg(): Sql {
  if (!global.__fnSql) {
    const url = connectionUrl();
    const local = /localhost|127\.0\.0\.1/.test(url);
    global.__fnSql = postgres(url, {
      ssl: local ? false : "require",
      prepare: false, // required by Supabase's transaction pooler
      max: 5,
      idle_timeout: 20,
      transform: { undefined: null },
    }) as unknown as Sql;
  }
  return global.__fnSql;
}

const als = new AsyncLocalStorage<Ctx>();
globalThis.__fnOffsetFn = () => als.getStore()?.offset ?? globalThis.__fnOffset ?? 0;

const SCHEMA = `
create table companies(id text primary key, name text not null, short text, parent_id text);
create table users(id text primary key, sort int, name text, email text unique, password_hash text, role text, title text, phone text, firm text, initials text, color text);
create table sessions(token text primary key, user_id text, created_at text);
create table accounts(id text primary key, number text, name text, type text);
create table projects(id text primary key, company_id text, name text, customer text, pm_user_id text, address text, contract_value double precision, est_total_cost double precision, budget_labor_pct double precision, crew_days int, billing text);
create table vendors(id text primary key, name text);
create table cards(id text primary key, last4 text, holder_user_id text);
create table transactions(id text primary key, company_id text, date text, description text, vendor_id text, amount double precision, account_id text, project_id text, source text, ref text, card_id text, status text, memo text, created_by text, created_at text);
create table receipts(id text primary key, vendor text, amount double precision, date text, file text, job_ref text, matched_txn_id text, received_via text);
create table labor_alloc(id serial primary key, worker text, crew text, project_id text, hours double precision, amount double precision, ref text);
create table time_entries(id serial primary key, worker text, crew text, project_id text, week_start text, hours double precision, approved int, approved_by text, source text);
create table site_logs(project_id text, date text, crew int, deliveries text, note text);
create table policies(key text primary key, label text, detail text, mode text, limit_amount double precision, editable int, sort int);
create table runs(id text primary key, company_id text, goal text, entities text, status text, created_by text, started_at text, baseline text);
create table run_steps(id serial primary key, run_id text, seq int, label text, detail text, source text, outcome text);
create table issues(id text primary key, seq serial, run_id text, company_id text, kind text, title text, summary text, amount double precision, status text, mode text, projects text, checked text, proposal text, txn_id text, question_id text, agent_id text, case_id text, resolution text, created_at text, updated_at text);
create table activity(id serial primary key, issue_id text, txn_id text, project_id text, kind text, label text, detail text, actor_type text, actor_name text, policy text, file text, created_at text);
create table questions(id text primary key, issue_id text, case_id text, txn_id text, fact text, prompt text, options text, asked_user_id text, token text unique, status text, answer_value text, answer_label text, answer_note text, asked_at text, answered_at text, reminders int default 0);
create table outbox(id serial primary key, user_id text, channel text, body text, link text, created_at text);
create table agents(id text primary key, developer_id text, name text, vendor text, template text, summary text, permissions text, config text, status text, price double precision, eval text, eval_config text, security text, published_at text, created_at text);
create table installs(id serial primary key, agent_id text, company_id text, entities text, access text, installed_by text, installed_at text, revoked_at text);
create table agent_usage(id serial primary key, agent_id text, issue_id text, company text, detail text, amount double precision, dev_share double precision, created_at text);
create table cases(id text primary key, issue_id text, company_id text, question text, summary text, ai_written int, status text, expert_id text, fee double precision, platform_fee double precision, proposal text, recommendation text, created_by text, created_at text, returned_at text, decided_at text);
create table case_messages(id serial primary key, case_id text, from_name text, to_name text, kind text, body text, question_id text, created_at text);
create table settings(key text primary key, value text);
create table ai_cache(key text primary key, value text, created_at text);
`;

const schemaOf = (ws: string) => {
  if (!WS_PATTERN.test(ws)) throw new Error("Invalid workspace id");
  return `ws_${ws}`;
};

let registryReady = false;
let lastCleanup = 0;

// Create and seed the visitor's schema once. An advisory lock keeps parallel first requests from
// seeding twice.
async function ensureWorkspace(ws: string) {
  const ready = (global.__fnReady ??= new Set());
  if (ready.has(ws)) return;
  const sql = pg();
  const schema = schemaOf(ws);
  if (!registryReady) {
    await sql.unsafe("create table if not exists public.fn_workspaces(id text primary key, created_at timestamptz default now()); alter table public.fn_workspaces enable row level security;");
    registryReady = true;
  }
  await sql.begin(async (tx) => {
    await tx.unsafe("select pg_advisory_xact_lock(hashtext($1))", [ws]);
    const exists = await tx.unsafe("select 1 from information_schema.tables where table_schema=$1 and table_name='settings'", [schema]);
    if (exists.length) return;
    await tx.unsafe(`create schema if not exists ${schema}`);
    await tx.unsafe(`set local search_path to ${schema}`);
    await tx.unsafe(SCHEMA);
    await seed(tx as unknown as Tx);
    await tx.unsafe("insert into settings(key,value) values('clock_offset',$1)", [String(DEMO_ANCHOR - Date.now())]);
    await tx.unsafe("insert into public.fn_workspaces(id) values($1) on conflict do nothing", [ws]);
  });
  ready.add(ws);
  if (Date.now() - lastCleanup > 3600e3) {
    lastCleanup = Date.now();
    cleanupOldWorkspaces().catch((e) => console.error("[workspace cleanup]", e));
  }
}

// Demo copies are disposable: drop ones older than two weeks.
async function cleanupOldWorkspaces() {
  const sql = pg();
  const old = await sql.unsafe("select id from public.fn_workspaces where created_at < now() - interval '14 days' limit 50");
  for (const r of old) {
    if (!WS_PATTERN.test(r.id)) continue;
    await sql.unsafe(`drop schema if exists ws_${r.id} cascade`);
    await sql.unsafe("delete from public.fn_workspaces where id=$1", [r.id]);
  }
}

export async function currentWorkspaceId(): Promise<string> {
  const c = await cookies();
  const ws = c.get(WS_COOKIE)?.value;
  if (!ws || !WS_PATTERN.test(ws)) throw new Error("No demo workspace cookie. Middleware should have set one.");
  return ws;
}

// Run fn inside the visitor's workspace transaction. Nested calls reuse the outer transaction.
export async function withWs<T>(fn: () => Promise<T>): Promise<T> {
  if (als.getStore()) return fn();
  const ws = await currentWorkspaceId();
  for (let attempt = 0; ; attempt++) {
    await ensureWorkspace(ws);
    try {
      return (await pg().begin(async (tx) => {
        await tx.unsafe(`set local search_path to ${schemaOf(ws)}`);
        const off = await tx.unsafe("select value from settings where key='clock_offset'");
        return als.run({ tx: tx as unknown as Tx, ws, offset: Number(off[0]?.value ?? 0), memo: new Map() }, fn);
      })) as T;
    } catch (e) {
      // The schema was dropped by another instance (reset or cleanup): recreate once.
      if (attempt === 0 && (e as { code?: string }).code === "42P01") {
        global.__fnReady?.delete(ws);
        continue;
      }
      throw e;
    }
  }
}

export async function dropWorkspace(ws: string) {
  const sql = pg();
  await sql.unsafe(`drop schema if exists ${schemaOf(ws)} cascade`);
  await sql.unsafe("delete from public.fn_workspaces where id=$1", [ws]);
  global.__fnReady?.delete(ws);
}

export function newWorkspaceId() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return [...bytes].map((b) => chars[b % chars.length]).join("");
}

function ctx(): Ctx {
  const c = als.getStore();
  if (!c) throw new Error("Database access outside withWs()");
  return c;
}

// SQLite-style ? placeholders become $1..$n.
const toPg = (q: string) => {
  let i = 0;
  return q.replace(/\?/g, () => `$${++i}`);
};

export async function all<T>(q: string, ...args: unknown[]): Promise<T[]> {
  return (await ctx().tx.unsafe(toPg(q), args as never[])) as unknown as T[];
}
export async function one<T>(q: string, ...args: unknown[]): Promise<T | undefined> {
  return (await all<T>(q, ...args))[0];
}
export async function run(q: string, ...args: unknown[]): Promise<void> {
  await ctx().tx.unsafe(toPg(q), args as never[]);
}
// Each request already runs in a transaction.
export async function tx<T>(fn: () => Promise<T>): Promise<T> {
  return fn();
}

// Per-request memo for lookups that many helpers need.
export async function memo<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const m = ctx().memo;
  if (!m.has(key)) m.set(key, fn());
  return m.get(key) as Promise<T>;
}
export function clearMemo() {
  als.getStore()?.memo.clear();
}

export function currentOffset(): number {
  return als.getStore()?.offset ?? 0;
}

export function nowIso() {
  return new Date(demoNow()).toISOString();
}

export async function getSetting(key: string, fallback = ""): Promise<string> {
  const row = await one<{ value: string }>("select value from settings where key=?", key);
  return row?.value ?? fallback;
}

export async function setSetting(key: string, value: string) {
  await run("insert into settings(key,value) values(?,?) on conflict(key) do update set value=excluded.value", key, value);
}
