import { GenerationHistory } from "../types";
import { useState } from "react";

interface GenerationHistoryProps {
  history: GenerationHistory[];
  onClearHistory: () => void;
}

export default function GenerationHistoryComponent({
  history,
  onClearHistory,
}: GenerationHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (history.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/50 shadow-xl backdrop-blur">
      {/* 头部 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full border-b border-slate-700/50 bg-slate-800/80 px-5 py-3 text-left transition-colors hover:bg-slate-800"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-200">
            📜 生成历史 ({history.length})
          </h2>
          <svg
            className={`h-5 w-5 text-slate-400 transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {/* 内容区域 */}
      {isExpanded && (
        <div>
          {/* 清空按钮 */}
          <div className="border-b border-slate-700/30 px-5 py-3">
            <button
              onClick={onClearHistory}
              className="rounded-lg bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
            >
              清空历史
            </button>
          </div>

          {/* 历史记录列表 */}
          <div className="max-h-96 overflow-y-auto">
            {history.map((record, index) => (
              <div
                key={record.id}
                className={`border-b border-slate-700/30 p-5 last:border-b-0 ${
                  index % 2 === 0 ? "bg-slate-800/30" : ""
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  {/* 时间和用户信息 */}
                  <div className="text-sm text-slate-400">
                    <div>
                      {new Date(record.timestamp).toLocaleString("zh-CN")}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span>
                        {record.username ? `👤 ${record.username}` : "👻 访客"}
                      </span>
                      <span>•</span>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
                          record.mode === "fast"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-blue-500/20 text-blue-400"
                        }`}
                      >
                        {record.mode === "fast" ? "🚀 快速" : "🐌 慢速"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 缩略图网格 */}
                <div className="grid grid-cols-4 gap-2">
                  {record.images.map((image, imgIndex) => (
                    <div
                      key={image.id}
                      className="relative aspect-square overflow-hidden rounded-lg bg-slate-900"
                    >
                      <img
                        src={image.url}
                        alt={`History ${index + 1}-${imgIndex + 1}`}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23334155' width='100' height='100'/%3E%3C/svg%3E`;
                        }}
                      />
                      <div className="absolute inset-0 bg-black/0 transition-colors hover:bg-black/20" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
