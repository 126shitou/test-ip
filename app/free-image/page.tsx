"use client";

import { useEffect, useState, useCallback } from "react";
import {
  UserState,
  IPUsageState,
  GeneratedImage,
  GenerationHistory,
  DEFAULT_USER_STATE,
  DEFAULT_IP_USAGE,
  SlowModeStreamChunk,
  FastModeResponse,
} from "./types";
import {
  getUserState,
  setUserState,
  getIPUsage,
  incrementIPUsage,
  getHistory,
  addHistory,
  clearHistory,
  isLocalStorageAvailable,
} from "./lib/localStorage";
import UserStatusBar from "./components/UserStatusBar";
import ModeToggle from "./components/ModeToggle";
import ImageGrid from "./components/ImageGrid";
import LoginModal from "./components/LoginModal";
import RechargeModal from "./components/RechargeModal";
import GenerationHistoryComponent from "./components/GenerationHistory";
import Turnstile from "../components/Turnstile";
import PromptInput from "./components/PromptInput";

// Turnstile Site Key
// 测试 key (总是通过): 1x00000000000000000000AA
// 生产 key: 从环境变量读取
const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";

export default function FreeImagePage() {
  // ===== 状态管理 =====
  const [userState, setUserStateLocal] = useState<UserState>(DEFAULT_USER_STATE);
  const [ipUsage, setIPUsageLocal] = useState<IPUsageState>(DEFAULT_IP_USAGE);
  const [selectedMode, setSelectedMode] = useState<"fast" | "slow">("slow");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentImages, setCurrentImages] = useState<GeneratedImage[]>([]);
  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localStorageWarning, setLocalStorageWarning] = useState(false);

  // Turnstile 相关状态
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileError, setTurnstileError] = useState<string | null>(null);
  const [turnstileKey, setTurnstileKey] = useState(0);

  // 提示词状态
  const [prompt, setPrompt] = useState<string>("");

  // ===== 初始化：从 localStorage 加载数据 =====
  useEffect(() => {
    const loadedUserState = getUserState();
    const loadedIPUsage = getIPUsage();
    const loadedHistory = getHistory();

    setUserStateLocal(loadedUserState);
    setIPUsageLocal(loadedIPUsage);
    setHistory(loadedHistory);

    // 根据登录状态设置默认模式
    if (loadedUserState.isLoggedIn) {
      setSelectedMode("fast");
    }

    // 检查 localStorage 可用性
    if (!isLocalStorageAvailable()) {
      setLocalStorageWarning(true);
    }
  }, []);

  // ===== 监听多标签页同步 =====
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "free_image_user_state" && e.newValue) {
        setUserStateLocal(JSON.parse(e.newValue));
      }
      if (e.key === "free_image_ip_usage" && e.newValue) {
        setIPUsageLocal(JSON.parse(e.newValue));
      }
      if (e.key === "free_image_history" && e.newValue) {
        setHistory(JSON.parse(e.newValue));
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // ===== 刷新警告（生成中） =====
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isGenerating) {
        e.preventDefault();
        // 设置返回值以触发浏览器确认对话框
        return (e.returnValue = "图片生成中，确定要离开吗？");
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isGenerating]);

  // ===== 登录处理 =====
  const handleLogin = useCallback((username: string) => {
    const newUserState: UserState = {
      isLoggedIn: true,
      username,
      credits: 10,
      loginTimestamp: Date.now(),
    };
    setUserStateLocal(newUserState);
    setUserState(newUserState);
    setSelectedMode("fast");
    setShowLoginModal(false);
  }, []);

  // ===== 登出处理 =====
  const handleLogout = useCallback(() => {
    setUserStateLocal(DEFAULT_USER_STATE);
    setUserState(DEFAULT_USER_STATE);
    setSelectedMode("slow");
    setCurrentImages([]);
  }, []);

  // ===== Turnstile 回调处理 =====
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

  // ===== 验证是否可以生成 =====
  const validateGeneration = useCallback((): boolean => {
    // 访客模式：检查 IP 使用次数（不需要 Turnstile）
    if (!userState.isLoggedIn) {
      if (ipUsage.ipUsageCount >= 2) {
        setError("已使用 2 次免费额度，请登录继续");
        setShowLoginModal(true);
        return false;
      }
      // 强制慢速模式
      if (selectedMode !== "slow") {
        setSelectedMode("slow");
      }
      return true;
    }

    // 登录用户：检查积分（仅快速模式）
    if (selectedMode === "fast") {
      if (userState.credits < 4) {
        setShowRechargeModal(true);
        return false;
      }
      return true;
    }

    // 登录用户使用慢速模式：需要 Turnstile 验证
    if (selectedMode === "slow") {
      if (!turnstileToken) {
        setError("请先完成人机验证");
        return false;
      }
    }

    return true;
  }, [userState, ipUsage, selectedMode, turnstileToken]);

  // ===== 快速模式生成 =====
  const handleGenerateFast = useCallback(async () => {
    try {
      const response = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "fast",
          isLoggedIn: true,
          prompt: prompt.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("生成失败");
      }

      const data: FastModeResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || "生成失败");
      }

      // 转换为 GeneratedImage 格式
      const images: GeneratedImage[] = data.images.map((url, index) => ({
        id: `${Date.now()}-${index}`,
        url,
        timestamp: Date.now(),
      }));

      setCurrentImages(images);

      // 扣除积分
      const newUserState: UserState = {
        ...userState,
        credits: userState.credits - 4,
      };
      setUserStateLocal(newUserState);
      setUserState(newUserState);

      // 保存历史
      const historyRecord: GenerationHistory = {
        id: `hist_${Date.now()}`,
        timestamp: Date.now(),
        mode: "fast",
        images,
        username: userState.username,
      };
      addHistory(historyRecord);
      setHistory(getHistory());

      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "网络错误";
      setError(msg);
      throw err;
    }
  }, [userState, prompt]);

  // ===== 慢速模式生成 =====
  const handleGenerateSlow = useCallback(async () => {
    try {
      const response = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "slow",
          isLoggedIn: userState.isLoggedIn,
          prompt: prompt.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("生成失败");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("无法读取响应流");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      const generatedImages: GeneratedImage[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            const chunk: SlowModeStreamChunk = JSON.parse(line);
            const newImage: GeneratedImage = {
              id: `${Date.now()}-${chunk.index}`,
              url: chunk.url,
              timestamp: chunk.timestamp,
            };
            generatedImages.push(newImage);
            setCurrentImages([...generatedImages]);
          }
        }
      }

      // 访客模式：增加 IP 使用次数
      if (!userState.isLoggedIn) {
        const newIPUsage = incrementIPUsage();
        setIPUsageLocal(newIPUsage);
      }

      // 慢速模式不保存历史记录

      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "网络错误";
      setError(msg);
      throw err;
    }
  }, [userState, prompt]);

  // ===== 生成图片主流程 =====
  const handleGenerate = async () => {
    if (isGenerating) return;

    // 验证
    if (!validateGeneration()) {
      return;
    }

    setIsGenerating(true);
    setCurrentImages([]);
    setError(null);

    try {
      if (selectedMode === "fast") {
        await handleGenerateFast();
      } else {
        await handleGenerateSlow();
        // 慢速模式完成后重置 Turnstile（仅登录用户）
        if (userState.isLoggedIn) {
          setTurnstileToken(null);
          setTurnstileKey((k) => k + 1);
        }
      }
    } catch (err) {
      console.error("Generation error:", err);
      // 出错也重置 Turnstile
      if (userState.isLoggedIn && selectedMode === "slow") {
        setTurnstileToken(null);
        setTurnstileKey((k) => k + 1);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // ===== 模式切换处理 =====
  const handleModeChange = (mode: "fast" | "slow") => {
    setSelectedMode(mode);
  };

  // ===== 切换到慢速模式（从充值弹窗） =====
  const handleSwitchToSlowFromRecharge = () => {
    setSelectedMode("slow");
    setShowRechargeModal(false);
  };

  // ===== 清空历史 =====
  const handleClearHistory = () => {
    if (confirm("确定要清空所有历史记录吗？")) {
      clearHistory();
      setHistory([]);
    }
  };

  // ===== 渲染 =====
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 font-sans text-slate-100 sm:p-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            🎨 免费图片生成
          </h1>
          <p className="text-slate-400">
            访客可免费使用 2 次，登录送 10 积分
          </p>
        </div>

        {/* LocalStorage 警告 */}
        {localStorageWarning && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-400">
            ⚠️ LocalStorage 不可用，数据将仅在本次会话中保存
          </div>
        )}

        {/* 用户状态栏 */}
        <UserStatusBar
          userState={userState}
          ipUsage={ipUsage}
          onLoginClick={() => setShowLoginModal(true)}
          onLogoutClick={handleLogout}
        />

        {/* 模式切换器 */}
        <ModeToggle
          mode={selectedMode}
          onModeChange={handleModeChange}
          disabled={!userState.isLoggedIn}
          disabledReason="登录后解锁快速模式"
        />

        {/* 提示词输入 */}
        <PromptInput value={prompt} onChange={setPrompt} />

        {/* Turnstile 人机验证（仅登录用户使用慢速模式时显示） */}
        {userState.isLoggedIn && selectedMode === "slow" && (
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
                action="slow-mode-generation"
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
        )}

        {/* 生成按钮 */}
        <div className="mb-6">
          <button
            onClick={handleGenerate}
            disabled={
              isGenerating ||
              (userState.isLoggedIn &&
                selectedMode === "slow" &&
                !turnstileToken)
            }
            className={`w-full rounded-xl px-6 py-4 text-lg font-semibold shadow-lg transition-all ${
              isGenerating ||
              (userState.isLoggedIn &&
                selectedMode === "slow" &&
                !turnstileToken)
                ? "cursor-not-allowed bg-slate-700 text-slate-500"
                : selectedMode === "fast"
                  ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:from-emerald-500 hover:to-emerald-400 hover:shadow-emerald-500/20"
                  : "bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-500 hover:to-blue-400 hover:shadow-blue-500/20"
            }`}
          >
            {isGenerating ? (
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
                生成中...
              </span>
            ) : userState.isLoggedIn &&
              selectedMode === "slow" &&
              !turnstileToken ? (
              "🔒 请先完成人机验证"
            ) : (
              `🎨 生成 4 张图片${selectedMode === "fast" ? "（消耗 4 积分）" : "（免费）"}`
            )}
          </button>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400">
            ⚠️ {error}
          </div>
        )}

        {/* 图片网格 */}
        <ImageGrid
          images={currentImages}
          isLoading={isGenerating}
          mode={selectedMode}
        />

        {/* 生成历史 */}
        <GenerationHistoryComponent
          history={history}
          onClearHistory={handleClearHistory}
        />

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-slate-600">
          使用 Picsum Photos API 生成随机图片
        </div>
      </div>

      {/* 登录弹窗 */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLogin={handleLogin}
      />

      {/* 充值弹窗 */}
      <RechargeModal
        isOpen={showRechargeModal}
        currentCredits={userState.credits}
        onClose={() => setShowRechargeModal(false)}
        onSwitchToSlow={handleSwitchToSlowFromRecharge}
      />
    </div>
  );
}
