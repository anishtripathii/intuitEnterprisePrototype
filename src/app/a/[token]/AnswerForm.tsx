"use client";

import { useEffect, useState } from "react";
import { FootnoteLogo, Icon } from "@/components/icons";

type Data = {
  status: string; prompt: string; options: { choices: { value: string; label: string }[] };
  askedName: string; from: string; vendor: string | null; amount: string | null; date: string | null; receipt: string | null; answerLabel: string | null;
  others: { id: string; name: string; title: string }[];
};

export default function AnswerForm({ token }: { token: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [notMine, setNotMine] = useState(false);
  const [suggest, setSuggest] = useState("");

  useEffect(() => {
    fetch(`/api/answer/${token}`, { cache: "no-store" })
      .then(async (r) => (r.ok ? setData(await r.json()) : setError((await r.json()).error ?? "This link has expired.")))
      .catch(() => setError("No connection. Try again."));
  }, [token]);

  async function submit() {
    if (!data || !value) return;
    const choice = data.options.choices.find((c) => c.value === value);
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/answer/${token}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ value, label: choice?.label, note }) });
    setBusy(false);
    if (r.ok) setDone(choice?.label ?? value);
    else setError((await r.json().catch(() => ({}))).error ?? "Something went wrong. Try again.");
  }
  async function passOn() {
    setBusy(true);
    const r = await fetch(`/api/answer/${token}/not-mine`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ suggestUserId: suggest || undefined }) });
    setBusy(false);
    if (r.ok) setDone("__passed");
    else setError((await r.json().catch(() => ({}))).error ?? "Couldn't pass this on.");
  }

  const header = (
    <div className="flex items-center gap-2.5 px-5 py-3 border-b border-line bg-white sticky top-0 z-10">
      <span className="w-8 h-8 rounded-lg bg-[#1f2d5c] text-white text-[10px] font-bold flex items-center justify-center">H&amp;P</span>
      <div className="leading-tight min-w-0">
        <div className="text-[13.5px] font-semibold truncate">{data?.from ?? "Harbor & Pine finance"}</div>
        <div className="text-[11.5px] text-ink-3 flex items-center gap-1">One-time link · no login <FootnoteLogo size={11} /></div>
      </div>
    </div>
  );

  if (error && !data) return <div className="min-h-screen bg-canvas">{header}<div className="p-8 text-center text-ink-2">{error}</div></div>;
  if (!data) return <div className="min-h-screen bg-canvas">{header}<div className="p-8 text-center text-ink-3">Loading…</div></div>;

  if (done || data.status !== "open") {
    const passed = done === "__passed" || data.status === "rerouted";
    return (
      <div className="min-h-screen bg-canvas">
        {header}
        <div className="p-6 flex flex-col items-center text-center gap-3 mt-10 fn-in">
          <span className={`w-16 h-16 rounded-full flex items-center justify-center ${passed ? "bg-[#e7f0fb] text-link" : "bg-good-soft text-good"}`}><Icon.Check size={32} /></span>
          <div className="text-[21px] font-semibold">{passed ? "Passed on. Thanks!" : "Thanks, that's it"}</div>
          <p className="text-[14.5px] text-ink-2 max-w-[290px]">
            {passed ? "We'll ask the right person." : <>You answered <b className="text-ink">{done ?? data.answerLabel}</b>. It&apos;s attached to the record with your name, so nobody needs to ask again.</>}
          </p>
          <p className="text-[12px] text-ink-3 mt-8">You can close this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas pb-10">
      {header}
      <div className="p-5 flex flex-col gap-4">
        <div className="text-[13px] text-ink-2">Hi {data.askedName.split(" ")[0]}, one quick question</div>
        {data.vendor ? (
          <div className="card p-4 flex gap-3 items-center">
            {data.receipt ? (
              <a href={`/api/files/${data.receipt}`} target="_blank" className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/files/${data.receipt}`} alt="Receipt" className="w-12 h-16 object-cover rounded border border-line" />
              </a>
            ) : null}
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] text-ink-3">{data.date} · company card</div>
              <div className="text-[17px] font-semibold">{data.vendor}</div>
            </div>
            {data.amount ? <div className="text-[19px] font-semibold num">{data.amount}</div> : null}
          </div>
        ) : null}
        <div className="text-[16.5px] font-semibold leading-snug">{data.prompt}</div>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Answer">
          {data.options.choices.map((c) => (
            <button
              key={c.value}
              role="radio"
              aria-checked={value === c.value}
              onClick={() => setValue(c.value)}
              className={`w-full text-left rounded-xl border-2 px-4 py-3.5 text-[15.5px] font-medium bg-white transition flex items-center justify-between ${value === c.value ? "border-qb bg-qb-soft" : "border-line hover:border-ink-3"}`}
            >
              {c.label}
              {value === c.value ? <Icon.Check size={18} className="text-qb" /> : null}
            </button>
          ))}
        </div>
        <textarea rows={2} placeholder="Add a note (optional)" value={note} onChange={(e) => setNote(e.target.value)} className="text-[14px]" aria-label="Note" />
        {error ? <div className="text-bad text-[13px]">{error}</div> : null}
        <button className="btn btn-primary h-12 text-[16px] rounded-xl" onClick={submit} disabled={busy || !value}>{busy ? "Sending…" : "Send answer"}</button>
        <div className="border-t border-line pt-3">
          {!notMine ? (
            <button className="text-[14px] text-link" onClick={() => setNotMine(true)}>Not mine? Pass it on</button>
          ) : (
            <div className="flex flex-col gap-2">
              <label htmlFor="who" className="text-[14px] font-semibold">Who should we ask instead?</label>
              <select id="who" value={suggest} onChange={(e) => setSuggest(e.target.value)}>
                <option value="">I don&apos;t know · let finance decide</option>
                {data.others.map((o) => <option key={o.id} value={o.id}>{o.name} · {o.title.split(" · ")[0]}</option>)}
              </select>
              <button className="btn btn-secondary" onClick={passOn} disabled={busy}>Pass it on</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
