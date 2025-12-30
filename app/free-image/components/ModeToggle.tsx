interface ModeToggleProps {
  mode: "fast" | "slow";
  onModeChange: (mode: "fast" | "slow") => void;
  disabled: boolean;
  disabledReason?: string;
}

export default function ModeToggle({
  mode,
  onModeChange,
  disabled,
  disabledReason,
}: ModeToggleProps) {
  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/50 shadow-xl backdrop-blur">
      <div className="border-b border-slate-700/50 bg-slate-800/80 px-5 py-3">
        <h2 className="font-semibold text-slate-200">⚡ 生成模式</h2>
      </div>
      <div className="p-5">
        <div className="relative">
          {/* 切换器容器 */}
          <div
            className={`relative flex items-center justify-between rounded-xl border-2 ${
              disabled
                ? "border-slate-700 bg-slate-900/50"
                : "border-slate-600 bg-slate-900"
            } p-1`}
            title={disabled ? disabledReason : ""}
          >
            {/* 快速模式按钮 */}
            <button
              onClick={() => !disabled && onModeChange("fast")}
              disabled={disabled}
              className={`relative z-10 flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-all ${
                mode === "fast" && !disabled
                  ? "text-white"
                  : disabled
                    ? "text-slate-600"
                    : "text-slate-400 hover:text-slate-300"
              } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="text-lg">🚀</span>
                <span>快速模式</span>
                <span className="text-xs opacity-75">(4 积分)</span>
              </div>
            </button>

            {/* 慢速模式按钮 */}
            <button
              onClick={() => !disabled && onModeChange("slow")}
              disabled={disabled}
              className={`relative z-10 flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-all ${
                mode === "slow" && !disabled
                  ? "text-white"
                  : disabled
                    ? "text-slate-600"
                    : "text-slate-400 hover:text-slate-300"
              } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="text-lg">🐌</span>
                <span>慢速模式</span>
                <span className="text-xs opacity-75">(免费)</span>
              </div>
            </button>

            {/* 滑动背景 */}
            {!disabled && (
              <div
                className={`absolute top-1 h-[calc(100%-8px)] w-[calc(50%-4px)] rounded-lg bg-gradient-to-r transition-all duration-300 ${
                  mode === "fast"
                    ? "left-1 from-emerald-600 to-emerald-500"
                    : "left-[calc(50%+4px)] from-blue-600 to-blue-500"
                }`}
              />
            )}
          </div>

          {/* 禁用提示 */}
          {disabled && disabledReason && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
              <span>ℹ️</span>
              <span>{disabledReason}</span>
            </div>
          )}
        </div>

        {/* 模式说明 */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-slate-900/50 p-3">
            <div className="mb-1 font-medium text-emerald-400">快速模式</div>
            <div className="text-xs text-slate-400">
              4 张图片并发生成，立即返回
            </div>
          </div>
          <div className="rounded-lg bg-slate-900/50 p-3">
            <div className="mb-1 font-medium text-blue-400">慢速模式</div>
            <div className="text-xs text-slate-400">
              4 张图片串行生成，约 20 秒
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
