import type { IssueView, Policy } from "@/lib/model";
import type { ReadinessData } from "@/components/Readiness";

export type Step = { seq: number; label: string; detail: string; source: string; outcome: string };
export type CloseState = {
  run: { id: string; goal: string; entities: string[]; status: string; started_at: string } | null;
  steps: Step[];
  issues: IssueView[];
  readiness: ReadinessData;
  policies: Policy[];
  installs: { id: number; agent_id: string; name: string; entities: string[]; installed_at: string }[];
  projects: { id: string; name: string }[];
  experts: { id: string; name: string; firm: string | null; own: boolean }[];
};

export function issueCtx(i: IssueView) {
  return { asked: i.question?.askedFirst, expert: i.case?.expertName.split(" ")[0], caseStatus: i.case?.status };
}
