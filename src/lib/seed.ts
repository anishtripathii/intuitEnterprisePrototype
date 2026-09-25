import type postgres from "postgres";
import { hashPassword } from "./hash";
import { DEMO_ANCHOR } from "./clock";
import { RECEIPTS, receiptFile } from "./files";

type Row = Record<string, unknown>;

// Seeds one visitor's demo copy. Rows are collected per table and inserted in one statement each.
export async function seed(tx: postgres.TransactionSql<Record<string, never>>) {
  const ago = (mins: number) => new Date(DEMO_ANCHOR - mins * 60000).toISOString();
  const tables = new Map<string, Row[]>();
  const ins = (table: string, row: Row) => tables.set(table, [...(tables.get(table) ?? []), row]);
  const pw = hashPassword("demo1234");
  let userSort = 0;

  {
    ins("companies", { id: "hpg", name: "Harbor & Pine Group", short: "Group", parent_id: null });
    ins("companies", { id: "hpb", name: "Harbor & Pine Builders", short: "Builders", parent_id: "hpg" });
    ins("companies", { id: "prs", name: "Pine Ridge Services", short: "Pine Ridge", parent_id: "hpg" });

    const U = (id: string, name: string, email: string, role: string, title: string, color: string, extra: Row = {}) =>
      ins("users", {
        id, sort: ++userSort, name, email, password_hash: pw, role, title, phone: null, firm: null, color,
        initials: name.replace(/,.*$/, "").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase(), ...extra,
      });
    U("u_priya", "Priya Shah", "priya@harborpine.demo", "controller", "Controller · Harbor & Pine Group", "#0B6BCB");
    U("u_marcus", "Marcus Hale", "marcus@harborpine.demo", "cfo", "CFO · Harbor & Pine Group", "#3F4454");
    U("u_aisha", "Aisha Khan", "aisha@harborpine.demo", "bookkeeper", "Bookkeeper", "#8D4BD6");
    U("u_luis", "Luis Romero", "luis@harborpine.demo", "pm", "Project Manager · Elm St, Oak Ave", "#C2410C", { phone: "+1 (415) 555-0142" });
    U("u_maya", "Maya Chen", "maya@harborpine.demo", "pm", "Project Manager · Riverside, Lincoln", "#047857", { phone: "+1 (415) 555-0199" });
    U("u_elena", "Elena Kovacs, CPA", "elena@kovacscpa.demo", "accountant", "Partner · Kovacs & Partners CPA", "#0F766E", { firm: "Kovacs & Partners CPA" });
    U("u_sam", "Sam Ortiz, CPA", "sam@liveexperts.demo", "live_expert", "Intuit Live Expert", "#7C3AED", { firm: "Intuit Live Experts" });
    U("u_ravi", "Ravi Menon", "ravi@sitelog.demo", "developer", "Founder · SiteLog", "#2563EB", { firm: "SiteLog" });

    const A = (id: string, number: string, name: string, type: string) => ins("accounts", { id, number, name, type });
    A("a2450", "2450", "Billings in Excess of Revenue", "liability");
    A("a4000", "4000", "Contract Revenue", "income");
    A("a5000", "5000", "Job Materials", "cost");
    A("a5100", "5100", "Subcontractors", "cost");
    A("a5200", "5200", "Equipment Rental", "cost");
    A("a5300", "5300", "Direct Labor", "cost");
    A("a6300", "6300", "Office Supplies", "expense");

    const P = (id: string, name: string, customer: string, pm: string, address: string, contract: number, estCost: number, labor: number, crewDays: number, billing: string) =>
      ins("projects", { id, company_id: "hpb", name, customer, pm_user_id: pm, address, contract_value: contract, est_total_cost: estCost, budget_labor_pct: labor, crew_days: crewDays, billing });
    P("p_oak", "Oak Ave Retail Fit-out", "Brightline Retail", "u_luis", "1840 Oak Ave, San Jose", 1150000, 920000, 35, 19, "progress");
    P("p_elm", "Elm St Medical Office", "Northside Health", "u_luis", "410 Elm St, San Jose", 2240000, 1850000, 27, 21, "progress");
    P("p_riv", "Riverside Warehouse", "Coastal Logistics", "u_maya", "77 River Rd, Fremont", 2980000, 2400000, 18, 20, "progress");
    P("p_lin", "Lincoln School Gym", "Lincoln School District", "u_maya", "1200 Lincoln Ave, San Leandro", 1460000, 1100000, 30, 16, "milestone");

    ins("cards", { id: "c4411", last4: "4411", holder_user_id: "u_luis" });
    ins("cards", { id: "c2087", last4: "2087", holder_user_id: "u_maya" });

    const vendors: [string, string][] = [
      ["v_pl", "Pacific Lumber"], ["v_br", "BuildRight Supply"], ["v_gr", "Grainger"], ["v_dd", "Delta Drywall"], ["v_se", "Summit Electric"],
      ["v_sb", "Sunbelt Rentals"], ["v_ss", "Steel Source Co."], ["v_sw", "Sherwin-Williams"], ["v_fg", "Ferguson Plumbing Supply"], ["v_am", "Apex Mechanical"],
      ["v_abc", "ABC Concrete"], ["v_cat", "CAT Rental Store"], ["v_ur", "United Rentals"], ["v_hd", "Home Depot"], ["v_wc", "White Cap"],
      ["v_mr", "Metro Roofing"], ["v_fa", "Fastenal"], ["v_amz", "Amazon"], ["v_payroll", "Payroll"],
      ["c_bright", "Brightline Retail"], ["c_north", "Northside Health"], ["c_coast", "Coastal Logistics"], ["c_lin", "Lincoln School District"],
    ];
    for (const [id, name] of vendors) ins("vendors", { id, name });

    const T = (id: string, date: string, description: string, vendor: string, amount: number, account: string, project: string | null, source: string, ref: string | null, extra: Row = {}) =>
      ins("transactions", {
        id, company_id: "hpb", date, description, vendor_id: vendor, amount, account_id: account, project_id: project, source, ref,
        card_id: null, status: "posted", memo: null, created_by: "u_aisha", created_at: `${date}T17:00:00.000Z`, ...extra,
      });

    // Oak Ave · revenue 368,000 · cost 218,400 before the review
    T("t_oak_inv", "2026-09-30", "INV-1042 · Progress billing #3", "c_bright", 368000, "a4000", "p_oak", "invoice", "INV-1042");
    T("t_oak_pl", "2026-09-08", "Pacific Lumber · Bill PL-7781", "v_pl", 36900, "a5000", "p_oak", "bill", "PL-7781");
    T("t_oak_br", "2026-09-15", "BuildRight Supply · Bill BR-2210", "v_br", 21985, "a5000", "p_oak", "bill", "BR-2210");
    T("t_oak_gr", "2026-09-27", "GRAINGER 2315 HAYWARD", "v_gr", 2315, "a5000", "p_oak", "card", "••4411", { card_id: "c4411" });
    T("t_oak_dd", "2026-09-22", "Delta Drywall · Bill DD-114", "v_dd", 54000, "a5100", "p_oak", "bill", "DD-114");
    T("t_oak_se", "2026-09-24", "Summit Electric · Bill SE-3302", "v_se", 44500, "a5100", "p_oak", "bill", "SE-3302");
    T("t_oak_sb", "2026-09-10", "Sunbelt Rentals · Bill SB-9910", "v_sb", 6400, "a5200", "p_oak", "bill", "SB-9910");
    T("t_oak_lab", "2026-09-30", "Payroll labor allocation · PR-0930", "v_payroll", 52300, "a5300", "p_oak", "payroll", "PR-0930");

    // Elm St · revenue 412,000 · cost 371,900
    T("t_elm_inv", "2026-09-30", "INV-1041 · Progress billing #6", "c_north", 412000, "a4000", "p_elm", "invoice", "INV-1041");
    T("t_elm_ss", "2026-09-05", "Steel Source Co. · Bill SS-5520", "v_ss", 71500, "a5000", "p_elm", "bill", "SS-5520");
    T("t_elm_sw", "2026-09-27", "SHERWIN-WILLIAMS #7710", "v_sw", 1940, "a5000", "p_elm", "card", "••4411", { card_id: "c4411" });
    T("t_elm_fg", "2026-09-18", "Ferguson Plumbing Supply · Bill FG-2231", "v_fg", 22860, "a5000", "p_elm", "bill", "FG-2231");
    T("t_elm_am", "2026-09-20", "Apex Mechanical · Bill AM-808", "v_am", 88000, "a5100", "p_elm", "bill", "AM-808");
    T("t_elm_abc", "2026-09-12", "ABC Concrete · Bill ABC-4471", "v_abc", 54800, "a5100", "p_elm", "bill", "ABC-4471");
    T("t_elm_cat", "2026-09-27", "CAT RENTAL STORE #88 SAN JOSE", "v_cat", 2860, "a5200", "p_elm", "card", "••4411", { card_id: "c4411" });
    T("t_elm_ur", "2026-09-25", "United Rentals · Bill UR-99120", "v_ur", 11340, "a5200", "p_elm", "bill", "UR-99120");
    T("t_elm_lab", "2026-09-30", "Payroll labor allocation · PR-0930", "v_payroll", 118600, "a5300", "p_elm", "payroll", "PR-0930");

    // Riverside · revenue 520,000 · cost 401,000
    T("t_riv_inv", "2026-09-30", "INV-1043 · Progress billing #9", "c_coast", 520000, "a4000", "p_riv", "invoice", "INV-1043");
    T("t_riv_pl", "2026-09-11", "Pacific Lumber · Bill PL-7790", "v_pl", 52000, "a5000", "p_riv", "bill", "PL-7790");
    T("t_riv_hd", "2026-09-26", "HOME DEPOT #2087 FREMONT", "v_hd", 6150, "a5000", "p_riv", "card", "••2087", { card_id: "c2087" });
    T("t_riv_wc", "2026-09-26", "WHITE CAP #331", "v_wc", 1250, "a5000", "p_riv", "card", "••2087", { card_id: "c2087" });
    T("t_riv_br", "2026-09-19", "BuildRight Supply · Bill BR-2231", "v_br", 29000, "a5000", "p_riv", "bill", "BR-2231");
    T("t_riv_mr", "2026-09-23", "Metro Roofing · Bill MR-601", "v_mr", 126000, "a5100", "p_riv", "bill", "MR-601");
    T("t_riv_se", "2026-09-25", "Summit Electric · Bill SE-3310", "v_se", 89600, "a5100", "p_riv", "bill", "SE-3310");
    T("t_riv_ur", "2026-09-25", "United Rentals · Bill UR-99133", "v_ur", 12900, "a5200", "p_riv", "bill", "UR-99133");
    T("t_riv_sb", "2026-09-16", "Sunbelt Rentals · Bill SB-9922", "v_sb", 10000, "a5200", "p_riv", "bill", "SB-9922");
    T("t_riv_lab", "2026-09-30", "Payroll labor allocation · PR-0930", "v_payroll", 74100, "a5300", "p_riv", "payroll", "PR-0930");

    // Lincoln · revenue 220,000 (milestone) · cost 133,000
    T("t_lin_inv", "2026-09-29", "INV-1044 · Milestone 1 · Foundation complete", "c_lin", 220000, "a4000", "p_lin", "invoice", "INV-1044");
    T("t_lin_br", "2026-09-09", "BuildRight Supply · Bill BR-2240", "v_br", 24300, "a5000", "p_lin", "bill", "BR-2240");
    T("t_lin_fa", "2026-09-28", "FASTENAL CO01 SAN LEANDRO", "v_fa", 760, "a5000", "p_lin", "card", "••2087", { card_id: "c2087" });
    T("t_lin_ss", "2026-09-21", "Steel Source Co. · Bill SS-5531", "v_ss", 6740, "a5000", "p_lin", "bill", "SS-5531");
    T("t_lin_abc", "2026-09-17", "ABC Concrete · Bill ABC-4480", "v_abc", 52000, "a5100", "p_lin", "bill", "ABC-4480");
    T("t_lin_cat", "2026-09-14", "CAT Rental Store · Bill CR-2271", "v_cat", 9200, "a5200", "p_lin", "bill", "CR-2271");
    T("t_lin_lab", "2026-09-30", "Payroll labor allocation · PR-0930", "v_payroll", 40000, "a5300", "p_lin", "payroll", "PR-0930");

    // The two items the review will find
    T("t_hd8400", "2026-09-28", "HOME DEPOT #4411 SAN JOSE", "v_hd", 8400, "a5000", null, "card", "••4411", { card_id: "c4411", memo: "Accepted in bank feed by Aisha Khan · no project" });
    T("t_amz", "2026-09-24", "AMZN MKTP US*2K4 · Amzn.com/bill", "v_amz", 1284.6, "a6300", null, "card", "••2087", { card_id: "c2087", memo: "AI suggested Office Supplies (48% sure)" });

    // Receipts inbox (forwarded by email / snapped in the QuickBooks app), not yet matched
    for (const r of RECEIPTS) {
      ins("receipts", { id: r.id, vendor: r.vendor, amount: r.amount, date: r.date, file: receiptFile(r.id), job_ref: r.jobRef, matched_txn_id: null, received_via: "Forwarded to receipts@harborpine.demo" });
    }

    // Payroll allocation detail (PR-0930). Framing crew B defaults to Elm St in payroll.
    const L = (worker: string, crew: string, project: string, hours: number) => ins("labor_alloc", { worker, crew, project_id: project, hours, amount: hours * 80, ref: "PR-0930" });
    L("Crew A (6 workers)", "A", "p_elm", 1002.5);
    for (const w of ["D. Alvarez", "K. Osei", "M. Grant", "T. Nguyen"]) L(w, "B", "p_elm", 120);
    L("Crew C (5 workers)", "C", "p_oak", 653.75);
    L("Crew D (7 workers)", "D", "p_riv", 926.25);
    L("Crew E (4 workers)", "E", "p_lin", 500);

    // SiteLog approved crew timesheets (visible only to an app with SiteLog access)
    const TE = (worker: string, crew: string, project: string, week: string, hours: number) =>
      ins("time_entries", { worker, crew, project_id: project, week_start: week, hours, approved: 1, approved_by: crew === "B" ? "J. Park (Oak Ave foreman)" : "Site foreman", source: "sitelog" });
    TE("Crew A (6 workers)", "A", "p_elm", "2026-09-01", 1002.5);
    for (const w of ["D. Alvarez", "K. Osei", "M. Grant", "T. Nguyen"]) for (const wk of ["2026-09-07", "2026-09-14", "2026-09-21"]) TE(w, "B", "p_oak", wk, 40);
    TE("Crew C (5 workers)", "C", "p_oak", "2026-09-01", 653.75);
    TE("Crew D (7 workers)", "D", "p_riv", "2026-09-01", 926.25);
    TE("Crew E (4 workers)", "E", "p_lin", "2026-09-01", 500);

    // SiteLog daily logs the first-party agent can read (connected app)
    ins("site_logs", { project_id: "p_oak", date: "2026-09-28", crew: 9, deliveries: JSON.stringify(["Pacific Lumber (studs)"]), note: "Framing level 2; MEP rough-in" });
    ins("site_logs", { project_id: "p_elm", date: "2026-09-28", crew: 8, deliveries: JSON.stringify(["Steel Source (deck)"]), note: "Level 3 deck pour prep" });

    // Policies Priya controls
    const PO = (key: string, label: string, detail: string, mode: string, limit: number | null, editable: number, sort: number) =>
      ins("policies", { key, label, detail, mode, limit_amount: limit, editable, sort });
    PO("attach_receipts", "Attach matching receipts", "Exact amount and vendor, date within 2 days. Never changes amounts, accounts or projects.", "auto", null, 1, 1);
    PO("confirmed_tag", "Apply a project the cardholder confirmed", "The person who made the purchase names the job.", "auto", 10000, 1, 2);
    PO("ask_source", "Ask the person who knows", "Only after documents and connected apps are checked. At most 3 open questions per person.", "auto", null, 0, 3);
    PO("move_cost", "Move cost between projects", "Reallocations proposed by Footnote or an installed agent.", "approval", null, 1, 4);
    PO("revenue_treatment", "Change revenue treatment", "Always reviewed by an accountant, then approved by you.", "expert", null, 0, 5);

    const S = (key: string, value: string) => ins("settings", { key, value });
    S("materiality", "5000");
    S("bank_synced_at", ago(125));
    S("payroll_posted_at", "2026-09-30T23:10:00.000Z");
    S("sitelog_logs_at", ago(14 * 60));
    S("review_date", "2026-10-02");
  }

  for (const [table, rows] of tables) {
    const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    await tx.unsafe(
      `insert into ${table} (${cols.join(",")}) values ${rows.map((_, i) => `(${cols.map((__, j) => `$${i * cols.length + j + 1}`).join(",")})`).join(",")}`,
      rows.flatMap((r) => cols.map((c) => (r[c] === undefined ? null : r[c]))) as never[],
    );
  }
}
