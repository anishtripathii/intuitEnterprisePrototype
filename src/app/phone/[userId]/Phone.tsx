"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { Avatar } from "@/components/ui";
import DemoBar from "@/components/shell/DemoBar";
import { usePoll } from "@/components/usePoll";
import { clockTime, niceDateTime } from "@/lib/format";
import { demoNow } from "@/lib/clock";

type Msg = { id: number; channel: string; body: string; link: string | null; created_at: string; q_status: string | null; answer_label: string | null };
type Data = { user: { id: string; name: string; phone: string | null; title: string; initials: string; color: string }; messages: Msg[] };

export default function Phone({ userId }: { userId: string }) {
  const { data, reload } = usePoll<Data>(`/api/outbox/${userId}`, 2500);
  const [link, setLink] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const count = data?.messages.length ?? 0;

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [count]);

  const first = data?.user.name.split(" ")[0] ?? "";

  return (
    <div className="min-h-screen bg-[#e8eaef] flex flex-col">
      <DemoBar note="Simulated phone: this is what someone outside finance receives" />
      <div className="flex-1 flex flex-col lg:flex-row items-center lg:items-start justify-center gap-10 py-8 px-4">
        <div className="max-w-[330px] lg:pt-24 text-center lg:text-left">
          {data ? <div className="flex items-center gap-2 justify-center lg:justify-start"><Avatar initials={data.user.initials} color={data.user.color} size={32} /><div className="text-left leading-tight"><div className="font-semibold">{data.user.name}</div><div className="text-[12.5px] text-ink-3">{data.user.title}</div></div></div> : null}
          <h1 className="text-[22px] font-semibold mt-4 leading-snug">{first}&apos;s phone</h1>
          <p className="text-[14px] text-ink-2 mt-2">{first} doesn&apos;t use QuickBooks. Footnote texts a link that opens one question. The answer lands on the record with {first}&apos;s name.</p>
          <p className="text-[13px] text-ink-3 mt-3">Tap the link in the newest message.</p>
          <button onClick={() => history.back()} className="btn btn-secondary btn-sm mt-5"><Icon.ArrowLeft size={14} /> Back</button>
        </div>
        <div className="relative w-[375px] max-w-full h-[760px] rounded-[52px] bg-[#0f1115] p-3 shadow-2xl shrink-0">
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[118px] h-[28px] bg-[#0f1115] rounded-b-[18px] z-10" />
          <div className="w-full h-full rounded-[42px] bg-white overflow-hidden flex flex-col">
            <div className="h-11 flex items-end justify-between px-8 pb-1.5 text-[13px] font-semibold shrink-0">
              <span suppressHydrationWarning>{clockTime(demoNow())}</span>
              <span className="w-6 h-3 rounded-[3px] border border-ink relative"><span className="absolute inset-[1.5px] right-[5px] bg-ink rounded-[1px]" /></span>
            </div>
            {link ? (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-line text-[13px] shrink-0 bg-[#f6f6f8]">
                  <button onClick={() => { setLink(null); reload(); }} className="text-[#0a64d6] flex items-center gap-0.5"><Icon.ChevronRight size={16} className="rotate-180" /> Messages</button>
                  <span className="flex-1 text-center text-ink-3 truncate flex items-center justify-center gap-1"><Icon.Lock size={11} /> harborpine.footnote.app</span>
                  <span className="w-16" />
                </div>
                <iframe key={link} src={link} title="Answer" className="flex-1 w-full border-0" />
              </div>
            ) : (
              <>
                <div className="flex flex-col items-center py-2.5 border-b border-line shrink-0 bg-[#f6f6f8]">
                  <span className="w-11 h-11 rounded-full bg-[#1f2d5c] text-white text-[11px] font-bold flex items-center justify-center">H&amp;P</span>
                  <div className="text-[12px] mt-1 font-medium">H&amp;P Finance</div>
                </div>
                <div ref={scroller} className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3 bg-white">
                  {!data ? <div className="text-center text-ink-3 text-sm mt-10">Loading…</div> : data.messages.length === 0 ? (
                    <div className="text-center text-ink-3 text-[13px] mt-16 px-6">No messages yet. They appear here when Footnote needs something from {first}.</div>
                  ) : (
                    data.messages.map((m) => (
                      <div key={m.id} className="flex flex-col items-start max-w-[86%] fn-in">
                        <div className="text-[10.5px] text-ink-3 mb-0.5 ml-1">{niceDateTime(m.created_at)}</div>
                        <div className="rounded-[18px] rounded-bl-md bg-[#e9e9eb] px-3.5 py-2 text-[14.5px] leading-snug text-[#111]">
                          {m.body}
                          {m.link ? (
                            <button onClick={() => setLink(m.link)} className="block mt-1.5 text-[#0a64d6] underline text-left break-all">
                              harborpine.footnote.app{m.link.slice(0, 12)}…
                            </button>
                          ) : null}
                        </div>
                        {m.q_status === "answered" ? (
                          <div className="self-end mt-1.5 rounded-[18px] rounded-br-md bg-[#0a84ff] text-white px-3.5 py-2 text-[14.5px]">✓ {m.answer_label}</div>
                        ) : m.q_status === "rerouted" ? (
                          <div className="self-end mt-1.5 rounded-[18px] rounded-br-md bg-[#0a84ff] text-white px-3.5 py-2 text-[14.5px]">Not mine · passed on</div>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
                <div className="px-3 py-2.5 border-t border-line flex items-center gap-2 shrink-0">
                  <div className="flex-1 h-9 rounded-full border border-line px-4 text-[13.5px] text-ink-3 flex items-center">Text Message</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
