"use client";

import { useEffect, useMemo, useState } from "react";
import FingerprintJS from "@fingerprintjs/fingerprintjs";

type AiResponse =
  | {
      ok: true;
      answer: string;
      prompt: string;
      limit: number;
      remaining: number;
      reset: number;
      visitorId: string | null;
      identifier: string;
    }
  | {
      ok: false;
      error: string;
      limit: number;
      remaining: number;
      reset: number;
      retryAfterSeconds?: number;
      visitorId: string | null;
      identifier: string;
    };

function formatReset(resetMs: number) {
  try {
    return new Date(resetMs).toLocaleString();
  } catch {
    return String(resetMs);
  }
}

export default function Home() {
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("你好，介绍一下你自己");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fp = await FingerprintJS.load();
        const r = await fp.get();
        if (cancelled) return;
        setVisitorId(r.visitorId);
      } catch (e) {
        if (cancelled) return;
        // Fingerprinting may fail due to CSP/adblock/etc. The API will fallback to IP.
        setVisitorId(null);
        console.warn("FingerprintJS failed:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canCall = useMemo(() => !loading, [loading]);

  async function callAi() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(visitorId ? { "x-visitor-id": visitorId } : {}),
        },
        body: JSON.stringify({ prompt, visitorId }),
      });

      const data = (await res.json()) as AiResponse;
      setResult(data);
      if (!res.ok) {
        setError(
          data.ok
            ? "请求失败"
            : data.error === "RATE_LIMITED"
              ? `已限流，请稍后再试（${data.retryAfterSeconds ?? "?"}s）`
              : `请求失败：${data.error}`,
        );
      }
    } catch (e) {
      setError(`网络错误：${e instanceof Error ? e.message : String(e)}`);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <div className="w-full max-w-2xl rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              AI 调用模拟（免登录 + 限次数）
            </div>
            <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              调用 <span className="font-mono">POST /api/ai</span>，服务端用 Upstash
              Redis 按 visitorId/IP 做限流。
            </div>
          </div>
          <div className="text-right text-xs text-zinc-500 dark:text-zinc-400">
            <div>visitorId</div>
            <div className="mt-1 max-w-[240px] truncate font-mono text-zinc-800 dark:text-zinc-200">
              {visitorId ?? "（获取中/不可用）"}
            </div>
          </div>
        </div>

        <div className="mt-5">
          <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Prompt
          </label>
          <textarea
            className="mt-2 w-full resize-none rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-0 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-600"
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="输入你要问 AI 的内容"
          />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            disabled={!canCall}
            onClick={callAi}
          >
            {loading ? "调用中…" : "调用 AI"}
          </button>

          {result && (
            <div className="text-xs text-zinc-600 dark:text-zinc-400">
              <span className="font-medium">remaining:</span>{" "}
              <span className="font-mono">{result.remaining}</span> /{" "}
              <span className="font-mono">{result.limit}</span>{" "}
              <span className="ml-2">
                <span className="font-medium">reset:</span>{" "}
                <span className="font-mono">{formatReset(result.reset)}</span>
              </span>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200">
            {error}
          </div>
        )}

        {result?.ok && (
          <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
            <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Answer
            </div>
            <div className="mt-1 whitespace-pre-wrap text-sm text-zinc-900 dark:text-zinc-100">
              {result.answer}
            </div>
            <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="font-medium">identifier:</span>{" "}
              <span className="font-mono">{result.identifier}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
