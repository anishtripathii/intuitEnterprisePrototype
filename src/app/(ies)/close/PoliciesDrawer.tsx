"use client";

import { useState } from "react";
import { Drawer } from "@/components/Modal";
import { Icon } from "@/components/icons";
import { Chip, FnTag } from "@/components/ui";
import { useAction } from "@/components/Toast";
import { relTime } from "@/lib/format";
import type { CloseState } from "./shared";

const LIMITED = ["confirmed_tag", "move_cost"];

export default function PoliciesDrawer({ state, onClose, reload }: { state: CloseState; onClose: () => void; reload: () => Promise<void> }) {
  const act = useAction();
  const [rows, setRows] = useState(state.policies.map((p) => ({ ...p })));
  const [mat, setMat] = useState(String(state.readiness.materiality));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const r = await act("/api/policies", { policies: rows.map((p) => ({ key: p.key, mode: p.mode, limit_amount: p.limit_amount })), materiality: Number(mat) });
    await reload();
    setBusy(false);
    if (r.ok) onClose();
  }
  async function revoke(id: number) {
    await act(`/api/installs/${id}/revoke`);
    await reload();
  }

  return (
    <Drawer
      title="Policies"
      eyebrow={<FnTag label="What Footnote may do on its own" />}
      onClose={onClose}
      width={620}
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={save}>Save policies</button></>}
    >
      <div className="flex flex-col gap-6 text-[14px]">
        <p className="text-ink-2">Each kind of action has a mode. Autonomous actions are listed on the issue with the policy that allowed them, and can be undone. An action earns more autonomy from audited accuracy, not from how often you click approve.</p>

        <div>
          <label htmlFor="mat" className="font-semibold block">Materiality limit</label>
          <p className="text-[13px] text-ink-2 mb-1.5">Issues below this are still worked, but they don&apos;t block the review.</p>
          <div className="flex items-center gap-1">$<input id="mat" type="number" min={0} step={500} value={mat} onChange={(e) => setMat(e.target.value)} className="w-32" /></div>
        </div>

        <ul className="flex flex-col divide-y divide-line border border-line rounded-xl">
          {rows.map((p, idx) => (
            <li key={p.key} className="p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{p.label}</div>
                  <div className="text-[13px] text-ink-2">{p.detail}</div>
                </div>
                {p.editable ? (
                  <select
                    aria-label={`Mode for ${p.label}`}
                    value={p.mode}
                    onChange={(e) => setRows((r) => r.map((x, i) => (i === idx ? { ...x, mode: e.target.value as typeof x.mode } : x)))}
                    className="shrink-0"
                  >
                    <option value="auto">Autonomous</option>
                    <option value="approval">Needs my approval</option>
                  </select>
                ) : (
                  <Chip tone={p.mode === "expert" ? "expert" : "good"} className="shrink-0"><Icon.Lock size={11} /> {p.mode === "expert" ? "Accountant, then you" : "Autonomous"}</Chip>
                )}
              </div>
              {LIMITED.includes(p.key) && p.mode === "auto" ? (
                <label className="flex items-center gap-2 text-[13px] text-ink-2">
                  Only up to $
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={p.limit_amount ?? ""}
                    placeholder="no limit"
                    onChange={(e) => setRows((r) => r.map((x, i) => (i === idx ? { ...x, limit_amount: e.target.value === "" ? null : Number(e.target.value) } : x)))}
                    className="w-28 !py-1"
                  />
                  <span>per item</span>
                </label>
              ) : null}
            </li>
          ))}
        </ul>

        <div>
          <div className="font-semibold mb-2">Installed agents</div>
          {state.installs.length ? (
            <ul className="flex flex-col gap-2">
              {state.installs.map((inst) => (
                <li key={inst.id} className="flex items-center justify-between gap-3 rounded-lg border border-line p-3">
                  <div>
                    <div className="font-semibold">{inst.name}</div>
                    <div className="text-[12.5px] text-ink-2">Suggest only · {inst.entities.map((e) => (e === "hpb" ? "Builders" : e === "prs" ? "Pine Ridge" : "Group")).join(", ")} · installed {relTime(inst.installed_at)}</div>
                  </div>
                  <button className="btn btn-danger btn-sm" onClick={() => revoke(inst.id)}>Remove access</button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-ink-3">No partner agents installed. Footnote recommends one when an issue needs it.</p>
          )}
        </div>
      </div>
    </Drawer>
  );
}
