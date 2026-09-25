// The guided "Footnote demo", one track per primary user. Each step points at a real element on a real
// screen (marked with data-tour="…") and explains it in plain words. "Next" does that step's action,
// the way the person would, then moves on.

export type Helpers = {
  // Wait for an element (a data-tour name or a CSS selector) and click it.
  click: (target: string, timeout?: number) => Promise<void>;
  // Tick a checkbox if it isn't ticked yet.
  check: (target: string, timeout?: number) => Promise<void>;
  waitFor: (target: string, timeout?: number) => Promise<HTMLElement>;
  // Play the part of someone who isn't on this screen (see /api/demo/tour).
  demo: (action: string) => Promise<void>;
  sleep: (ms: number) => Promise<void>;
};

export type TourStep = {
  as: string; // who is signed in for this step
  path: string;
  issue?: string; // on the close page: the issue that should be open
  target: string;
  title: string;
  body: string;
  waiting?: string; // shown while the screen gets ready
  next?: (h: Helpers) => Promise<void>;
};

export type TrackId = "controller" | "developer";
export type Track = { id: TrackId; person: string; role: string; pitch: string; start: string; steps: TourStep[] };

const inIssue = (issue: string, target: string) => `[data-issue="${issue}"] [data-tour="${target}"]`;

async function install(h: Helpers) {
  await h.click("install-open");
  await h.click("install-confirm");
  await h.waitFor("proposal", 30000);
}

export const TRACKS: Record<TrackId, Track> = {
  controller: {
    id: "controller",
    person: "Priya",
    role: "Controller at Harbor & Pine",
    pitch: "Closes September without chasing anyone. Footnote investigates, asks the right person, brings in a partner agent and an accountant, then shows why each margin changed.",
    start: "/close",
    steps: [
      {
        as: "u_priya", path: "/close", target: "start-review",
        title: "Priya hands Footnote one job",
        body: "Priya is the controller. Leadership reviews project margins on Oct 2, and every number has to be right. Instead of checking everything herself, she gives Footnote one goal.",
        next: (h) => h.click("start-button"),
      },
      {
        as: "u_priya", path: "/close", target: "investigation",
        waiting: "Footnote is checking the books…",
        title: "Footnote checks everything first",
        body: "It reads the books and the apps the company uses: bank feeds, payroll, receipts and SiteLog. It attached 7 matching receipts on its own. What it can't settle becomes an issue on the left.",
      },
      {
        as: "u_priya", path: "/close", issue: "iss_proj_t_hd8400", target: "issue-action",
        title: "Missing a fact? It asks the person who knows",
        body: "This $8,400 Home Depot purchase has no project, and the receipt doesn't say which job. So Footnote texted Luis, the project manager who bought it. He doesn't need to log in.",
      },
      {
        as: "u_priya", path: "/phone/u_luis", target: "phone",
        title: "What Luis sees on his phone",
        body: "One short text with a link. He taps the job, and he's done. Click Next and Luis answers “Oak Ave”.",
        next: async (h) => {
          await h.demo("luis-answers");
          await h.waitFor("phone-answered", 6000).catch(() => undefined);
          await h.sleep(900);
        },
      },
      {
        as: "u_priya", path: "/close", issue: "iss_labor", target: "issue-action",
        title: "Data in another app? A partner agent helps",
        body: "Luis's answer was applied on its own, because Priya's rule allows it under $10,000. Next problem: Oak Ave's labor cost looks too low. Crew hours live in SiteLog, so Footnote recommends SiteLog's tested agent. Next installs it.",
        next: install,
      },
      {
        as: "u_priya", path: "/close", issue: "iss_labor", target: "issue-action",
        title: "The agent proposes, Priya decides",
        body: "CostCheck found a crew that worked at Oak Ave for three weeks while payroll charged Elm St. It proposes moving $38,400 and shows the approved timesheets as proof. Nothing changes until Priya approves.",
        next: async (h) => {
          await h.click(inIssue("iss_labor", "approve"));
          await h.waitFor(inIssue("iss_labor", "resolved"), 20000);
        },
      },
      {
        as: "u_priya", path: "/close", issue: "iss_rev", target: "issue-action",
        title: "A judgment call? It brings in an accountant",
        body: "This $220,000 invoice raises a revenue question that needs a professional. Footnote drafts an answer but won't post it. In one click, Priya sends a small case file to her own accountant, Elena.",
        next: async (h) => {
          await h.click("expert-open");
          await h.click("expert-send");
          await h.waitFor("with-expert", 30000);
        },
      },
      {
        as: "u_elena", path: "/expert/cases/C-1001", target: "case-decision",
        title: "Elena reviews only this case",
        body: "On the left is everything Footnote gathered: the invoice, the contract, the costs and its draft. Elena can ask for more information here, then recommends what to do and why. Next, she recommends counting revenue as the work is done.",
        next: (h) => h.demo("elena-returns"),
      },
      {
        as: "u_priya", path: "/close", issue: "iss_rev", target: "issue-action",
        title: "The advice comes back to Priya",
        body: "Elena changed the draft: record $176,527 now and the rest later. Elena recommends; she doesn't post. Priya approves, and IES records it with Elena's name on it.",
        next: async (h) => {
          await h.click(inIssue("iss_rev", "approve"));
          await h.waitFor(inIssue("iss_rev", "resolved"), 20000);
        },
      },
      {
        as: "u_priya", path: "/close", target: "readiness",
        title: "Ready for the review",
        body: "Every problem big enough to matter is resolved, so Footnote says Priya is ready for Oct 2. It also shows how fresh each connected app's data is.",
      },
      {
        as: "u_priya", path: "/reports", target: "report",
        title: "Leadership sees what changed, and why",
        body: "Each project's margin before and after, with the reason for every change. Oak Ave looked like the best job at 40.7%. Its real margin is 27.9%. Click any project to see its full trail.",
      },
    ],
  },
  developer: {
    id: "developer",
    person: "Ravi",
    role: "Founder of SiteLog, a field app",
    pitch: "Builds an agent for a problem customers actually have, proves it on 24 test cases, publishes it, and gets paid when a customer accepts its fix.",
    start: "/developer",
    steps: [
      {
        as: "u_ravi", path: "/developer", target: "demand",
        title: "Ravi finds a problem worth solving",
        body: "Ravi runs SiteLog, an app construction crews use to log their time. This board shows problems customers' close agents couldn't solve. 1,241 are about labor that doesn't match the job site, and no agent handles them yet.",
        next: async (h) => {
          await h.click("build-agent");
          await h.waitFor("build", 20000);
        },
      },
      {
        as: "u_ravi", path: "/developer", target: "build",
        title: "He builds an agent from a template",
        body: "The template does the heavy lifting. He sees exactly what the agent may read and sets its price: $6, charged only when a customer accepts a fix. Customers see this same list before installing it.",
        next: async (h) => {
          await h.click("run-tests");
          await h.waitFor("test-results", 30000);
        },
      },
      {
        as: "u_ravi", path: "/developer", target: "test-results",
        title: "It's tested before any customer can use it",
        body: "The Proving Ground runs 24 practice cases. It failed 2: it suggested fixes from timesheets nobody had approved yet. That would mislead a customer. Next, Ravi turns on one setting to skip them and runs the tests again.",
        next: async (h) => {
          await h.click("fix-in-build");
          await h.check("abstain");
          await h.click("run-tests");
          await h.waitFor("test-passed", 30000);
        },
      },
      {
        as: "u_ravi", path: "/developer", target: "test-passed",
        title: "All 24 cases pass",
        body: "Passing the tests isn't enough on its own. Intuit also checks security and data access. Then the agent goes live in the IES App Store.",
        next: async (h) => {
          await h.click("publish");
          await h.waitFor("published", 30000);
        },
      },
      {
        as: "u_priya", path: "/close", issue: "iss_labor", target: "issue-action",
        title: "Customers find it when they need it",
        body: "At Harbor & Pine, Priya's close agent flagged labor that doesn't match the job site. SiteLog CostCheck is recommended right on that issue. She installs it in one click, and it can only suggest changes.",
        next: install,
      },
      {
        as: "u_priya", path: "/close", issue: "iss_labor", target: "issue-action",
        title: "The agent proposes a fix, with proof",
        body: "CostCheck matched 480 approved crew hours to Oak Ave and proposes moving $38,400 from Elm St. Priya approves and IES posts it. SiteLog never touches the books.",
        next: async (h) => {
          await h.click(inIssue("iss_labor", "approve"));
          await h.waitFor(inIssue("iss_labor", "resolved"), 20000);
        },
      },
      {
        as: "u_ravi", path: "/developer", target: "earn",
        title: "Ravi gets paid for results",
        body: "Ravi earns only when a customer accepts a fix: $6 billed, $4.80 to SiteLog. Rejected suggestions cost the customer nothing.",
      },
    ],
  },
};
