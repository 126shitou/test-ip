import { GeneratedImage } from "../types";

interface ImageGridProps {
  images: GeneratedImage[];
  isLoading: boolean;
  mode: "fast" | "slow";
}

export default function ImageGrid({ images, isLoading, mode }: ImageGridProps) {
  // 创建 4 个占位格子
  const slots = Array.from({ length: 4 }, (_, i) => images[i] || null);

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/50 shadow-xl backdrop-blur">
      <div className="border-b border-slate-700/50 bg-slate-800/80 px-5 py-3">
        <h2 className="font-semibold text-slate-200">🖼️ 生成结果</h2>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {slots.map((image, index) => (
            <div
              key={index}
              className="relative aspect-square overflow-hidden rounded-xl bg-slate-900"
            >
              {image ? (
                // 显示图片
                <img
                  src={image.url}
                  alt={`Generated ${index + 1}`}
                  className="h-full w-full object-cover transition-opacity duration-500"
                  style={{
                    animation: "fadeIn 0.5s ease-in",
                  }}
                  onError={(e) => {
                    // 图片加载失败时显示占位图
                    e.currentTarget.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='512' height='512'%3E%3Crect fill='%23334155' width='512' height='512'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='monospace' font-size='20' fill='%2394a3b8'%3E加载失败%3C/text%3E%3C/svg%3E`;
                  }}
                />
              ) : isLoading ? (
                // 加载中骨架屏
                <div className="flex h-full w-full flex-col items-center justify-center gap-3">
                  {mode === "slow" && index > images.length ? (
                    // 慢速模式：等待中
                    <div className="text-slate-500">
                      <div className="mb-2 text-4xl">⏳</div>
                      <div className="text-sm">等待中...</div>
                    </div>
                  ) : (
                    // 生成中动画
                    <>
                      <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-500"></div>
                      <div className="text-sm text-slate-400">
                        {mode === "fast" ? "生成中..." : `生成第 ${index + 1} 张...`}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                // 空状态
                <div className="flex h-full w-full items-center justify-center text-slate-600">
                  <div className="text-center">
                    <div className="mb-2 text-4xl opacity-50">📷</div>
                    <div className="text-sm">等待生成</div>
                  </div>
                </div>
              )}

              {/* 图片索引标签 */}
              {image && (
                <div className="absolute left-2 top-2 rounded-lg bg-black/50 px-2 py-1 text-xs font-medium text-white backdrop-blur">
                  #{index + 1}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 进度指示器（慢速模式） */}
        {isLoading && mode === "slow" && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-sm text-slate-400">
              <span>生成进度</span>
              <span>{images.length}/4</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-blue-500 transition-all duration-500"
                style={{ width: `${(images.length / 4) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* CSS 动画 */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
