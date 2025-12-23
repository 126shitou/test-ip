"use client";

import { useEffect, useRef, useCallback } from "react";

// 声明全局 turnstile 对象类型
declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: TurnstileOptions
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
      getResponse: (widgetId: string) => string | undefined;
      isExpired: (widgetId: string) => boolean;
      ready: (callback: () => void) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

interface TurnstileOptions {
  sitekey: string;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "flexible" | "compact";
  callback?: (token: string) => void;
  "error-callback"?: (errorCode: string) => void;
  "expired-callback"?: () => void;
  action?: string;
  cData?: string;
  execution?: "render" | "execute";
  appearance?: "always" | "execute" | "interaction-only";
}

interface TurnstileProps {
  siteKey: string;
  onSuccess: (token: string) => void;
  onError?: (error: string) => void;
  onExpired?: () => void;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "flexible" | "compact";
  action?: string;
  className?: string;
}

export default function Turnstile({
  siteKey,
  onSuccess,
  onError,
  onExpired,
  theme = "dark",
  size = "normal",
  action,
  className,
}: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const scriptLoadedRef = useRef(false);

  // 渲染 Turnstile widget
  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile) return;

    // 如果已有 widget，先移除
    if (widgetIdRef.current) {
      try {
        window.turnstile.remove(widgetIdRef.current);
      } catch {
        // 忽略移除错误
      }
      widgetIdRef.current = null;
    }

    // 清空容器
    containerRef.current.innerHTML = "";

    // 渲染新 widget
    const widgetId = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme,
      size,
      action,
      callback: (token: string) => {
        console.log("Turnstile verification successful");
        onSuccess(token);
      },
      "error-callback": (errorCode: string) => {
        console.error("Turnstile error:", errorCode);
        onError?.(errorCode);
      },
      "expired-callback": () => {
        console.warn("Turnstile token expired");
        onExpired?.();
      },
    });

    widgetIdRef.current = widgetId;
  }, [siteKey, theme, size, action, onSuccess, onError, onExpired]);

  // 加载 Turnstile 脚本
  useEffect(() => {
    // 检查脚本是否已加载
    if (window.turnstile) {
      renderWidget();
      return;
    }

    // 避免重复加载脚本
    if (scriptLoadedRef.current) return;

    const existingScript = document.querySelector(
      'script[src*="challenges.cloudflare.com/turnstile"]'
    );

    if (existingScript) {
      // 脚本已存在，等待加载完成
      const checkTurnstile = setInterval(() => {
        if (window.turnstile) {
          clearInterval(checkTurnstile);
          renderWidget();
        }
      }, 100);
      return () => clearInterval(checkTurnstile);
    }

    // 加载脚本
    scriptLoadedRef.current = true;

    // 设置 onload 回调
    window.onTurnstileLoad = () => {
      renderWidget();
    };

    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      // 清理 widget
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // 忽略清理错误
        }
      }
    };
  }, [renderWidget]);

  // 暴露重置方法
  const reset = useCallback(() => {
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, []);

  // 将 reset 方法挂载到 ref 上以便父组件调用
  useEffect(() => {
    if (containerRef.current) {
      (containerRef.current as HTMLDivElement & { resetTurnstile?: () => void }).resetTurnstile = reset;
    }
  }, [reset]);

  return (
    <div
      ref={containerRef}
      className={className}
      data-turnstile-container
    />
  );
}

// 导出 hook 用于获取 reset 方法
export function useTurnstileReset(ref: React.RefObject<HTMLDivElement | null>) {
  return useCallback(() => {
    if (ref.current) {
      const container = ref.current as HTMLDivElement & { resetTurnstile?: () => void };
      container.resetTurnstile?.();
    }
  }, [ref]);
}

