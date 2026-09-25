import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { seed } from "./seed";
import { DEMO_ANCHOR, demoNow } from "./clock";

const DATA_DIR = path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DB_PATH = path.join(DATA_DIR, "footnote-v2.db");

declare global {
  var __fnDb: Database.Database | undefined;
}

const SCHEMA = `
create table companies(id text primary key, name text not null, short text, parent_id text);
create table users(id text primary key, name text, email text unique, password_hash text, role text, title text, phone text, firm text, initials text, color text);
create table sessions(token text primary key, user_id text, created_at text);
create table accounts(id text primary key, number text, name text, type text);
create table projects(id text primary key, company_id text, name text, customer text, pm_user_id text, address text, contract_value real, est_total_cost real, budget_labor_pct real, crew_days integer, billing text);
create table vendors(id text primary key, name text);
create table cards(id text primary key, last4 text, holder_user_id text);
create table transactions(id text primary key, company_id text, date text, description text, vendor_id text, amount real, account_id text, project_id text, source text, ref text, card_id text, status text, memo text, created_by text, created_at text);
create table receipts(id text primary key, vendor text, amount real, date text, file text, job_ref text, matched_txn_id text, received_via text);
create table labor_alloc(id integer primary key autoincrement, worker text, crew text, project_id text, hours real, amount real, ref text);
create table time_entries(id integer primary key autoincrement, worker text, crew text, project_id text, week_start text, hours real, approved integer, approved_by text, source text);
create table site_logs(project_id text, date text, crew integer, deliveries text, note text);
create table policies(key text primary key, label text, detail text, mode text, limit_amount real, editable integer, sort integer);
create table runs(id text primary key, company_id text, goal text, entities text, status text, created_by text, started_at text, baseline text);
create table run_steps(id integer primary key autoincrement, run_id text, seq integer, label text, detail text, source text, outcome text);
create table issues(id text primary key, run_id text, company_id text, kind text, title text, summary text, amount real, status text, mode text, projects text, checked text, proposal text, txn_id text, question_id text, agent_id text, case_id text, resolution text, created_at text, updated_at text);
create table activity(id integer primary key autoincrement, issue_id text, txn_id text, project_id text, kind text, label text, detail text, actor_type text, actor_name text, policy text, file text, created_at text);
create table questions(id text primary key, issue_id text, case_id text, txn_id text, fact text, prompt text, options text, asked_user_id text, token text unique, status text, answer_value text, answer_label text, answer_note text, asked_at text, answered_at text, reminders integer default 0);
create table outbox(id integer primary key autoincrement, user_id text, channel text, body text, link text, created_at text);
create table agents(id text primary key, developer_id text, name text, vendor text, template text, summary text, permissions text, config text, status text, price real, eval text, eval_config text, security text, published_at text, created_at text);
create table installs(id integer primary key autoincrement, agent_id text, company_id text, entities text, access text, installed_by text, installed_at text, revoked_at text);
create table usage(id integer primary key autoincrement, agent_id text, issue_id text, company text, detail text, amount real, dev_share real, created_at text);
create table cases(id text primary key, issue_id text, company_id text, question text, summary text, ai_written integer, status text, expert_id text, fee real, platform_fee real, proposal text, recommendation text, created_by text, created_at text, returned_at text, decided_at text);
create table case_messages(id integer primary key autoincrement, case_id text, from_name text, to_name text, kind text, body text, question_id text, created_at text);
create table settings(key text primary key, value text);
create table ai_cache(key text primary key, value text, created_at text);
`;

function open(): Database.Database {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const d = new Database(DB_PATH);
  d.pragma("journal_mode = WAL");
  const has = d.prepare("select name from sqlite_master where type='table' and name='users'").get();
  if (!has) {
    d.exec(SCHEMA);
    seed(d);
    d.prepare("insert into settings(key,value) values('clock_offset',?)").run(String(DEMO_ANCHOR - Date.now()));
  }
  const off = d.prepare("select value from settings where key='clock_offset'").get() as { value: string } | undefined;
  globalThis.__fnOffset = Number(off?.value ?? 0);
  return d;
}

export function db(): Database.Database {
  if (!global.__fnDb) global.__fnDb = open();
  return global.__fnDb;
}

export function resetDb() {
  if (global.__fnDb) {
    global.__fnDb.close();
    global.__fnDb = undefined;
  }
  for (const f of ["footnote-v2.db", "footnote-v2.db-wal", "footnote-v2.db-shm"]) {
    const p = path.join(DATA_DIR, f);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  global.__fnDb = open();
}

export function nowIso() {
  return new Date(demoNow()).toISOString();
}

export function getSetting(key: string, fallback = ""): string {
  const row = db().prepare("select value from settings where key=?").get(key) as { value: string } | undefined;
  return row?.value ?? fallback;
}

export function setSetting(key: string, value: string) {
  db().prepare("insert into settings(key,value) values(?,?) on conflict(key) do update set value=excluded.value").run(key, value);
}

// Small typed helpers used across the server code.
export const all = <T>(sql: string, ...args: unknown[]) => db().prepare(sql).all(...args) as T[];
export const one = <T>(sql: string, ...args: unknown[]) => db().prepare(sql).get(...args) as T | undefined;
export const run = (sql: string, ...args: unknown[]) => db().prepare(sql).run(...args);
export const tx = <T>(fn: () => T): T => db().transaction(fn)();
