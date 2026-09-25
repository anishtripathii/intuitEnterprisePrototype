"use client";

import { useCallback, useEffect, useState } from "react";

export function usePoll<T>(url: string | null, ms = 3000) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!url) return;
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (r.ok) {
        setData((await r.json()) as T);
        setError(null);
      } else {
        setError(`Couldn't load (${r.status})`);
      }
    } catch {
      setError("Network error");
    }
  }, [url]);
  useEffect(() => {
    load();
    if (!ms) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, ms);
    return () => clearInterval(id);
  }, [load, ms]);
  return { data, error, reload: load };
}

export async function postJson<T = unknown>(url: string, body?: unknown): Promise<{ ok: boolean; data: T }> {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = (await r.json().catch(() => ({}))) as T;
  return { ok: r.ok, data };
}
