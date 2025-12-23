"use client";

import { useEffect, useState, useCallback } from "react";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import Turnstile from "./components/Turnstile";

// Turnstile Site Key（从环境变量获取或使用测试 key）
// 测试 Site Key: 1x00000000000000000000AA (总是通过)
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";

type UsageData = {
  visitorId: string;
  clientIP: string;
  userAgent?: string;
  dailyLimit: number;
  usedToday: number;
  remaining: number;
  isLimited: boolean;
  usageDetails: {
    byFingerprint: number;
    byIP: number;
    byCombined?: number;
  };
  date: string;
  resetAt?: string;
};

type ApiResponse = {
  success: boolean;
  data: UsageData | null;
  message: string;
  error?: string;
};

export default function Home() {
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [callHistory, setCallHistory] = useState<
    { time: string; success: boolean; message: string }[]
  >([]);

  // Turnstile 相关状态
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileError, setTurnstileError] = useState<string | null>(null);
  // 用于强制重新渲染 Turnstile 组件（每次调用后需要重新验证）
  const [turnstileKey, setTurnstileKey] = useState(0);

  // 初始化 FingerprintJS
  useEffect(() => {
    (async () => {
      try {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        setVisitorId(result.visitorId);
      } catch (err) {
        console.warn("FingerprintJS failed:", err);
        setError("无法获取浏览器指纹");
      }
    })();
  }, []);

  // 查询当前使用情况
  const fetchUsage = useCallback(async () => {
    if (!visitorId) return;

    try {
      const res = await fetch(`/api/ai?visitorId=${visitorId}`);
      const data: ApiResponse = await res.json();
      if (data.success && data.data) {
        setUsageData(data.data);
        setError(null);
      }
    } catch (err) {
      console.error("Failed to fetch usage:", err);
    }
  }, [visitorId]);

  // 初始化时查询使用情况
  useEffect(() => {
    if (visitorId) {
      fetchUsage();
    }
  }, [visitorId, fetchUsage]);

  // Turnstile 回调处理
  const handleTurnstileSuccess = useCallback((token: string) => {
    setTurnstileToken(token);
    setTurnstileError(null);
  }, []);

  const handleTurnstileError = useCallback((errorCode: string) => {
    setTurnstileToken(null);
    setTurnstileError(`验证失败: ${errorCode}`);
  }, []);

  const handleTurnstileExpired = useCallback(() => {
    setTurnstileToken(null);
    setTurnstileError("验证已过期，请重新验证");
  }, []);

  // 调用 API（消耗次数）
  const callApi = async () => {
    if (!visitorId || loading) return;

    // 检查 Turnstile 验证
    if (!turnstileToken) {
      setError("请先完成人机验证");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitorId,
          turnstileToken, // 发送 Turnstile token 到后端验证
        }),
      });

      const data: ApiResponse = await res.json();
      const now = new Date().toLocaleTimeString("zh-CN");

      if (data.data) {
        setUsageData(data.data);
      }

      setCallHistory((prev) => [
        { time: now, success: data.success, message: data.message },
        ...prev.slice(0, 9), // 只保留最近 10 条
      ]);

      if (!data.success) {
        setError(data.message || data.error || "调用失败");
      }

      // 每次调用后重置 Turnstile（token 只能用一次）
      setTurnstileToken(null);
      setTurnstileKey(k => k + 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "网络错误";
      setError(msg);
      setCallHistory((prev) => [
        { time: new Date().toLocaleTimeString("zh-CN"), success: false, message: msg },
        ...prev.slice(0, 9),
      ]);
      // 出错也要重置 Turnstile
      setTurnstileToken(null);
      setTurnstileKey(k => k + 1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 font-sans text-slate-100 sm:p-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            🔒 Rate Limit Demo
          </h1>
          <p className="text-slate-400">
            FingerprintJS + Upstash Redis + IP 多维度限流演示
          </p>
        </div>

        {/* 用户标识卡片 */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/50 shadow-xl backdrop-blur">
          <div className="border-b border-slate-700/50 bg-slate-800/80 px-5 py-3">
            <h2 className="font-semibold text-slate-200">👤 用户标识</h2>
          </div>
          <div className="space-y-4 p-5">
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">
                浏览器指纹 ID
              </div>
              <div className="break-all rounded-lg bg-slate-900/70 px-3 py-2 font-mono text-sm text-emerald-400">
                {visitorId ?? (
                  <span className="animate-pulse text-slate-500">获取中...</span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">
                  IP 地址
                </div>
                <div className="rounded-lg bg-slate-900/70 px-3 py-2 font-mono text-sm text-amber-400">
                  {usageData?.clientIP ?? (
                    <span className="text-slate-500">--</span>
                  )}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">
                  日期
                </div>
                <div className="rounded-lg bg-slate-900/70 px-3 py-2 font-mono text-sm text-sky-400">
                  {usageData?.date ?? (
                    <span className="text-slate-500">--</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 使用情况卡片 */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/50 shadow-xl backdrop-blur">
          <div className="border-b border-slate-700/50 bg-slate-800/80 px-5 py-3">
            <h2 className="font-semibold text-slate-200">📊 今日使用情况</h2>
          </div>
          <div className="p-5">
            {/* 进度条 */}
            <div className="mb-6">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-sm text-slate-400">使用进度</span>
                <span className="font-mono text-lg font-bold">
                  <span
                    className={
                      usageData?.isLimited ? "text-red-400" : "text-emerald-400"
                    }
                  >
                    {usageData?.usedToday ?? 0}
                  </span>
                  <span className="text-slate-500">
                    {" "}
                    / {usageData?.dailyLimit ?? 3}
                  </span>
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-700">
                <div
                  className={`h-full transition-all duration-500 ${usageData?.isLimited
                    ? "bg-gradient-to-r from-red-500 to-red-400"
                    : "bg-gradient-to-r from-emerald-500 to-emerald-400"
                    }`}
                  style={{
                    width: `${((usageData?.usedToday ?? 0) / (usageData?.dailyLimit ?? 3)) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* 统计数字 */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="rounded-xl bg-slate-900/50 p-4">
                <div className="text-2xl font-bold text-emerald-400">
                  {usageData?.remaining ?? 3}
                </div>
                <div className="mt-1 text-xs text-slate-500">剩余次数</div>
              </div>
              <div className="rounded-xl bg-slate-900/50 p-4">
                <div className="text-2xl font-bold text-amber-400">
                  {usageData?.usageDetails?.byIP ?? 0}
                </div>
                <div className="mt-1 text-xs text-slate-500">IP 调用</div>
              </div>
              <div className="rounded-xl bg-slate-900/50 p-4">
                <div className="text-2xl font-bold text-sky-400">
                  {usageData?.usageDetails?.byFingerprint ?? 0}
                </div>
                <div className="mt-1 text-xs text-slate-500">指纹调用</div>
              </div>
            </div>

            {/* 状态标签 */}
            {usageData?.isLimited && (
              <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-red-500/10 py-3 text-red-400">
                <span className="text-lg">🚫</span>
                <span className="font-medium">今日次数已用完</span>
              </div>
            )}
          </div>
        </div>

        {/* Turnstile 人机验证 */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/50 shadow-xl backdrop-blur">
          <div className="border-b border-slate-700/50 bg-slate-800/80 px-5 py-3">
            <h2 className="font-semibold text-slate-200">🛡️ 人机验证</h2>
          </div>
          <div className="flex flex-col items-center gap-3 p-5">
            <Turnstile
              key={turnstileKey}
              siteKey={TURNSTILE_SITE_KEY}
              onSuccess={handleTurnstileSuccess}
              onError={handleTurnstileError}
              onExpired={handleTurnstileExpired}
              theme="dark"
              size="normal"
              action="ai-call"
            />
            {/* 验证状态 */}
            {turnstileToken && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-2 text-emerald-400">
                <span>✓</span>
                <span className="text-sm">验证通过</span>
              </div>
            )}
            {turnstileError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-2 text-red-400">
                <span>✗</span>
                <span className="text-sm">{turnstileError}</span>
              </div>
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="mb-6">
          <button
            onClick={callApi}
            disabled={loading || !visitorId || !turnstileToken}
            className={`w-full rounded-xl px-6 py-4 text-lg font-semibold shadow-lg transition-all ${loading || !visitorId || !turnstileToken
              ? "cursor-not-allowed bg-slate-700 text-slate-500"
              : usageData?.isLimited
                ? "bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-500 hover:to-red-400 hover:shadow-red-500/20"
                : "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:from-emerald-500 hover:to-emerald-400 hover:shadow-emerald-500/20"
              }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                调用中...
              </span>
            ) : !turnstileToken ? (
              "🔒 请先完成人机验证"
            ) : usageData?.isLimited ? (
              "🚫 已达上限（点击测试拒绝）"
            ) : (
              "🚀 调用 AI 接口（消耗 1 次）"
            )}
          </button>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400">
            ⚠️ {error}
          </div>
        )}

        {/* 调用历史 */}
        {callHistory.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/50 shadow-xl backdrop-blur">
            <div className="border-b border-slate-700/50 bg-slate-800/80 px-5 py-3">
              <h2 className="font-semibold text-slate-200">📜 调用历史</h2>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {callHistory.map((item, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 border-b border-slate-700/30 px-5 py-3 last:border-0 ${item.success ? "bg-slate-800/30" : "bg-red-500/5"
                    }`}
                >
                  <span className="mt-0.5 text-lg">
                    {item.success ? "✅" : "❌"}
                  </span>
                  <div className="flex-1">
                    <div className="text-sm text-slate-300">{item.message}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {item.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-slate-600">
          重置时间：每日 00:00（当地时间）
        </div>
      </div>
    </div>
  );
}
